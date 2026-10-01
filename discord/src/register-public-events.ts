import { ChannelType, Client, EmbedBuilder } from "discord.js";
import { PURCHASE_TICKET_BUTTON } from "./commands.js";
import { BRAND, brandEmbed } from "./brand.js";
import {
  CHANNELS,
  TICKET_OPTIONS,
  type TicketCategory,
  findTextChannel,
  canBypassTicketLimits,
  isStaffMember,
  resolveRoleMap,
  staffRoles,
} from "./layout.js";
import {
  handlePurchaseTicketButton,
  isTicketChannel,
  parseTicketOpenerId,
} from "./purchase-tickets.js";
import {
  handlePurchaseFlowInteraction,
  isPurchaseChatLocked,
  isPurchaseFlowInteraction,
} from "./purchase-flow.js";
import {
  buildBillingWelcome,
  buildCompatibilityWelcome,
  handleSupportFlowInteraction,
  isSupportChatLocked,
  isSupportFlowInteraction,
} from "./support-flow.js";
import {
  buildTicketReply,
  classifyTicketMessage,
} from "./ticket-intents.js";
import {
  buildTicketMuteReply,
  isTicketCustomerMuted,
  recordUnrecognizedTicketMessage,
  shouldCountTowardTicketMute,
  temporaryMuteCustomerInTicket,
  TICKET_SPAM_MESSAGE_LIMIT,
} from "./ticket-spam.js";
import {
  clearTicketStaffHandled,
  isTicketStaffHandled,
  staffTakesOverTicket,
} from "./ticket-handoff.js";
import {
  buildTicketOverwrites,
  getStaffCategory,
} from "./ticket-channels.js";
import {
  checkCanOpenTicket,
  findOpenTicketForUser,
  parseTicketKind,
  recordTicketOpenAttempt,
} from "./ticket-guard.js";
import {
  deferEphemeral,
  resolveInteractionMember,
} from "./interaction-utils.js";
import {
  closeTicketFromButton,
  startTicketInactivitySweep,
} from "./ticket-close.js";
import {
  handleRedeemInteraction,
  isRedeemInteraction,
} from "./redeem.js";
import {
  handleFeedbackInteraction,
  isFeedbackInteraction,
} from "./feedback.js";
import { registerTicketLogGuard } from "./ticket-log-guard.js";
import { handleReferralInteraction, isReferralInteraction } from "./referral.js";

function ticketLabel(category: TicketCategory) {
  return TICKET_OPTIONS.find((t) => t.id === category)?.label ?? "Support";
}

async function createTicket(
  guild: import("discord.js").Guild,
  userId: string,
  category: TicketCategory
) {
  const roles = resolveRoleMap(guild);
  const staffCategory = getStaffCategory(guild);

  const slug = ticketLabel(category)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const channelName = `ticket-${slug}-${userId.slice(-4)}`;

  const existing = findOpenTicketForUser(guild, userId);
  if (existing) {
    return { channel: existing, duplicate: true as const };
  }

  const overwrites = buildTicketOverwrites(guild, roles, userId, {
    customerCanSpeak: category !== "compatibility",
  });
  const stage = category === "compatibility" ? " · support:form" : "";

  const channel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: staffCategory?.id,
    topic: `${BRAND.name} · ${ticketLabel(category)} · opened by <@${userId}>${stage}`,
    permissionOverwrites: overwrites,
    reason: "NeonAi ticket opened",
  });

  const welcome =
    category === "billing"
      ? buildBillingWelcome(channel.id)
      : buildCompatibilityWelcome(channel.id);

  await channel.send({
    content: `<@${userId}>`,
    ...welcome,
  });

  const { postTicketOpened } = await import("./ticket-transcripts.js");
  await postTicketOpened(guild, {
    channelName: channel.name,
    openerId: userId,
    panel: ticketLabel(category),
  }).catch((err) => console.error("Ticket open log failed:", err));

  return { channel, duplicate: false as const };
}

async function safeReply(
  interaction: import("discord.js").Interaction,
  content: string
) {
  if (!interaction.isRepliable()) return;
  try {
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content, ephemeral: true });
      return;
    }
    await interaction.reply({ content, ephemeral: true });
  } catch {
    /* stale or already-acknowledged interaction */
  }
}

async function handleVerify(
  interaction: import("discord.js").ButtonInteraction
) {
  if (!(await deferEphemeral(interaction))) return;

  const roles = resolveRoleMap(interaction.guild!);
  if (!roles.member) {
    await interaction.editReply({
      content: "Member role missing — re-run `npm run setup`.",
    });
    return;
  }

  const member = await resolveInteractionMember(interaction);
  if (!member) {
    await interaction.editReply({
      content: "Could not load your member profile. Try again.",
    });
    return;
  }

  if (member.roles.cache.has(roles.member.id)) {
    await interaction.editReply({
      content: "You're already verified — you can open tickets in **#┃ticket**.",
    });
    return;
  }

  try {
    await member.roles.add(roles.member, "NeonAi verification");
  } catch (err) {
    console.error("Verify role error:", err);
    await interaction.editReply({
      content:
        "Could not assign the **Member** role. Ask staff to check the bot has **Manage Roles** and its role is above **Member**.",
    });
    return;
  }

  await interaction.editReply({
    content: [
      `${BRAND.emoji.verify} **Verified!** Welcome to **${BRAND.name}**.`,
      "",
      `Start with **#${CHANNELS.welcome}** and **#${CHANNELS.news}**.`,
      `Open a ticket in **#${CHANNELS.ticket}** anytime you need help.`,
      `After purchase, use **#${CHANNELS.customerSupport}** as a **Customer**.`,
    ].join("\n"),
  });
}

async function welcomeNewMember(
  member: import("discord.js").GuildMember,
  guildId: string
) {
  if (member.guild.id !== guildId) return;

  const roles = resolveRoleMap(member.guild);
  if (roles.member && member.roles.cache.has(roles.member.id)) return;

  const verifyChannel = findTextChannel(member.guild, CHANNELS.verify);
  const embed = new EmbedBuilder()
    .setColor(BRAND.colors.crimson)
    .setTitle(`Welcome to ${BRAND.name}`)
    .setDescription(
      [
        `Hey ${member.displayName} — thanks for joining.`,
        "",
        "Before you can see the rest of the server, you need to verify.",
        "",
        verifyChannel
          ? `Go to **#${CHANNELS.verify}** and click **Verify**.`
          : "Head to the verification channel and click **Verify**.",
        "",
        "This keeps bots and raids out.",
      ].join("\n")
    )
    .setFooter(brandEmbed().footer);

  try {
    await member.send({ embeds: [embed] });
  } catch {
    /* DMs closed — the verify panel in #┃verify already explains what to do */
  }
}

const handledTicketMessages = new Set<string>();
const compatibilityIntroSent = new Set<string>();

async function handleTicketMessage(message: import("discord.js").Message) {
  if (
    !message.guild ||
    message.author.bot ||
    !message.channel.isTextBased() ||
    !isTicketChannel(message.channel)
  ) {
    return;
  }

  if (handledTicketMessages.has(message.id)) return;
  handledTicketMessages.add(message.id);
  if (handledTicketMessages.size > 1000) {
    handledTicketMessages.clear();
  }

  const roles = resolveRoleMap(message.guild);
  const channelId = message.channel.id;
  const member =
    message.member ??
    (await message.guild.members.fetch(message.author.id).catch(() => null));

  if (member && isStaffMember(roles, member.roles)) {
    const openerId = parseTicketOpenerId(message.channel.topic);
    if (!isPurchaseChatLocked(message.channel) && !isSupportChatLocked(message.channel)) {
      await staffTakesOverTicket(message.channel, channelId, openerId);
    }
    return;
  }

  if (isTicketStaffHandled(channelId)) return;

  const openerId = parseTicketOpenerId(message.channel.topic);
  if (openerId && message.author.id !== openerId) return;

  const userId = message.author.id;

  if (isTicketCustomerMuted(channelId, userId)) return;

  const ticketKind = parseTicketKind(
    message.channel.topic,
    message.channel.name
  );

  if (ticketKind === "purchase" && isPurchaseChatLocked(message.channel)) {
    return;
  }

  if (
    ticketKind === "billing" ||
    ticketKind === "compatibility" ||
    ticketKind === "technical"
  ) {
    return;
  }

  const { intent, tier } = classifyTicketMessage(message.content, {
    ticketKind,
    compatibilityIntroSent: compatibilityIntroSent.has(channelId),
  });

  if (intent === "compatibility_intro") {
    compatibilityIntroSent.add(channelId);
  }

  if (shouldCountTowardTicketMute(intent, message.content, ticketKind)) {
    const spamCount = recordUnrecognizedTicketMessage(channelId, userId);

    if (spamCount >= TICKET_SPAM_MESSAGE_LIMIT) {
      try {
        await temporaryMuteCustomerInTicket(
          message.channel,
          channelId,
          userId
        );
      } catch (err) {
        console.error("Ticket mute error:", err);
      }

      const muteReply = buildTicketMuteReply(userId);
      const muteEmbed = new EmbedBuilder()
        .setColor(BRAND.colors.ruby)
        .setTitle(`${BRAND.emoji.ticket} ${muteReply.title}`)
        .setDescription(muteReply.description)
        .setFooter(brandEmbed().footer);

      await message.channel.send({ embeds: [muteEmbed] });
      return;
    }
  }

  const reply = buildTicketReply(message.author.id, intent, tier);
  const staffPing = staffRoles(roles).map((r) => `<@&${r.id}>`).join(" ");

  const embed = new EmbedBuilder()
    .setColor(BRAND.colors.crimson)
    .setTitle(`${BRAND.emoji.ticket} ${reply.title}`)
    .setDescription(reply.description)
    .setFooter(brandEmbed().footer);

  await message.channel.send({
    content: reply.pingStaff ? staffPing || undefined : undefined,
    embeds: [embed],
  });
}

/** Main NeonAi bot — verify, welcome DMs, close-ticket buttons on legacy panels */
export function registerMainBotEvents(client: Client, guildId: string) {
  registerTicketLogGuard(client, guildId);
  client.on("guildMemberAdd", (member) => {
    welcomeNewMember(member, guildId).catch((err) =>
      console.error("Welcome error:", err)
    );
  });

  client.on("interactionCreate", async (interaction) => {
    if (!interaction.guild) return;

    try {
      if (isReferralInteraction(interaction)) {
        await handleReferralInteraction(interaction);
        return;
      }

      if (interaction.isButton() && interaction.customId === "neonai_verify") {
        await handleVerify(interaction);
        return;
      }

      if (
        interaction.isButton() &&
        interaction.customId.startsWith("neonai_close_ticket:")
      ) {
        const channelId = interaction.customId.split(":")[1];
        await closeTicketFromButton(interaction, channelId);
        return;
      }

      if (isRedeemInteraction(interaction)) {
        await handleRedeemInteraction(interaction);
        return;
      }

      if (isFeedbackInteraction(interaction)) {
        await handleFeedbackInteraction(interaction);
      }
    } catch (err) {
      console.error("Main bot interaction error:", err);
      await safeReply(
        interaction,
        "Something went wrong. Try again or ping an admin."
      );
    }
  });
}

/** NeonAi Tickets bot — open/close tickets, auto-replies, purchase tickets */
export function registerTicketBotEvents(client: Client, guildId: string) {
  registerTicketLogGuard(client, guildId);
  startTicketInactivitySweep(client, guildId);
  client.on("messageCreate", (message) => {
    handleTicketMessage(message).catch((err) =>
      console.error("Ticket message error:", err)
    );
  });

  client.on("interactionCreate", async (interaction) => {
    if (!interaction.guild) return;

    try {
      if (isReferralInteraction(interaction)) {
        await handleReferralInteraction(interaction);
        return;
      }

      if (isPurchaseFlowInteraction(interaction)) {
        await handlePurchaseFlowInteraction(interaction);
        return;
      }

      if (isSupportFlowInteraction(interaction)) {
        await handleSupportFlowInteraction(interaction);
        return;
      }

      if (
        interaction.isButton() &&
        interaction.customId === PURCHASE_TICKET_BUTTON
      ) {
        await handlePurchaseTicketButton(interaction);
        return;
      }

      if (
        interaction.isStringSelectMenu() &&
        interaction.customId === "neonai_ticket_select"
      ) {
        if (!(await deferEphemeral(interaction))) return;

        const roles = resolveRoleMap(interaction.guild);
        const member = await resolveInteractionMember(interaction);
        if (!member) {
          await interaction.editReply({
            content: "Could not load your profile. Try again.",
          });
          return;
        }

        const panelChannel = interaction.channel?.name;
        const onCustomerPanel = panelChannel === CHANNELS.customerSupport;

        if (onCustomerPanel) {
          if (!roles.customer || !member.roles.cache.has(roles.customer.id)) {
            await interaction.editReply({
              content: `This panel is for **Customer** role only. Purchase a license first, or use **#${CHANNELS.ticket}** if you're not a customer yet.`,
            });
            return;
          }
        } else if (!roles.member || !member.roles.cache.has(roles.member.id)) {
          await interaction.editReply({
            content: `Verify first in **#${CHANNELS.verify}** — click **Verify**, then come back here.`,
          });
          return;
        }

        const category = interaction.values[0] as TicketCategory;
        if (category !== "billing" && category !== "compatibility") {
          await interaction.editReply({
            content:
              "That category is no longer available. Choose Billing & License or Compatibility.",
          });
          return;
        }

        const gate = checkCanOpenTicket(interaction.user.id, {
          bypass: canBypassTicketLimits(interaction.guild, member),
        });
        if (!gate.allowed) {
          await interaction.editReply({ content: gate.reason! });
          return;
        }

        recordTicketOpenAttempt(interaction.user.id);

        const result = await createTicket(
          interaction.guild,
          interaction.user.id,
          category
        );

        if (result.duplicate) {
          await interaction.editReply({
            content: `You already have an open ticket: ${result.channel} (\`#${result.channel.name}\`)`,
          });
          return;
        }

        await interaction.editReply({
          content: `Ticket opened: ${result.channel} (\`#${result.channel.name}\`)`,
        });
        return;
      }

      if (
        interaction.isButton() &&
        interaction.customId.startsWith("neonai_close_ticket:")
      ) {
        const channelId = interaction.customId.split(":")[1];
        await closeTicketFromButton(interaction, channelId);
        return;
      }

      if (isRedeemInteraction(interaction)) {
        await handleRedeemInteraction(interaction);
        return;
      }

      if (isFeedbackInteraction(interaction)) {
        await handleFeedbackInteraction(interaction);
      }
    } catch (err) {
      console.error("Ticket interaction error:", err);
      await safeReply(
        interaction,
        "Something went wrong. Try again or ping an admin."
      );
    }
  });
}

/** @deprecated Use registerMainBotEvents or registerTicketBotEvents */
export function registerPublicBotEvents(client: Client, guildId: string) {
  registerMainBotEvents(client, guildId);
  registerTicketBotEvents(client, guildId);
}
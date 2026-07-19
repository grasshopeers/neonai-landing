import "dotenv/config";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  PermissionFlagsBits,
} from "discord.js";
import { registerSlashCommands, PURCHASE_TICKET_BUTTON } from "./commands.js";
import { BRAND, brandEmbed } from "./brand.js";
import {
  CHANNELS,
  TICKET_OPTIONS,
  type TicketCategory,
  findTextChannel,
  isStaffMember,
  resolveRoleMap,
  staffRoles,
} from "./layout.js";
import {
  handleDeliverCommand,
  handlePurchaseTicketButton,
  handleSetupCommand,
  handleStripeCommand,
  handleUnmuteCommand,
  isTicketChannel,
  parseTicketOpenerId,
} from "./purchase-tickets.js";
import {
  buildTicketReply,
  classifyTicketMessage,
} from "./ticket-intents.js";
import {
  isLifetimeEligible,
  lifetimeRequirementMessage,
} from "./purchase-history.js";
import {
  buildTicketMuteReply,
  isTicketCustomerMuted,
  recordUnrecognizedTicketMessage,
  shouldCountTowardTicketMute,
  temporaryMuteCustomerInTicket,
  TICKET_SPAM_MESSAGE_LIMIT,
} from "./ticket-spam.js";
import {
  buildTicketOverwrites,
  getStaffCategory,
} from "./ticket-channels.js";
import {
  checkCanOpenTicket,
  findOpenTicketForUser,
  parseTicketKind,
  parseTicketOpenerId,
  recordTicketClosed,
  recordTicketOpenAttempt,
} from "./ticket-guard.js";
import {
  deferEphemeral,
  resolveInteractionMember,
} from "./interaction-utils.js";
import { handleMembersCommand } from "./staff-members.js";

const token = process.env.DISCORD_BOT_TOKEN;
const guildId = process.env.DISCORD_GUILD_ID;

if (!token || !guildId) {
  console.error("Missing DISCORD_BOT_TOKEN or DISCORD_GUILD_ID in .env");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

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

  const overwrites = buildTicketOverwrites(guild, roles, userId);

  const channel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: staffCategory?.id,
    topic: `${BRAND.name} · ${ticketLabel(category)} · opened by <@${userId}>`,
    permissionOverwrites: overwrites,
    reason: "NeonAi ticket opened",
  });

  const embed = new EmbedBuilder()
    .setColor(BRAND.colors.crimson)
    .setTitle(`${BRAND.emoji.ticket} ${ticketLabel(category)}`)
    .setDescription(
      [
        `Hey <@${userId}> — support will be with you shortly.`,
        "",
        "**Include when you can:**",
        "• Your license email or order ID",
        "• Windows version + GPU",
        "• A short description of the issue",
        "",
        "Staff: use **Close Ticket** when resolved.",
      ].join("\n")
    )
    .setFooter(brandEmbed().footer);

  const closeRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`neonai_close_ticket:${channel.id}`)
      .setLabel("Close Ticket")
      .setStyle(ButtonStyle.Danger)
      .setEmoji(BRAND.emoji.close)
  );

  await channel.send({
    content:
      staffRoles(roles).length > 0
        ? staffRoles(roles).map((r) => `<@&${r.id}>`).join(" ")
        : undefined,
    embeds: [embed],
    components: [closeRow],
  });

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

async function closeTicket(
  interaction: import("discord.js").ButtonInteraction,
  channelId: string
) {
  await interaction.deferReply({ ephemeral: true });

  const channel = await interaction.guild?.channels.fetch(channelId);
  if (!channel?.isTextBased()) {
    await interaction.editReply({ content: "Ticket channel not found." });
    return;
  }

  const roles = resolveRoleMap(interaction.guild!);
  const member = interaction.member;
  const isStaff =
    member &&
    "roles" in member &&
    isStaffMember(
      roles,
      member.roles as import("discord.js").GuildMemberRoleManager
    );

  const openerId = channel.topic?.match(/<@(\d+)>/)?.[1];
  const isOpener = openerId && interaction.user.id === openerId;

  if (!isStaff && !isOpener) {
    await interaction.editReply({
      content: "Only the ticket opener or staff can close this ticket.",
    });
    return;
  }

  await interaction.editReply({ content: "Closing ticket in 3 seconds…" });

  if (openerId) recordTicketClosed(openerId);

  const logChannel = findTextChannel(interaction.guild!, CHANNELS.ticketLogs);

  if (logChannel?.isTextBased()) {
    const messages = await channel.messages.fetch({ limit: 50 });
    const transcript = [...messages.values()]
      .reverse()
      .map((m) => `[${m.createdAt.toISOString()}] ${m.author.tag}: ${m.content}`)
      .join("\n")
      .slice(0, 3500);

    const logEmbed = new EmbedBuilder()
      .setColor(BRAND.colors.ruby)
      .setTitle(`Ticket closed · #${channel.name}`)
      .setDescription(transcript || "_No messages captured._")
      .addFields({
        name: "Closed by",
        value: interaction.user.tag,
      })
      .setFooter(brandEmbed().footer);

    await logChannel.send({ embeds: [logEmbed] });
  }

  setTimeout(async () => {
    try {
      await channel.delete("NeonAi ticket closed");
    } catch {
      /* channel may already be gone */
    }
  }, 3000);
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

async function welcomeNewMember(member: import("discord.js").GuildMember) {
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

client.once("ready", async () => {
  console.log(`NeonAi bot online as ${client.user?.tag}`);

  if (client.user && guildId) {
    try {
      await registerSlashCommands(token!, client.user.id, guildId);
      console.log(
        "Slash commands registered: /setup, /stripe, /unmute, /deliver, /members"
      );
    } catch (err) {
      console.error("Failed to register slash commands:", err);
    }
  }
});

const handledTicketMessages = new Set<string>();
const compatibilityIntroSent = new Set<string>();

async function handleTicketMessage(
  message: import("discord.js").Message
) {
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
  const member =
    message.member ??
    (await message.guild.members.fetch(message.author.id).catch(() => null));

  if (member && isStaffMember(roles, member.roles)) {
    return;
  }

  const openerId = parseTicketOpenerId(message.channel.topic);
  if (openerId && message.author.id !== openerId) return;

  const channelId = message.channel.id;
  const userId = message.author.id;

  if (isTicketCustomerMuted(channelId, userId)) return;

  const ticketKind = parseTicketKind(
    message.channel.topic,
    message.channel.name
  );

  const { intent, tier } = classifyTicketMessage(message.content, {
    ticketKind,
    compatibilityIntroSent: compatibilityIntroSent.has(channelId),
  });

  if (intent === "compatibility_intro") {
    compatibilityIntroSent.add(channelId);
  }

  if (intent === "valid_tier" && tier === "Lifetime" && !isLifetimeEligible(userId)) {
    const embed = new EmbedBuilder()
      .setColor(BRAND.colors.ruby)
      .setTitle(`${BRAND.emoji.ticket} Lifetime Not Available Yet`)
      .setDescription(lifetimeRequirementMessage(userId))
      .setFooter(brandEmbed().footer);

    await message.channel.send({ embeds: [embed] });
    return;
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

client.on("messageCreate", (message) => {
  handleTicketMessage(message).catch((err) =>
    console.error("Ticket message error:", err)
  );
});

client.on("guildMemberAdd", (member) => {
  welcomeNewMember(member).catch((err) =>
    console.error("Welcome error:", err)
  );
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.guild) return;

  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === "setup") {
        await handleSetupCommand(interaction);
        return;
      }
      if (interaction.commandName === "stripe") {
        await handleStripeCommand(interaction);
        return;
      }
      if (interaction.commandName === "unmute") {
        await handleUnmuteCommand(interaction);
        return;
      }
      if (interaction.commandName === "deliver") {
        await handleDeliverCommand(interaction);
        return;
      }
      if (interaction.commandName === "members") {
        await handleMembersCommand(interaction);
        return;
      }
    }

    if (interaction.isButton() && interaction.customId === "neonai_verify") {
      await handleVerify(interaction);
      return;
    }

    if (interaction.isButton() && interaction.customId === PURCHASE_TICKET_BUTTON) {
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

      const gate = checkCanOpenTicket(interaction.user.id);
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
          content: `You already have an open ticket: ${result.channel}`,
        });
        return;
      }

      await interaction.editReply({
        content: `Ticket opened: ${result.channel}`,
      });
      return;
    }

    if (
      interaction.isButton() &&
      interaction.customId.startsWith("neonai_close_ticket:")
    ) {
      const channelId = interaction.customId.split(":")[1];
      await closeTicket(interaction, channelId);
    }
  } catch (err) {
    console.error("Interaction error:", err);
    await safeReply(
      interaction,
      "Something went wrong. Try again or ping an admin."
    );
  }
});

client.login(token);

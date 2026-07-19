import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type Guild,
  type TextChannel,
} from "discord.js";
import { PURCHASE_TICKET_BUTTON } from "./commands.js";
import { BRAND, brandEmbed } from "./brand.js";
import {
  CHANNELS,
  findTextChannel,
  grantCustomerAccess,
  isStaffMember,
  resolveRoleMap,
  staffRoles,
} from "./layout.js";
import {
  buildTicketOverwrites,
  getStaffCategory,
} from "./ticket-channels.js";
import {
  checkCanOpenTicket,
  findOpenTicketForUser,
  parseTicketOpenerId,
  recordTicketClosed,
  recordTicketOpenAttempt,
} from "./ticket-guard.js";
import {
  isLifetimeEligible,
  recordLicensePurchase,
} from "./purchase-history.js";
import { isLicenseTier, type LicenseTier } from "./tiers.js";
import { staffUnmuteTicketCustomer } from "./ticket-spam.js";
import { NEONAI_DOWNLOAD_URL } from "./site.js";
import {
  deferEphemeral,
  resolveInteractionMember,
} from "./interaction-utils.js";

const TICKET_PREFIX = "ticket-";
const PURCHASE_SLUG = "purchase";
const TICKET_CLOSE_AFTER_DELIVERY_MS = 10 * 60_000;

function isStaffOnly(
  interaction: ChatInputCommandInteraction,
  roles: ReturnType<typeof resolveRoleMap>
) {
  const member = interaction.member;
  return (
    member &&
    "roles" in member &&
    isStaffMember(
      roles,
      member.roles as import("discord.js").GuildMemberRoleManager
    )
  );
}

function isValidStripeUrl(link: string) {
  try {
    const url = new URL(link.trim());
    if (!["http:", "https:"].includes(url.protocol)) return false;
    return (
      url.hostname === "checkout.stripe.com" ||
      url.hostname === "buy.stripe.com" ||
      url.hostname.endsWith(".stripe.com")
    );
  } catch {
    return false;
  }
}

export function isTicketChannel(channel: { name: string; topic?: string | null }) {
  return channel.name.startsWith(TICKET_PREFIX);
}

export { parseTicketOpenerId } from "./ticket-guard.js";

export async function createPurchaseTicket(
  guild: Guild,
  userId: string
): Promise<
  | { channel: TextChannel; duplicate: false }
  | { channel: TextChannel; duplicate: true }
> {
  const roles = resolveRoleMap(guild);
  const staffCategory = getStaffCategory(guild);

  const channelName = `${TICKET_PREFIX}${PURCHASE_SLUG}-${userId.slice(-4)}`;

  const existing = findOpenTicketForUser(guild, userId);
  if (existing) {
    return { channel: existing, duplicate: true };
  }

  const overwrites = buildTicketOverwrites(guild, roles, userId);

  const channel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: staffCategory?.id,
    topic: `${BRAND.name} · Purchase · opened by <@${userId}>`,
    permissionOverwrites: overwrites,
    reason: "NeonAi purchase ticket opened",
  });

  const embed = new EmbedBuilder()
    .setColor(BRAND.colors.crimson)
    .setTitle(`${BRAND.emoji.purchase} Purchase Ticket`)
    .setDescription(
      [
        `Hey <@${userId}> — thanks for choosing **${BRAND.name}**.`,
        "",
        "A staff member will drop your secure **Stripe** checkout link here shortly.",
        "All payments are processed and secured through **Stripe**.",
        "Once payment is confirmed, your license key will be delivered in this channel.",
        "",
        "**Please wait** — do not DM staff.",
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

  return { channel, duplicate: false };
}

export function buildPurchasePanel() {
  const embed = new EmbedBuilder()
    .setColor(BRAND.colors.crimson)
    .setTitle(`${BRAND.emoji.ticket} NeonAi Purchase`)
    .setDescription(
      [
        "Ready to buy? Click **Open Purchase Ticket** below.",
        "",
        "A private channel opens — staff will send your secure **Stripe** checkout link.",
        "All payments are processed and secured through **Stripe**.",
        "After payment, your license key is delivered automatically.",
      ].join("\n")
    )
    .setFooter(brandEmbed().footer);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(PURCHASE_TICKET_BUTTON)
      .setLabel("Open Purchase Ticket")
      .setStyle(ButtonStyle.Danger)
      .setEmoji(BRAND.emoji.purchase)
  );

  return { embeds: [embed], components: [row] };
}

export async function handleSetupCommand(
  interaction: ChatInputCommandInteraction
) {
  const roles = resolveRoleMap(interaction.guild!);
  const member = interaction.member;
  if (
    !member ||
    !("roles" in member) ||
    !isStaffMember(
      roles,
      member.roles as import("discord.js").GuildMemberRoleManager
    )
  ) {
    await interaction.reply({
      content: "Only staff can run `/setup`.",
      ephemeral: true,
    });
    return;
  }

  const panel = buildPurchasePanel();
  await interaction.reply({ content: "Purchase panel posted.", ephemeral: true });
  await interaction.channel?.send(panel);
}

export async function handleStripeCommand(
  interaction: ChatInputCommandInteraction
) {
  const channel = interaction.channel;
  if (!channel?.isTextBased() || !isTicketChannel(channel)) {
    await interaction.reply({
      content: "Run `/stripe` inside an open ticket channel only.",
      ephemeral: true,
    });
    return;
  }

  const roles = resolveRoleMap(interaction.guild!);
  if (!isStaffOnly(interaction, roles)) {
    await interaction.reply({
      content: "Only staff can send Stripe checkout links.",
      ephemeral: true,
    });
    return;
  }

  const tierRaw = interaction.options.getString("tier", true);
  const link = interaction.options.getString("link", true).trim();

  if (!isLicenseTier(tierRaw)) {
    await interaction.reply({ content: "Invalid tier selection.", ephemeral: true });
    return;
  }

  if (!isValidStripeUrl(link)) {
    await interaction.reply({
      content:
        "Invalid Stripe URL. Use an official link from **checkout.stripe.com** or **buy.stripe.com**.",
      ephemeral: true,
    });
    return;
  }

  const tier: LicenseTier = tierRaw;
  const openerId = parseTicketOpenerId(channel.topic);

  if (!openerId) {
    await interaction.reply({
      content: "Could not find the customer for this ticket.",
      ephemeral: true,
    });
    return;
  }

  if (tier === "Lifetime" && !isLifetimeEligible(openerId)) {
    await interaction.reply({
      content:
        "This customer has not met the **Lifetime** requirement yet (needs 3+ months of prior licenses). Deliver a shorter tier first.",
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const checkoutEmbed = new EmbedBuilder()
    .setColor(BRAND.colors.crimson)
    .setTitle(`${BRAND.emoji.purchase} Secure Stripe Checkout`)
    .setDescription(
      [
        `<@${openerId}> — your **${tier}** checkout link is ready.`,
        "",
        `🔗 [**Pay securely with Stripe**](${link})`,
        "",
        "🔒 **All payments are processed and secured through Stripe** — encrypted checkout, PCI-compliant, and we never see your card details.",
        "",
        "Complete payment on Stripe, then stay in this ticket. Staff will deliver your license key here once confirmed.",
        "",
        "**Please do not** send card details, OTPs, or payment screenshots in chat.",
      ].join("\n")
    )
    .setFooter(brandEmbed().footer);

  await channel.send({ content: `<@${openerId}>`, embeds: [checkoutEmbed] });

  const logChannel = findTextChannel(interaction.guild!, CHANNELS.ticketLogs);
  if (logChannel) {
    const customer = await interaction.client.users
      .fetch(openerId)
      .catch(() => null);
    const logEmbed = new EmbedBuilder()
      .setColor(BRAND.colors.ruby)
      .setTitle("Stripe Link Sent")
      .setDescription(
        `**${interaction.user.tag}** sent a **${tier}** Stripe checkout link to **${customer?.tag ?? openerId}**.`
      )
      .addFields({ name: "Ticket", value: `#${channel.name}`, inline: true })
      .setFooter(brandEmbed().footer);

    await logChannel.send({ embeds: [logEmbed] });
  }

  await interaction.editReply({
    content: `Posted **${tier}** Stripe checkout link for <@${openerId}>.`,
  });
}

export async function handleUnmuteCommand(
  interaction: ChatInputCommandInteraction
) {
  const channel = interaction.channel;
  if (!channel?.isTextBased() || !isTicketChannel(channel)) {
    await interaction.reply({
      content: "Run `/unmute` inside an open ticket channel only.",
      ephemeral: true,
    });
    return;
  }

  const roles = resolveRoleMap(interaction.guild!);
  if (!isStaffOnly(interaction, roles)) {
    await interaction.reply({
      content: "Only staff can unmute ticket customers.",
      ephemeral: true,
    });
    return;
  }

  const openerId = parseTicketOpenerId(channel.topic);
  if (!openerId) {
    await interaction.reply({
      content: "Could not find the customer for this ticket.",
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    await staffUnmuteTicketCustomer(channel, channel.id, openerId);
  } catch (err) {
    console.error("Staff unmute error:", err);
    await interaction.editReply({
      content: "Failed to unmute — check the bot has **Manage Channels** in this ticket.",
    });
    return;
  }

  const unmuteEmbed = new EmbedBuilder()
    .setColor(BRAND.colors.crimson)
    .setTitle(`${BRAND.emoji.ticket} Ticket Unmuted`)
    .setDescription(
      [
        `<@${openerId}> — a staff member has **restored your ability to send messages** in this ticket.`,
        "",
        "Please keep communication respectful and stay in this channel while support assists you.",
      ].join("\n")
    )
    .setFooter(brandEmbed().footer);

  await channel.send({ content: `<@${openerId}>`, embeds: [unmuteEmbed] });

  await interaction.editReply({
    content: `Unmuted <@${openerId}> in this ticket.`,
  });
}

export async function handleDeliverCommand(
  interaction: ChatInputCommandInteraction
) {
  const channel = interaction.channel;
  if (!channel?.isTextBased() || !isTicketChannel(channel)) {
    await interaction.reply({
      content: "Run `/deliver` inside an open ticket channel only.",
      ephemeral: true,
    });
    return;
  }

  const roles = resolveRoleMap(interaction.guild!);
  if (!isStaffOnly(interaction, roles)) {
    await interaction.reply({
      content: "Only staff can deliver license keys.",
      ephemeral: true,
    });
    return;
  }

  const tierRaw = interaction.options.getString("tier", true);
  const key = interaction.options.getString("key", true).trim();

  if (!isLicenseTier(tierRaw)) {
    await interaction.reply({
      content: "Invalid tier selection.",
      ephemeral: true,
    });
    return;
  }

  const tier: LicenseTier = tierRaw;
  const openerId = parseTicketOpenerId(channel.topic);

  if (!openerId) {
    await interaction.reply({
      content: "Could not find the customer for this ticket.",
      ephemeral: true,
    });
    return;
  }

  if (tier === "Lifetime" && !isLifetimeEligible(openerId)) {
    await interaction.reply({
      content:
        "This customer has not met the **Lifetime** requirement yet (needs 3+ months of prior licenses). Deliver a shorter tier first.",
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const deliveryEmbed = new EmbedBuilder()
    .setColor(BRAND.colors.crimson)
    .setTitle("Purchase Confirmed! 🎉")
    .setDescription(
      [
        `Thank you for purchasing a **${tier}** license for **${BRAND.name}**.`,
        "",
        `🔑 **Your Key:** \`${key}\``,
        "",
        `You now have access to **#${CHANNELS.redeem}**, product channels, **#${CHANNELS.customerSupport}**, and **#${CHANNELS.chat}** / **#${CHANNELS.voice}**.`,
        "",
        "*Please copy this key immediately. This ticket will close in 10 minutes.*",
      ].join("\n")
    )
    .setFooter(brandEmbed().footer);

  await channel.send({ content: `<@${openerId}>`, embeds: [deliveryEmbed] });

  const customerAccess = await grantCustomerAccess(
    interaction.guild!,
    openerId,
    `NeonAi license delivered (${tier})`
  );

  const logChannel = findTextChannel(interaction.guild!, CHANNELS.ticketLogs);
  if (logChannel) {
    const customer = await interaction.client.users.fetch(openerId).catch(() => null);
    const logEmbed = new EmbedBuilder()
      .setColor(BRAND.colors.ruby)
      .setTitle("License Delivered")
      .setDescription(
        `Admin **${interaction.user.tag}** delivered a **${tier}** key to **${customer?.tag ?? openerId}**.`
      )
      .addFields(
        { name: "Ticket", value: `#${channel.name}`, inline: true },
        { name: "Tier", value: tier, inline: true }
      )
      .setFooter(brandEmbed().footer);

    await logChannel.send({ embeds: [logEmbed] });
  }

  recordLicensePurchase(openerId, tier);

  await interaction.editReply({
    content: customerAccess.granted
      ? `Delivered **${tier}** key and granted **Customer** access to <@${openerId}>. Ticket closes in 10 minutes.`
      : `Delivered **${tier}** key. Ticket closes in 10 minutes. ⚠️ Could not assign **Customer** role — grant it manually so they can see **#${CHANNELS.redeem}**.`,
  });

  setTimeout(async () => {
    recordTicketClosed(openerId);
    try {
      await channel.delete("NeonAi license delivered — ticket closed");
    } catch {
      /* already deleted */
    }
  }, TICKET_CLOSE_AFTER_DELIVERY_MS);
}

export async function handlePurchaseTicketButton(
  interaction: ButtonInteraction
) {
  if (!(await deferEphemeral(interaction))) return;

  const roles = resolveRoleMap(interaction.guild!);
  const member = await resolveInteractionMember(interaction);

  if (!member) {
    await interaction.editReply({
      content: "Could not load your profile. Try again.",
    });
    return;
  }

  if (!roles.member || !member.roles.cache.has(roles.member.id)) {
    await interaction.editReply({
      content: `Verify first in **#${CHANNELS.verify}** — click **Verify**, then open a purchase ticket.`,
    });
    return;
  }

  const gate = checkCanOpenTicket(interaction.user.id);
  if (!gate.allowed) {
    await interaction.editReply({ content: gate.reason! });
    return;
  }

  recordTicketOpenAttempt(interaction.user.id);

  const result = await createPurchaseTicket(
    interaction.guild!,
    interaction.user.id
  );

  if (result.duplicate) {
    await interaction.editReply({
      content: `You already have an open ticket: ${result.channel}`,
    });
    return;
  }

  await interaction.editReply({
    content: `Purchase ticket opened: ${result.channel}`,
  });
}

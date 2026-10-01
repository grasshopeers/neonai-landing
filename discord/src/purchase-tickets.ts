import {
  ChannelType,
  EmbedBuilder,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type Guild,
  type TextChannel,
} from "discord.js";
import { BRAND, brandEmbed } from "./brand.js";
import { buildPurchasePanel } from "./panels.js";
import {
  CHANNELS,
  findTextChannel,
  grantCustomerAccess,
  canBypassTicketLimits,
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
  recordTicketOpenAttempt,
} from "./ticket-guard.js";
import { recordLicensePurchase } from "./purchase-history.js";
import { completeReferralPurchase } from "./referral-store.js";
import {
  formatLifetimeRequirement,
  formatTierList,
  getTierDisplayName,
  getTierPrice,
  isLicenseTier,
  type LicenseTier,
} from "./tiers.js";
import {
  deferEphemeral,
  resolveInteractionMember,
} from "./interaction-utils.js";
import { KOFI_TIP_URL, PAYPAL_PAYMENT_URL, REMITLY_PAYMENT } from "./site.js";
import {
  buildHardwareFormRow,
  markPurchaseDelivered,
  PURCHASE_STAGE,
  unlockPurchaseCustomer,
} from "./purchase-flow.js";
import { postTicketOpened } from "./ticket-transcripts.js";

const TICKET_PREFIX = "ticket-";
const PURCHASE_SLUG = "purchase";

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

  const overwrites = buildTicketOverwrites(guild, roles, userId, {
    customerCanSpeak: false,
  });

  const channel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: staffCategory?.id,
    topic: `${BRAND.name} · Purchase · opened by <@${userId}> · stage:${PURCHASE_STAGE.hw}`,
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
        "1. Submit your **hardware** (GPU, RAM, and in-game FPS).",
        "2. A staff member will review your details.",
        "3. Choose a **license** and a **payment method**.",
        "4. After you pay, send the payment screenshot in this ticket. Your license key is delivered here.",
        "",
        "Please do not DM staff.",
      ].join("\n")
    )
    .setFooter(brandEmbed().footer);

  await channel.send({
    content:
      staffRoles(roles).length > 0
        ? staffRoles(roles).map((r) => `<@&${r.id}>`).join(" ")
        : undefined,
    embeds: [embed],
    components: [buildHardwareFormRow(channel.id)],
  });

  await postTicketOpened(guild, {
    channelName: channel.name,
    openerId: userId,
    panel: "Purchase",
  }).catch((err) => console.error("Ticket open log failed:", err));

  return { channel, duplicate: false };
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

  await unlockPurchaseCustomer(channel, openerId);

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

export async function handleKofiCommand(
  interaction: ChatInputCommandInteraction
) {
  const channel = interaction.channel;
  if (!channel?.isTextBased() || !isTicketChannel(channel)) {
    await interaction.reply({
      content: "Run `/kofi` inside an open ticket channel only.",
      ephemeral: true,
    });
    return;
  }

  const roles = resolveRoleMap(interaction.guild!);
  if (!isStaffOnly(interaction, roles)) {
    await interaction.reply({
      content: "Only staff can send Ko-fi payment links.",
      ephemeral: true,
    });
    return;
  }

  const tierRaw = interaction.options.getString("tier", true);
  if (!isLicenseTier(tierRaw)) {
    await interaction.reply({ content: "Invalid tier selection.", ephemeral: true });
    return;
  }

  const tier: LicenseTier = tierRaw;
  const price = getTierPrice(tier);
  const openerId = parseTicketOpenerId(channel.topic);

  if (!openerId) {
    await interaction.reply({
      content: "Could not find the customer for this ticket.",
      ephemeral: true,
    });
    return;
  }

  if (price == null) {
    await interaction.reply({
      content: "Could not resolve the price for that tier.",
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const kofiEmbed = new EmbedBuilder()
    .setColor(BRAND.colors.crimson)
    .setTitle(`${BRAND.emoji.purchase} Ko-fi Payment`)
    .setDescription(
      [
        `<@${openerId}> — please complete a **one-time tip** for your **${getTierDisplayName(tier)}** license.`,
        "",
        `💰 **Amount to tip:** **$${price} USD**`,
        `🔗 [**Open Ko-fi**](${KOFI_TIP_URL})`,
        "",
        "On Ko-fi, leave a **one-time tip** for exactly that amount, then come back here and let us know once it’s done.",
        "",
        "Staff will confirm payment and deliver your license key in this ticket.",
      ].join("\n")
    )
    .setFooter(brandEmbed().footer);

  await channel.send({ content: `<@${openerId}>`, embeds: [kofiEmbed] });
  await unlockPurchaseCustomer(channel, openerId);

  const logChannel = findTextChannel(interaction.guild!, CHANNELS.ticketLogs);
  if (logChannel) {
    const customer = await interaction.client.users
      .fetch(openerId)
      .catch(() => null);
    await logChannel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(BRAND.colors.ruby)
          .setTitle("Ko-fi Link Sent")
          .setDescription(
            `**${interaction.user.tag}** sent Ko-fi tip instructions (**${tier}** · $${price}) to **${customer?.tag ?? openerId}**.`
          )
          .addFields({ name: "Ticket", value: `#${channel.name}`, inline: true })
          .setFooter(brandEmbed().footer),
      ],
    });
  }

  await interaction.editReply({
    content: `Posted Ko-fi tip link for **${tier}** ($${price}) to <@${openerId}>.`,
  });
}

export async function handleRemitlyCommand(
  interaction: ChatInputCommandInteraction
) {
  const channel = interaction.channel;
  if (!channel?.isTextBased() || !isTicketChannel(channel)) {
    await interaction.reply({
      content: "Run `/remitly` inside an open ticket channel only.",
      ephemeral: true,
    });
    return;
  }

  const roles = resolveRoleMap(interaction.guild!);
  if (!isStaffOnly(interaction, roles)) {
    await interaction.reply({
      content: "Only staff can send Remitly payment details.",
      ephemeral: true,
    });
    return;
  }

  const tierRaw = interaction.options.getString("tier", true);
  if (!isLicenseTier(tierRaw)) {
    await interaction.reply({ content: "Invalid tier selection.", ephemeral: true });
    return;
  }

  const tier: LicenseTier = tierRaw;
  const price = getTierPrice(tier);
  const openerId = parseTicketOpenerId(channel.topic);

  if (!openerId) {
    await interaction.reply({
      content: "Could not find the customer for this ticket.",
      ephemeral: true,
    });
    return;
  }

  if (price == null) {
    await interaction.reply({
      content: "Could not resolve the price for that tier.",
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const r = REMITLY_PAYMENT;
  const remitlyEmbed = new EmbedBuilder()
    .setColor(BRAND.colors.crimson)
    .setTitle(`${BRAND.emoji.purchase} Remitly — Bank Deposit`)
    .setDescription(
      [
        `<@${openerId}> — please send payment via **Remitly** for your **${getTierDisplayName(tier)}** license.`,
        "",
        `💰 **Amount to send:** **$${price} USD**`,
        "",
        `**Mode of Payment:** ${r.mode}`,
        `**Country:** ${r.country}`,
        `**Bank:** ${r.bank}`,
        `**Name:** ${r.name}`,
        `**IBAN:** \`${r.ibanDisplay}\``,
        `**Phone:** ${r.phone}`,
        "",
        "Use these exact bank details in Remitly. After the transfer is sent, stay in this ticket and let staff know.",
        "",
        "Staff will confirm payment and deliver your license key here.",
      ].join("\n")
    )
    .setFooter(brandEmbed().footer);

  await channel.send({ content: `<@${openerId}>`, embeds: [remitlyEmbed] });
  await unlockPurchaseCustomer(channel, openerId);

  const logChannel = findTextChannel(interaction.guild!, CHANNELS.ticketLogs);
  if (logChannel) {
    const customer = await interaction.client.users
      .fetch(openerId)
      .catch(() => null);
    await logChannel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(BRAND.colors.ruby)
          .setTitle("Remitly Details Sent")
          .setDescription(
            `**${interaction.user.tag}** sent Remitly bank-deposit instructions (**${tier}** · $${price}) to **${customer?.tag ?? openerId}**.`
          )
          .addFields({ name: "Ticket", value: `#${channel.name}`, inline: true })
          .setFooter(brandEmbed().footer),
      ],
    });
  }

  await interaction.editReply({
    content: `Posted Remitly bank details for **${tier}** ($${price}) to <@${openerId}>.`,
  });
}

export async function handlePaypalCommand(
  interaction: ChatInputCommandInteraction
) {
  const channel = interaction.channel;
  if (!channel?.isTextBased() || !isTicketChannel(channel)) {
    await interaction.reply({
      content: "Run `/paypal` inside an open ticket channel only.",
      ephemeral: true,
    });
    return;
  }

  const roles = resolveRoleMap(interaction.guild!);
  if (!isStaffOnly(interaction, roles)) {
    await interaction.reply({
      content: "Only staff can send PayPal payment links.",
      ephemeral: true,
    });
    return;
  }

  const tierRaw = interaction.options.getString("tier", true);
  if (!isLicenseTier(tierRaw)) {
    await interaction.reply({ content: "Invalid tier selection.", ephemeral: true });
    return;
  }

  const tier: LicenseTier = tierRaw;
  const price = getTierPrice(tier);
  const openerId = parseTicketOpenerId(channel.topic);

  if (!openerId) {
    await interaction.reply({
      content: "Could not find the customer for this ticket.",
      ephemeral: true,
    });
    return;
  }

  if (price == null) {
    await interaction.reply({
      content: "Could not resolve the price for that tier.",
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const paypalEmbed = new EmbedBuilder()
    .setColor(BRAND.colors.crimson)
    .setTitle(`${BRAND.emoji.purchase} PayPal Payment`)
    .setDescription(
      [
        `<@${openerId}> — please complete payment for your **${getTierDisplayName(tier)}** license.`,
        "",
        `💰 **Amount:** **$${price} USD**`,
        `🔗 [**Pay with PayPal**](${PAYPAL_PAYMENT_URL})`,
        "",
        "Send a screenshot of the payment in this ticket. Your license key will be sent here once staff confirms it.",
      ].join("\n")
    )
    .setFooter(brandEmbed().footer);

  await channel.send({ content: `<@${openerId}>`, embeds: [paypalEmbed] });
  await unlockPurchaseCustomer(channel, openerId);

  const logChannel = findTextChannel(interaction.guild!, CHANNELS.ticketLogs);
  if (logChannel) {
    const customer = await interaction.client.users
      .fetch(openerId)
      .catch(() => null);
    await logChannel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(BRAND.colors.ruby)
          .setTitle("PayPal Link Sent")
          .setDescription(
            `**${interaction.user.tag}** sent the PayPal link (**${tier}** · $${price}) to **${customer?.tag ?? openerId}**.`
          )
          .addFields({ name: "Ticket", value: `#${channel.name}`, inline: true })
          .setFooter(brandEmbed().footer),
      ],
    });
  }

  await interaction.editReply({
    content: `Posted PayPal link for **${tier}** ($${price}) to <@${openerId}>.`,
  });
}

export async function handlePriceCommand(
  interaction: ChatInputCommandInteraction
) {
  const channel = interaction.channel;
  if (!channel?.isTextBased() || !isTicketChannel(channel)) {
    await interaction.reply({
      content: "Run `/price` inside an open ticket channel only.",
      ephemeral: true,
    });
    return;
  }

  const roles = resolveRoleMap(interaction.guild!);
  if (!isStaffOnly(interaction, roles)) {
    await interaction.reply({
      content: "Only staff can post the price list.",
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const openerId = parseTicketOpenerId(channel.topic);
  const customerLine = openerId
    ? `<@${openerId}> — pick the license tier you want:`
    : "Pick the license tier you want:";

  const priceEmbed = new EmbedBuilder()
    .setColor(BRAND.colors.crimson)
    .setTitle(`${BRAND.emoji.purchase} NeonAi License Tiers`)
    .setDescription(
      [
        customerLine,
        "",
        formatTierList(),
        "",
        formatLifetimeRequirement(),
        "",
        "Choose **Weekly**, **Monthly**, **Quarterly**, or **Lifetime**, then continue with the payment buttons in this ticket.",
      ].join("\n")
    )
    .setFooter(brandEmbed().footer);

  await channel.send({
    content: openerId ? `<@${openerId}>` : undefined,
    embeds: [priceEmbed],
  });

  await interaction.editReply({ content: "Posted license tiers in this ticket." });
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
    await unlockPurchaseCustomer(channel, openerId);
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
        `You now have access to **#${CHANNELS.setup}**, **#${CHANNELS.guide}**, **#${CHANNELS.customerSupport}**, plus private forms in **#${CHANNELS.reviewUs}**, **#${CHANNELS.reportBug}**, and **#${CHANNELS.reportBan}**.`,
        `Verify anytime in **#${CHANNELS.redeem}** if you need Customer access on Discord.`,
        "",
        "Copy this key and keep it somewhere safe. This ticket stays open until you or a staff member closes it.",
      ].join("\n")
    )
    .setFooter(brandEmbed().footer);

  await channel.send({ content: `<@${openerId}>`, embeds: [deliveryEmbed] });

  await unlockPurchaseCustomer(channel, openerId);
  await markPurchaseDelivered(channel, openerId);

  const customerAccess = await grantCustomerAccess(
    interaction.guild!,
    openerId,
    `NeonAi license delivered (${tier})`
  );
  const keyDmSent = await sendLicenseKeyDm(interaction.client, openerId, tier, key);

  const { applyCustomerKeyNickname } = await import("./customer-keys.js");
  const nick = await applyCustomerKeyNickname(interaction.guild!, openerId, key, tier);

  const logChannel = findTextChannel(interaction.guild!, CHANNELS.ticketLogs);
  if (logChannel) {
    const customer = await interaction.client.users.fetch(openerId).catch(() => null);
    const logEmbed = new EmbedBuilder()
      .setColor(BRAND.colors.ruby)
      .setTitle("License Delivered")
      .setDescription(
        `Admin **${interaction.user.tag}** delivered a **${tier}** key to <@${openerId}>${customer ? ` (${customer.tag})` : ""}.\nStaff tag: \`·${nick.last4}\``
      )
      .addFields(
        { name: "Ticket", value: `#${channel.name}`, inline: true },
        { name: "Tier", value: tier, inline: true }
      )
      .setFooter(brandEmbed().footer);

    await logChannel.send({ embeds: [logEmbed] });
  }

  recordLicensePurchase(openerId, tier);
  const referral = completeReferralPurchase(channel.id);
  if (referral?.reward) {
    const requests = findTextChannel(interaction.guild!, CHANNELS.referRequests);
    if (requests?.isTextBased()) {
      const ping = staffRoles(resolveRoleMap(interaction.guild!))
        .map((role) => `<@&${role.id}>`)
        .join(" ");
      await requests.send({
        content: ping || undefined,
        embeds: [
          new EmbedBuilder()
            .setColor(BRAND.colors.crimson)
            .setTitle("Referral purchase completed")
            .setDescription(
              [
                `**Code:** \`${referral.code}\``,
                `**Owner:** <@${referral.ownerId}>`,
                `**Buyer:** <@${openerId}>`,
                "",
                `They reached **${referral.count}** successful referrals. Send them a free **${referral.reward}** key yourself.`,
              ].join("\n")
            )
            .setFooter(brandEmbed().footer),
        ],
      });
    }
  }

  const dmNote = keyDmSent
    ? "The key was sent to their DMs."
    : "Could not DM the key — their DMs are closed. The key is in this ticket.";

  await interaction.editReply({
    content: customerAccess.granted
      ? `Delivered **${tier}** key and granted **Customer** access to <@${openerId}>. ${dmNote} This ticket stays open until someone closes it.`
      : `Delivered **${tier}** key. ${dmNote} This ticket stays open until someone closes it. ⚠️ Could not assign **Customer** role — grant it manually so they can see **#${CHANNELS.redeem}**.`,
  });
}

async function sendLicenseKeyDm(
  client: ChatInputCommandInteraction["client"],
  openerId: string,
  tier: LicenseTier,
  key: string
) {
  const user = await client.users.fetch(openerId).catch(() => null);
  if (!user) return false;

  try {
    await user.send({
      embeds: [
        new EmbedBuilder()
          .setColor(BRAND.colors.crimson)
          .setTitle("Your NeonAi license")
          .setDescription(
            [
              "Thank you for your purchase.",
              "",
              "**License**",
              getTierDisplayName(tier),
              "",
              "**Key**",
              `\`${key}\``,
              "",
              "Please keep this key somewhere safe. Customer access is already on your account, including the setup channel.",
            ].join("\n")
          )
          .setFooter(brandEmbed().footer),
      ],
    });
    return true;
  } catch (err) {
    console.error(`Could not DM license key to ${openerId}:`, err);
    return false;
  }
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

  const gate = checkCanOpenTicket(interaction.user.id, {
    bypass: canBypassTicketLimits(interaction.guild!, member),
  });
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
      content: `You already have an open ticket: ${result.channel} (\`#${result.channel.name}\`)`,
    });
    return;
  }

  await interaction.editReply({
    content: `Purchase ticket opened: ${result.channel} (\`#${result.channel.name}\`). Please submit the hardware form there.`,
  });
}

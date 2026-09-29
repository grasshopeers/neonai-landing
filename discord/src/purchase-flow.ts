import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
  type Interaction,
  type Message,
  type ModalSubmitInteraction,
  type StringSelectMenuInteraction,
  type TextChannel,
} from "discord.js";
import { BRAND, brandEmbed } from "./brand.js";
import {
  CHANNELS,
  canBypassTicketLimits,
  findTextChannel,
  resolveRoleMap,
  staffRoles,
} from "./layout.js";
import { getBotRoleId, unlockCustomerInTicket } from "./ticket-channels.js";
import { parseTicketKind, parseTicketOpenerId } from "./ticket-guard.js";
import { staffTakesOverTicket } from "./ticket-handoff.js";
import {
  formatLifetimeRequirement,
  formatTierList,
  getTierDisplayName,
  getTierPrice,
  isLicenseTier,
  LICENSE_TIERS,
  type LicenseTier,
} from "./tiers.js";
import { KOFI_TIP_URL, PAYPAL_PAYMENT_URL, REMITLY_PAYMENT } from "./site.js";
import { resolveInteractionMember } from "./interaction-utils.js";

export const BUY_HW_BTN = "neonai_buy_hw";
export const BUY_HW_MODAL = "neonai_buy_hw_modal";
export const BUY_HW_GPU = "neonai_buy_hw_gpu";
export const BUY_HW_RAM = "neonai_buy_hw_ram";
export const BUY_HW_FPS = "neonai_buy_hw_fps";
export const BUY_APPROVE = "neonai_buy_approve";
export const BUY_DENY = "neonai_buy_deny";
export const BUY_UNMUTE_APPROVE = "neonai_buy_unmute_approve";
export const BUY_TIER_SELECT = "neonai_buy_tier";
const BUY_PAY_PREFIX = "neonai_buy_pay:";

export const PURCHASE_STAGE = {
  hw: "hw",
  review: "review",
  tier: "tier",
  open: "open",
} as const;

export function parsePurchaseStage(topic: string | null | undefined) {
  return topic?.match(/ · stage:([^\s]+)/)?.[1] ?? null;
}

export function isPurchaseChatLocked(channel: unknown) {
  if (!channel || typeof channel !== "object") return false;
  const c = channel as { name?: string; topic?: string | null };
  if (parseTicketKind(c.topic, c.name) !== "purchase") return false;
  const stage = parsePurchaseStage(c.topic);
  if (!stage) return false;
  return stage !== PURCHASE_STAGE.open;
}

export async function setPurchaseStage(
  channel: TextChannel,
  openerId: string,
  stage: string
) {
  const delivered = channel.topic?.includes(" · delivered") ? " · delivered" : "";
  const topic = `${BRAND.name} · Purchase · opened by <@${openerId}> · stage:${stage}${delivered}`;
  try {
    await channel.setTopic(topic);
  } catch (err) {
    console.error("Failed to set purchase ticket stage:", err);
  }
}

export async function markPurchaseDelivered(
  channel: { topic?: string | null; setTopic?: (topic: string) => Promise<unknown> },
  openerId: string
) {
  if (!channel.setTopic) return;
  const stage = parsePurchaseStage(channel.topic) ?? PURCHASE_STAGE.open;
  const topic = `${BRAND.name} · Purchase · opened by <@${openerId}> · stage:${stage} · delivered`;
  try {
    await channel.setTopic(topic);
  } catch (err) {
    console.error("Failed to mark purchase delivered:", err);
  }
}

/** Lift the purchase lock (or a staff override) and stop bot auto-replies. */
export async function unlockPurchaseCustomer(
  channel: import("discord.js").Message["channel"],
  openerId: string
) {
  if (channel.isTextBased() && !channel.isDMBased()) {
    const text = channel as TextChannel;
    if (parseTicketKind(text.topic, text.name) === "purchase") {
      await setPurchaseStage(text, openerId, PURCHASE_STAGE.open);
      await unlockCustomerInTicket(text, openerId);
    }
  }
  await staffTakesOverTicket(channel, channel.id, openerId);
}

function encodeTier(tier: LicenseTier) {
  return tier.replace(/\s+/g, "");
}

function decodeTier(raw: string): LicenseTier | null {
  const found = LICENSE_TIERS.find((t) => encodeTier(t.value) === raw);
  return found?.value ?? null;
}

function staffPing(guild: import("discord.js").Guild) {
  const roles = resolveRoleMap(guild);
  const ping = staffRoles(roles)
    .map((r) => `<@&${r.id}>`)
    .join(" ");
  return ping || undefined;
}

function asTicketChannel(
  channel: Interaction["channel"] | TextChannel | null
): TextChannel | null {
  if (!channel || !("name" in channel)) return null;
  if ("isThread" in channel && channel.isThread()) return null;
  if (!channel.isTextBased() || channel.isDMBased()) return null;
  const topic = "topic" in channel ? channel.topic : null;
  if (parseTicketKind(topic, channel.name) !== "purchase") return null;
  return channel as TextChannel;
}

/** Approve/Deny live in a private thread. The purchase channel is the parent. */
function purchaseTicketFrom(channel: Interaction["channel"]): TextChannel | null {
  if (!channel) return null;
  if ("isThread" in channel && channel.isThread()) {
    return asTicketChannel(channel.parent);
  }
  return asTicketChannel(channel);
}

async function requireStaff(interaction: Interaction) {
  if (!interaction.guild) return false;
  const member = await resolveInteractionMember(
    interaction as ButtonInteraction
  );
  return Boolean(member && canBypassTicketLimits(interaction.guild, member));
}

async function ensureStaffReviewAccess(channel: TextChannel) {
  const roles = resolveRoleMap(channel.guild);
  for (const role of staffRoles(roles)) {
    await channel.permissionOverwrites.edit(role.id, {
      ManageThreads: true,
      SendMessagesInThreads: true,
    });
  }

  const botRoleId = getBotRoleId(channel.guild);
  if (botRoleId) {
    await channel.permissionOverwrites.edit(botRoleId, {
      ManageThreads: true,
      CreatePrivateThreads: true,
      SendMessagesInThreads: true,
    });
  }

  const openerId = parseTicketOpenerId(channel.topic);
  if (openerId) {
    await channel.permissionOverwrites.edit(openerId, {
      ManageThreads: false,
      CreatePrivateThreads: false,
      SendMessagesInThreads: false,
    });
  }
}

async function postStaffHardwareReview(
  channel: TextChannel,
  openerId: string,
  gpu: string,
  ram: string,
  fps: string
) {
  await channel.send({
    embeds: [
      new EmbedBuilder()
        .setColor(BRAND.colors.crimson)
        .setTitle(`${BRAND.emoji.hardware} Hardware Received`)
        .setDescription(
          [
            `<@${openerId}> — thank you. We have received your hardware details.`,
            "",
            "A staff member will review them and follow up in this ticket.",
          ].join("\n")
        )
        .setFooter(brandEmbed().footer),
    ],
  });

  await ensureStaffReviewAccess(channel);

  const thread = await channel.threads.create({
    name: "Hardware review",
    type: ChannelType.PrivateThread,
    invitable: false,
    autoArchiveDuration: 1440,
    reason: "Staff-only purchase hardware review",
  });

  const customer = await channel.client.users.fetch(openerId).catch(() => null);
  const customerName = customer?.username ?? "Customer";
  const reviewEmbed = new EmbedBuilder()
    .setColor(BRAND.colors.crimson)
    .setTitle(`${BRAND.emoji.hardware} Hardware Review`)
    .setDescription(
      [
        `**${customerName}** submitted hardware for this purchase.`,
        "",
        `**GPU:** ${gpu}`,
        `**RAM:** ${ram}`,
        `**In-game FPS:** ${fps}`,
        "",
        "A staff member will **Approve** or **Deny** this request.",
        "Staff only — mentioning the customer adds them to this thread.",
      ].join("\n")
    )
    .setFooter(brandEmbed().footer);

  const reviewRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(BUY_APPROVE)
      .setLabel("Approve")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(BUY_DENY)
      .setLabel("Deny")
      .setStyle(ButtonStyle.Danger)
  );

  await addStaffToThread(channel, thread, openerId);

  await thread.send({
    content: staffPing(channel.guild),
    embeds: [reviewEmbed],
    components: [reviewRow],
  });

  const recent = await channel.messages.fetch({ limit: 8 }).catch(() => null);
  if (!recent) return;
  for (const msg of recent.values()) {
    if (!msg.system) continue;
    if (Date.now() - msg.createdTimestamp > 20_000) continue;
    await msg.delete().catch(() => undefined);
  }
}

function isOpener(interaction: Interaction, openerId: string | null) {
  return Boolean(openerId && interaction.user.id === openerId);
}

async function disableCustomIds(message: Message | null | undefined, customIds: string[]) {
  if (!message) return;
  const ids = new Set(customIds);
  const components = message.components.map((row) => {
    const json = row.toJSON() as {
      type: number;
      components?: Array<{ custom_id?: string; disabled?: boolean }>;
    };
    if (!json.components) return json;
    return {
      ...json,
      components: json.components.map((c) =>
        c.custom_id && ids.has(c.custom_id) ? { ...c, disabled: true } : c
      ),
    };
  });
  await message
    .edit({ components: components as never })
    .catch(() => undefined);
}

export function buildHardwareFormRow(channelId: string) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(BUY_HW_BTN)
      .setLabel("Fill Hardware Form")
      .setStyle(ButtonStyle.Danger)
      .setEmoji(BRAND.emoji.hardware),
    new ButtonBuilder()
      .setCustomId(`neonai_close_ticket:${channelId}`)
      .setLabel("Close Ticket")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji(BRAND.emoji.close)
  );
}

export function isPurchaseFlowInteraction(interaction: Interaction) {
  if (interaction.isModalSubmit() && interaction.customId === BUY_HW_MODAL) {
    return true;
  }
  if (
    interaction.isStringSelectMenu() &&
    interaction.customId === BUY_TIER_SELECT
  ) {
    return true;
  }
  if (!interaction.isButton()) return false;
  const id = interaction.customId;
  return (
    id === BUY_HW_BTN ||
    id === BUY_APPROVE ||
    id === BUY_DENY ||
    id === BUY_UNMUTE_APPROVE ||
    id.startsWith(`${BUY_UNMUTE_APPROVE}:`) ||
    id.startsWith(`${BUY_TIER_SELECT}:`) ||
    id.startsWith(BUY_PAY_PREFIX)
  );
}

export async function handlePurchaseFlowInteraction(interaction: Interaction) {
  if (interaction.isButton() && interaction.customId === BUY_HW_BTN) {
    await handleHardwareButton(interaction);
    return;
  }
  if (interaction.isModalSubmit() && interaction.customId === BUY_HW_MODAL) {
    await handleHardwareModal(interaction);
    return;
  }
  if (interaction.isButton() && interaction.customId === BUY_APPROVE) {
    await handleApprove(interaction);
    return;
  }
  if (interaction.isButton() && interaction.customId === BUY_DENY) {
    await handleDeny(interaction);
    return;
  }
  if (
    interaction.isButton() &&
    (interaction.customId === BUY_UNMUTE_APPROVE ||
      interaction.customId.startsWith(`${BUY_UNMUTE_APPROVE}:`))
  ) {
    await handleUnmuteApprove(interaction);
    return;
  }
  if (
    interaction.isButton() &&
    interaction.customId.startsWith(`${BUY_TIER_SELECT}:`)
  ) {
    await handleTierChoice(interaction, interaction.customId.split(":")[1] ?? "");
    return;
  }
  if (
    interaction.isStringSelectMenu() &&
    interaction.customId === BUY_TIER_SELECT
  ) {
    await handleTierSelect(interaction);
    return;
  }
  if (interaction.isButton() && interaction.customId.startsWith(BUY_PAY_PREFIX)) {
    await handlePayMethod(interaction);
  }
}

async function handleHardwareButton(interaction: ButtonInteraction) {
  const channel = asTicketChannel(interaction.channel);
  if (!channel) {
    await interaction.reply({
      content: "Use this button in your purchase ticket.",
      ephemeral: true,
    });
    return;
  }

  const openerId = parseTicketOpenerId(channel.topic);
  if (!isOpener(interaction, openerId)) {
    await interaction.reply({
      content: "Only the customer who opened this ticket can fill the form.",
      ephemeral: true,
    });
    return;
  }

  const stage = parsePurchaseStage(channel.topic);
  if (stage && stage !== PURCHASE_STAGE.hw) {
    await interaction.reply({
      content: "Hardware was already submitted in this ticket.",
      ephemeral: true,
    });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId(BUY_HW_MODAL)
    .setTitle("Hardware specs")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId(BUY_HW_GPU)
          .setLabel("GPU")
          .setPlaceholder("e.g. RTX 4070 / RX 6700 XT")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(80)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId(BUY_HW_RAM)
          .setLabel("RAM")
          .setPlaceholder("e.g. 16 GB")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(40)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId(BUY_HW_FPS)
          .setLabel("In-game FPS")
          .setPlaceholder("e.g. 240")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(40)
      )
    );

  await interaction.showModal(modal);
}

async function handleHardwareModal(interaction: ModalSubmitInteraction) {
  const channel = asTicketChannel(interaction.channel);
  if (!channel) {
    await interaction.reply({
      content: "Use this form in your purchase ticket.",
      ephemeral: true,
    });
    return;
  }

  const openerId = parseTicketOpenerId(channel.topic);
  if (!isOpener(interaction, openerId) || !openerId) {
    await interaction.reply({
      content: "Only the customer who opened this ticket can submit this form.",
      ephemeral: true,
    });
    return;
  }

  const stage = parsePurchaseStage(channel.topic);
  if (stage && stage !== PURCHASE_STAGE.hw) {
    await interaction.reply({
      content: "Hardware was already submitted in this ticket.",
      ephemeral: true,
    });
    return;
  }

  const gpu = interaction.fields.getTextInputValue(BUY_HW_GPU).trim();
  const ram = interaction.fields.getTextInputValue(BUY_HW_RAM).trim();
  const fps = interaction.fields.getTextInputValue(BUY_HW_FPS).trim();

  await interaction.deferReply({ ephemeral: true });

  await setPurchaseStage(channel, openerId, PURCHASE_STAGE.review);
  let formMessage: Message | null = null;
  if (interaction.message?.id) {
    formMessage = await channel.messages
      .fetch(interaction.message.id)
      .catch(() => null);
  }
  if (!formMessage) {
    formMessage = await findMessageWithButton(channel, BUY_HW_BTN);
  }
  await disableCustomIds(formMessage, [BUY_HW_BTN]);
  await postStaffHardwareReview(channel, openerId, gpu, ram, fps);

  await interaction.editReply({
    content:
      "Hardware submitted. A staff member will review it shortly.",
  });
}

async function findMessageWithButton(channel: TextChannel, customId: string) {
  const messages = await channel.messages.fetch({ limit: 25 }).catch(() => null);
  if (!messages) return null;
  return (
    messages.find((msg) =>
      msg.components.some((row) => {
        if (!("components" in row)) return false;
        return (row.components as { customId?: string }[]).some(
          (c) => c.customId === customId
        );
      })
    ) ?? null
  );
}

async function handleApprove(interaction: ButtonInteraction) {
  const channel = purchaseTicketFrom(interaction.channel);
  if (!channel) {
    await interaction.reply({
      content: "This action only works in a purchase ticket.",
      ephemeral: true,
    });
    return;
  }

  if (!(await requireStaff(interaction))) {
    await interaction.reply({
      content: "Only staff can approve this purchase.",
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

  await interaction.deferUpdate();
  await disableCustomIds(interaction.message, [BUY_APPROVE, BUY_DENY]);
  await setPurchaseStage(channel, openerId, PURCHASE_STAGE.tier);

  const embed = new EmbedBuilder()
    .setColor(BRAND.colors.crimson)
    .setTitle(`${BRAND.emoji.purchase} Choose a License`)
    .setDescription(
      [
        `<@${openerId}> — your hardware was approved. Choose a license:`,
        "",
        formatTierList(),
        "",
        formatLifetimeRequirement(),
      ].join("\n")
    )
    .setFooter(brandEmbed().footer);

  await channel.send({
    content: `<@${openerId}>`,
    embeds: [embed],
    components: [buildTierButtonRow()],
  });
}

async function handleDeny(interaction: ButtonInteraction) {
  const channel = purchaseTicketFrom(interaction.channel);
  if (!channel) {
    await interaction.reply({
      content: "This action only works in a purchase ticket.",
      ephemeral: true,
    });
    return;
  }

  if (!(await requireStaff(interaction))) {
    await interaction.reply({
      content: "Only staff can deny this purchase.",
      ephemeral: true,
    });
    return;
  }

  const openerId = parseTicketOpenerId(channel.topic);

  await interaction.deferUpdate();
  await disableCustomIds(interaction.message, [BUY_APPROVE, BUY_DENY]);

  const embed = new EmbedBuilder()
    .setColor(BRAND.colors.ruby)
    .setTitle(`${BRAND.emoji.ticket} Purchase Denied`)
    .setDescription(
      [
        openerId
          ? `<@${openerId}> — we are unable to approve this purchase based on the hardware provided.`
          : "We are unable to approve this purchase based on the hardware provided.",
        "",
        `Kindly open a **Compatibility** ticket in **#${CHANNELS.ticket}** if you would like to discuss this further.`,
      ].join("\n")
    )
    .setFooter(brandEmbed().footer);

  await channel.send({
    content: openerId ? `<@${openerId}>` : undefined,
    embeds: [embed],
  });
}

function buildTierButtonRow() {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    LICENSE_TIERS.map((tier) =>
      new ButtonBuilder()
        .setCustomId(`${BUY_TIER_SELECT}:${encodeTier(tier.value)}`)
        .setLabel(`${tier.name} · $${tier.price}`)
        .setStyle(
          tier.value === "Lifetime" ? ButtonStyle.Success : ButtonStyle.Secondary
        )
    )
  );
}

async function freshPurchaseChannel(channel: TextChannel | null) {
  if (!channel) return null;
  const fetched = await channel.guild.channels.fetch(channel.id).catch(() => null);
  return asTicketChannel(fetched) ?? channel;
}

export async function offerPaymentMethods(
  channel: TextChannel,
  openerId: string,
  tier: LicenseTier
) {
  const price = getTierPrice(tier);
  if (price == null) return;

  const embed = new EmbedBuilder()
    .setColor(BRAND.colors.crimson)
    .setTitle(`${BRAND.emoji.purchase} Payment Method`)
    .setDescription(
      [
        `<@${openerId}> — you selected **${getTierDisplayName(tier)}** (**$${price} USD**).`,
        "",
        "Choose how you want to pay:",
        "• **Ko-fi / card** — one-time tip (credit or debit)",
        "• **Remitly** — bank deposit",
        "• **PayPal** — send the exact amount",
      ].join("\n")
    )
    .setFooter(brandEmbed().footer);

  await channel.send({
    content: `<@${openerId}>`,
    embeds: [embed],
    components: [buildPayButtonRow(tier)],
  });
  void setPurchaseStage(channel, openerId, `pay:${encodeTier(tier)}`);
}

function buildPayButtonRow(tier: LicenseTier) {
  const encoded = encodeTier(tier);
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${BUY_PAY_PREFIX}kofi:${encoded}`)
      .setLabel("Ko-fi / Card")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`${BUY_PAY_PREFIX}remitly:${encoded}`)
      .setLabel("Remitly")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`${BUY_PAY_PREFIX}paypal:${encoded}`)
      .setLabel("PayPal")
      .setStyle(ButtonStyle.Primary)
  );
}

async function addStaffToThread(channel: TextChannel, thread: { members: { add: (id: string) => Promise<unknown> } }, openerId: string) {
  const staffRoleIds = new Set(staffRoles(resolveRoleMap(channel.guild)).map((role) => role.id));
  await channel.guild.members.fetch().catch(() => null);
  for (const member of channel.guild.members.cache.values()) {
    if (member.user.bot || member.id === openerId) continue;
    const onStaff = member.roles.cache.some((role) => staffRoleIds.has(role.id));
    const isOwner = member.id === channel.guild.ownerId;
    if (!onStaff && !isOwner) continue;
    await thread.members.add(member.id).catch(() => undefined);
  }
}

async function alertStaff(channel: TextChannel, text: string) {
  const staffChat = findTextChannel(channel.guild, CHANNELS.staffChat);
  const content = `${staffPing(channel.guild) ?? ""} ${text}`.trim();
  if (staffChat?.isTextBased()) {
    await staffChat.send({ content }).catch(() => undefined);
    return;
  }
  console.error("Staff chat missing:", text);
}

async function requestStaffUnmute(
  channel: TextChannel,
  openerId: string,
  method: string,
  tier: LicenseTier
) {
  const methodLabel =
    method === "kofi" ? "Ko-fi / card" : method === "remitly" ? "Remitly" : "PayPal";
  const embed = new EmbedBuilder()
    .setColor(BRAND.colors.ruby)
    .setTitle(`${BRAND.emoji.ticket} Unmute request`)
    .setDescription(
      [
        `<@${openerId}> chose **${methodLabel}** for **${getTierDisplayName(tier)}** ($${getTierPrice(tier)}).`,
        "",
        "They need to send a **payment screenshot** in this ticket.",
        "If they still cannot type, click **Allow messages**.",
      ].join("\n")
    )
    .setFooter(brandEmbed().footer);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${BUY_UNMUTE_APPROVE}:${channel.id}`)
      .setLabel("Allow messages")
      .setStyle(ButtonStyle.Success)
  );

  const staffChat = findTextChannel(channel.guild, CHANNELS.staffChat);
  if (!staffChat?.isTextBased()) {
    console.error("Staff chat missing for unmute request");
    return;
  }
  await staffChat.send({
    content: `${staffPing(channel.guild) ?? ""} <#${channel.id}>`.trim(),
    embeds: [embed],
    components: [row],
  });
}

async function handleUnmuteApprove(interaction: ButtonInteraction) {
  const ticketId = interaction.customId.split(":")[1];
  const fromId = ticketId
    ? await interaction.guild?.channels.fetch(ticketId).catch(() => null)
    : null;
  const channel =
    fromId && fromId.isTextBased() && !fromId.isDMBased()
      ? asTicketChannel(fromId as TextChannel) ?? purchaseTicketFrom(interaction.channel)
      : purchaseTicketFrom(interaction.channel);
  if (!channel) {
    await interaction.reply({
      content: "This action only works in a purchase ticket.",
      ephemeral: true,
    });
    return;
  }

  if (!(await requireStaff(interaction))) {
    await interaction.reply({
      content: "Only staff can allow customer messages.",
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

  await interaction.deferUpdate();
  await disableCustomIds(interaction.message, [
    BUY_UNMUTE_APPROVE,
    interaction.customId,
  ]);

  try {
    await unlockCustomerInTicket(channel, openerId);
    await setPurchaseStage(channel, openerId, PURCHASE_STAGE.open);
  } catch (err) {
    console.error("Staff unmute approve failed:", err);
    await interaction.followUp({
      content: "Could not unlock this ticket — check the bot has **Manage Channels** here.",
      ephemeral: true,
    });
    return;
  }

  await channel.send({
    content: `<@${openerId}>`,
    embeds: [
      new EmbedBuilder()
        .setColor(BRAND.colors.crimson)
        .setTitle(`${BRAND.emoji.purchase} You can send your screenshot now`)
        .setDescription(
          [
            `<@${openerId}> — staff approved messages in this ticket.`,
            "",
            "Send your payment screenshot here when ready.",
          ].join("\n")
        )
        .setFooter(brandEmbed().footer),
    ],
  });
}

async function handleTierChoice(
  interaction: ButtonInteraction | StringSelectMenuInteraction,
  encoded: string
) {
  const channel = await freshPurchaseChannel(asTicketChannel(interaction.channel));
  if (!channel) {
    await interaction.reply({
      content: "Use this in your purchase ticket.",
      ephemeral: true,
    });
    return;
  }

  const openerId = parseTicketOpenerId(channel.topic);
  if (!isOpener(interaction, openerId) || !openerId) {
    await interaction.reply({
      content: "Only the customer who opened this ticket can pick a license.",
      ephemeral: true,
    });
    return;
  }

  const stage = parsePurchaseStage(channel.topic);
  if (stage === PURCHASE_STAGE.hw || stage === PURCHASE_STAGE.open) {
    await interaction.reply({
      content: "License selection is not open on this ticket.",
      ephemeral: true,
    });
    return;
  }

  const tier = decodeTier(encoded);
  if (!tier || !isLicenseTier(tier)) {
    await interaction.reply({
      content: "Invalid license selection. Try again.",
      ephemeral: true,
    });
    return;
  }

  await interaction.deferUpdate();
  try {
    await offerPaymentMethods(channel, openerId, tier);
  } catch (err) {
    console.error("Purchase payment step failed:", err);
    if (interaction.message) {
      await interaction.message
        .edit({ components: [buildTierButtonRow()] })
        .catch(() => undefined);
    }
    await channel.send({
      content: `<@${openerId}>`,
      embeds: [
        new EmbedBuilder()
          .setColor(BRAND.colors.ruby)
          .setTitle(`${BRAND.emoji.purchase} Please choose a license again`)
          .setDescription(
            [
              "That selection did not go through.",
              "",
              "Tap your license again. Staff have been notified in this ticket.",
            ].join("\n")
          )
          .setFooter(brandEmbed().footer),
      ],
      components: [buildTierButtonRow()],
    });
    await alertStaff(
      channel,
      `<@${openerId}> tried to choose **${getTierDisplayName(tier)}**, but the payment step did not post.`
    );
    return;
  }

  await disableCustomIds(interaction.message, [
    BUY_TIER_SELECT,
    ...LICENSE_TIERS.map((item) => `${BUY_TIER_SELECT}:${encodeTier(item.value)}`),
  ]);
  await alertStaff(
    channel,
    `<@${openerId}> selected **${getTierDisplayName(tier)}** ($${getTierPrice(tier)}) in <#${channel.id}>. Payment buttons are in that ticket. If those buttons do nothing, run **/kofi**, **/remitly**, **/paypal**, or **/unmute** there.`
  );
}

async function handleTierSelect(interaction: StringSelectMenuInteraction) {
  await handleTierChoice(interaction, interaction.values[0] ?? "");
}

async function handlePayMethod(interaction: ButtonInteraction) {
  const channel = asTicketChannel(interaction.channel);
  if (!channel) {
    await interaction.reply({
      content: "Use this button in your purchase ticket.",
      ephemeral: true,
    });
    return;
  }

  const openerId = parseTicketOpenerId(channel.topic);
  if (!isOpener(interaction, openerId) || !openerId) {
    await interaction.reply({
      content: "Only the customer who opened this ticket can pick a payment method.",
      ephemeral: true,
    });
    return;
  }

  const parts = interaction.customId.split(":");
  const method = parts[1];
  const encodedTier = parts[2] ?? "";
  const tier = decodeTier(encodedTier);
  if (!tier || !["kofi", "remitly", "paypal"].includes(method ?? "")) {
    await interaction.reply({
      content: "Invalid payment option. Ask staff to continue.",
      ephemeral: true,
    });
    return;
  }

  const stage = parsePurchaseStage(channel.topic);
  if (stage === PURCHASE_STAGE.hw) {
    await interaction.reply({
      content: "Choose a license before payment.",
      ephemeral: true,
    });
    return;
  }

  const price = getTierPrice(tier);
  if (price == null) {
    await interaction.reply({
      content: "Could not resolve the price for that tier.",
      ephemeral: true,
    });
    return;
  }

  const payIds = [
    `${BUY_PAY_PREFIX}kofi:${encodedTier}`,
    `${BUY_PAY_PREFIX}remitly:${encodedTier}`,
    `${BUY_PAY_PREFIX}paypal:${encodedTier}`,
  ];

  await interaction.deferUpdate();

  const payEmbed = buildPaymentEmbed(method!, openerId, tier, price);
  const pingStaff = method === "paypal" && !PAYPAL_PAYMENT_URL;

  try {
    await channel.send({
      content: pingStaff
        ? `${staffPing(interaction.guild!) ?? ""} <@${openerId}>`.trim()
        : `<@${openerId}>`,
      embeds: [payEmbed],
    });
  } catch (err) {
    console.error("Payment details failed:", err);
    await interaction.message
      .edit({ components: [buildPayButtonRow(tier)] })
      .catch(() => undefined);
    await channel.send({
      content: `<@${openerId}>`,
      embeds: [
        new EmbedBuilder()
          .setColor(BRAND.colors.ruby)
          .setTitle(`${BRAND.emoji.purchase} Please choose a payment method again`)
          .setDescription(
            "That payment option did not go through. Tap it again. Staff have been notified."
          )
          .setFooter(brandEmbed().footer),
      ],
    });
    await alertStaff(
      channel,
      `<@${openerId}> picked **${method}** for **${getTierDisplayName(tier)}** in <#${channel.id}>, but the payment card did not post. If they stay stuck, run **/kofi**, **/remitly**, **/paypal**, or **/unmute** in that ticket.`
    );
    return;
  }

  await disableCustomIds(interaction.message, payIds);

  let unlocked = false;
  try {
    await unlockCustomerInTicket(channel, openerId);
    unlocked = true;
  } catch (err) {
    console.error("Auto-unlock failed after payment:", err);
  }

  await requestStaffUnmute(channel, openerId, method!, tier);
  await channel.send({
    content: `<@${openerId}>`,
    embeds: [
      new EmbedBuilder()
        .setColor(unlocked ? BRAND.colors.crimson : BRAND.colors.ruby)
        .setTitle(`${BRAND.emoji.purchase} Send your payment screenshot`)
        .setDescription(
          unlocked
            ? [
                `<@${openerId}> — after you pay, send your screenshot in this ticket.`,
                "",
                "If the message box is still locked, staff can tap **Allow messages** in **#┃staff-chat**.",
              ].join("\n")
            : [
                `<@${openerId}> — after you pay, staff need to enable messages in this ticket.`,
                "",
                "You will be pinged here once you can send the screenshot.",
              ].join("\n")
        )
        .setFooter(brandEmbed().footer),
    ],
  });
}

function paymentCard(
  title: string,
  openerId: string,
  tier: LicenseTier,
  price: number,
  howToPay: string
) {
  return new EmbedBuilder()
    .setColor(BRAND.colors.crimson)
    .setTitle(`${BRAND.emoji.purchase} ${title}`)
    .setDescription(`<@${openerId}> · **${getTierDisplayName(tier)}** license`)
    .addFields(
      { name: "Amount", value: `**$${price} USD**`, inline: true },
      { name: "How to pay", value: howToPay },
      {
        name: "After you pay",
        value:
          "Send a screenshot of the payment in this ticket. Your license key will be sent here once staff confirms it.",
      }
    )
    .setFooter(brandEmbed().footer);
}

function buildPaymentEmbed(
  method: string,
  openerId: string,
  tier: LicenseTier,
  price: number
) {
  if (method === "kofi") {
    return paymentCard(
      "Ko-fi / Card",
      openerId,
      tier,
      price,
      `[Open Ko-fi](${KOFI_TIP_URL})\nLeave a one-time tip for the amount above. Credit and debit cards work on Ko-fi.`
    );
  }

  if (method === "remitly") {
    const r = REMITLY_PAYMENT;
    return paymentCard(
      "Remitly",
      openerId,
      tier,
      price,
      [
        `**${r.mode}** · ${r.country}`,
        `**Bank:** ${r.bank}`,
        `**Name:** ${r.name}`,
        `**IBAN:** \`${r.ibanDisplay}\``,
        `**Phone:** ${r.phone}`,
      ].join("\n")
    );
  }

  const paypalLink = PAYPAL_PAYMENT_URL
    ? `[Pay with PayPal](${PAYPAL_PAYMENT_URL})`
    : "Staff will post the PayPal link in this ticket in a moment.";

  return paymentCard("PayPal", openerId, tier, price, paypalLink);
}

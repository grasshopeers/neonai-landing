import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  ModalBuilder,
  StringSelectMenuBuilder,
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
import {
  findReferralCode,
  isReferralCode,
  normalizeReferralCode,
  queueReferralPurchase,
} from "./referral-store.js";

export const BUY_HW_BTN = "neonai_buy_hw";
export const BUY_HW_MODAL = "neonai_buy_hw_modal";
export const BUY_HW_GPU = "neonai_buy_hw_gpu";
export const BUY_HW_RAM = "neonai_buy_hw_ram";
export const BUY_HW_FPS = "neonai_buy_hw_fps";
export const BUY_APPROVE = "neonai_buy_approve";
export const BUY_DENY = "neonai_buy_deny";
export const BUY_UNMUTE_APPROVE = "neonai_buy_unmute_approve";
export const BUY_TIER_SELECT = "neonai_buy_tier";
const BUY_CHECKOUT_TIER = "neonai_buy_checkout_tier";
const BUY_CHECKOUT_SOURCE = "neonai_buy_checkout_source";
const BUY_CHECKOUT_GO = "neonai_buy_checkout_go";
const BUY_CHECKOUT_MODAL = "neonai_buy_checkout_modal:";
const BUY_CHECKOUT_CODE = "neonai_buy_checkout_code";
const BUY_CHECKOUT_CODE_BTN = "neonai_buy_checkout_codebtn";
const BUY_CHECKOUT_CODE_MODAL = "neonai_buy_checkout_code_modal";
const REF_USE_YES = "neonai_ref_use_yes:";
const REF_USE_NO = "neonai_ref_use_no:";
const BUY_PAY_PREFIX = "neonai_buy_pay:";

const HEARD_ABOUT = [
  { value: "youtube", label: "YouTube" },
  { value: "tiktok", label: "TikTok" },
  { value: "ingame", label: "In game" },
  { value: "referred", label: "Someone referred them" },
] as const;

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
  if (interaction.isModalSubmit()) {
    return (
      interaction.customId === BUY_HW_MODAL ||
      interaction.customId === BUY_CHECKOUT_CODE_MODAL ||
      interaction.customId.startsWith(BUY_CHECKOUT_MODAL)
    );
  }
  if (interaction.isStringSelectMenu()) {
    return (
      interaction.customId === BUY_TIER_SELECT ||
      interaction.customId === BUY_CHECKOUT_TIER ||
      interaction.customId === BUY_CHECKOUT_SOURCE
    );
  }
  if (!interaction.isButton()) return false;
  const id = interaction.customId;
  return (
    id === BUY_HW_BTN ||
    id === BUY_APPROVE ||
    id === BUY_DENY ||
    id === BUY_UNMUTE_APPROVE ||
    id === BUY_CHECKOUT_GO ||
    id === BUY_CHECKOUT_CODE_BTN ||
    id.startsWith(`${BUY_CHECKOUT_CODE_BTN}:`) ||
    id.startsWith(`${BUY_UNMUTE_APPROVE}:`) ||
    id.startsWith(`${BUY_TIER_SELECT}:`) ||
    id.startsWith(BUY_PAY_PREFIX) ||
    id.startsWith(REF_USE_YES) ||
    id.startsWith(REF_USE_NO)
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
  if (
    interaction.isStringSelectMenu() &&
    (interaction.customId === BUY_CHECKOUT_TIER ||
      interaction.customId === BUY_CHECKOUT_SOURCE)
  ) {
    await rememberCheckoutSelect(interaction);
    return;
  }
  if (
    interaction.isButton() &&
    (interaction.customId === BUY_CHECKOUT_CODE_BTN ||
      interaction.customId.startsWith(`${BUY_CHECKOUT_CODE_BTN}:`))
  ) {
    await handleCheckoutCodeButton(interaction);
    return;
  }
  if (interaction.isModalSubmit() && interaction.customId === BUY_CHECKOUT_CODE_MODAL) {
    await handleCheckoutCodeModal(interaction);
    return;
  }
  if (interaction.isButton() && interaction.customId === BUY_CHECKOUT_GO) {
    await handleCheckoutContinue(interaction);
    return;
  }
  if (
    interaction.isModalSubmit() &&
    interaction.customId.startsWith(BUY_CHECKOUT_MODAL)
  ) {
    await handleCheckoutModal(interaction);
    return;
  }
  if (interaction.isButton() && interaction.customId.startsWith(REF_USE_YES)) {
    await handleReferralUse(interaction, true);
    return;
  }
  if (interaction.isButton() && interaction.customId.startsWith(REF_USE_NO)) {
    await handleReferralUse(interaction, false);
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
  await unlockCustomerInTicket(channel, openerId).catch((err) => {
    console.error("Could not unlock purchase chat after hardware:", err);
  });

  await interaction.editReply({
    content: "Hardware submitted. You can type in this ticket. A staff member will review it shortly.",
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
        `<@${openerId}> — your hardware was approved.`,
        "",
        "Choose a license. A referral code is optional and is asked above where you heard about NeonAi.",
        "Leave the code blank to pay the full price.",
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
    components: buildCheckoutComponents(),
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

function formatMoney(amount: number) {
  return Number.isInteger(amount) ? `$${amount}` : `$${amount.toFixed(2)}`;
}

function discountCents(priceUsd: number) {
  return Math.round(priceUsd * 90);
}

function heardLabel(value: string | null) {
  return HEARD_ABOUT.find((item) => item.value === value)?.label ?? "Not provided";
}

function buildCheckoutComponents(
  tierValue?: string | null,
  sourceValue?: string | null,
  code?: string | null
) {
  const license = new StringSelectMenuBuilder()
    .setCustomId(BUY_CHECKOUT_TIER)
    .setPlaceholder("License")
    .addOptions(
      LICENSE_TIERS.map((tier) => ({
        label: `${tier.name} · $${tier.price}`,
        value: encodeTier(tier.value),
        default: tierValue === encodeTier(tier.value),
      }))
    );

  const codeButton = new ButtonBuilder()
    .setCustomId(code ? `${BUY_CHECKOUT_CODE_BTN}:${code}` : BUY_CHECKOUT_CODE_BTN)
    .setLabel(code ? `Referral code: ${code}` : "Referral code (optional)")
    .setStyle(code ? ButtonStyle.Success : ButtonStyle.Secondary);

  const source = new StringSelectMenuBuilder()
    .setCustomId(BUY_CHECKOUT_SOURCE)
    .setPlaceholder("Where did you hear about NeonAi?")
    .addOptions(
      HEARD_ABOUT.map((item) => ({
        label: item.label,
        value: item.value,
        default: sourceValue === item.value,
      }))
    );

  const go = new ButtonBuilder()
    .setCustomId(BUY_CHECKOUT_GO)
    .setLabel("Continue")
    .setStyle(ButtonStyle.Danger);

  return [
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(license),
    new ActionRowBuilder<ButtonBuilder>().addComponents(codeButton),
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(source),
    new ActionRowBuilder<ButtonBuilder>().addComponents(go),
  ];
}

function selectedMenuValue(message: Message, customId: string) {
  for (const row of message.components) {
    const json = row.toJSON() as {
      components?: { custom_id?: string; options?: { value: string; default?: boolean }[] }[];
    };
    for (const component of json.components ?? []) {
      if (component.custom_id !== customId) continue;
      return component.options?.find((option) => option.default)?.value ?? null;
    }
  }
  return null;
}

async function rememberCheckoutSelect(interaction: StringSelectMenuInteraction) {
  const channel = asTicketChannel(interaction.channel);
  const openerId = parseTicketOpenerId(channel?.topic);
  if (!channel || !isOpener(interaction, openerId)) {
    await interaction.reply({
      content: "Only the customer who opened this ticket can use this.",
      ephemeral: true,
    });
    return;
  }
  const tier =
    interaction.customId === BUY_CHECKOUT_TIER
      ? interaction.values[0]
      : selectedMenuValue(interaction.message, BUY_CHECKOUT_TIER);
  const source =
    interaction.customId === BUY_CHECKOUT_SOURCE
      ? interaction.values[0]
      : selectedMenuValue(interaction.message, BUY_CHECKOUT_SOURCE);
  await interaction.update({
    components: buildCheckoutComponents(tier, source, selectedReferralCode(interaction.message)),
  });
}

function selectedReferralCode(message: Message) {
  for (const row of message.components) {
    const json = row.toJSON() as { components?: { custom_id?: string }[] };
    for (const component of json.components ?? []) {
      const id = component.custom_id ?? "";
      if (!id.startsWith(`${BUY_CHECKOUT_CODE_BTN}:`)) continue;
      const code = id.slice(BUY_CHECKOUT_CODE_BTN.length + 1);
      return isReferralCode(code) ? code : null;
    }
  }
  return null;
}

async function handleCheckoutCodeButton(interaction: ButtonInteraction) {
  const channel = asTicketChannel(interaction.channel);
  const openerId = parseTicketOpenerId(channel?.topic);
  if (!channel || !isOpener(interaction, openerId)) {
    await interaction.reply({
      content: "Only the customer who opened this ticket can use this.",
      ephemeral: true,
    });
    return;
  }
  const modal = new ModalBuilder()
    .setCustomId(BUY_CHECKOUT_CODE_MODAL)
    .setTitle("Referral code")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId(BUY_CHECKOUT_CODE)
          .setLabel("Referral code")
          .setPlaceholder("Optional. 6 letters or numbers")
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMaxLength(6)
      )
    );
  await interaction.showModal(modal);
}

async function handleCheckoutCodeModal(interaction: ModalSubmitInteraction) {
  const channel = asTicketChannel(interaction.channel);
  const openerId = parseTicketOpenerId(channel?.topic);
  if (!channel || !openerId || !isOpener(interaction, openerId) || !interaction.message) {
    await interaction.reply({
      content: "Only the customer who opened this ticket can use this.",
      ephemeral: true,
    });
    return;
  }
  const raw = interaction.fields.getTextInputValue(BUY_CHECKOUT_CODE).trim();
  const code = raw ? normalizeReferralCode(raw) : null;
  if (code && !isReferralCode(code)) {
    await interaction.reply({
      content: "A referral code must be exactly 6 letters or numbers, or leave it blank.",
      ephemeral: true,
    });
    return;
  }
  const tier = selectedMenuValue(interaction.message, BUY_CHECKOUT_TIER);
  const source = selectedMenuValue(interaction.message, BUY_CHECKOUT_SOURCE);
  await interaction.update({
    components: buildCheckoutComponents(tier, source, code),
  });
}

async function handleCheckoutContinue(interaction: ButtonInteraction) {
  const channel = asTicketChannel(interaction.channel);
  const openerId = parseTicketOpenerId(channel?.topic);
  if (!channel || !isOpener(interaction, openerId)) {
    await interaction.reply({
      content: "Only the customer who opened this ticket can continue.",
      ephemeral: true,
    });
    return;
  }
  const tierEncoded = selectedMenuValue(interaction.message, BUY_CHECKOUT_TIER);
  if (!tierEncoded || !decodeTier(tierEncoded)) {
    await interaction.reply({
      content: "Choose a license first.",
      ephemeral: true,
    });
    return;
  }
  const source = selectedMenuValue(interaction.message, BUY_CHECKOUT_SOURCE) ?? "none";
  const rawCode = selectedReferralCode(interaction.message);
  const tier = decodeTier(tierEncoded)!;
  if (!rawCode) {
    await interaction.deferUpdate();
    await disableCustomIds(interaction.message, [BUY_CHECKOUT_GO]);
    await offerPaymentMethods(channel, openerId!, tier);
    return;
  }
  await postReferralCheck(interaction, channel, openerId!, tier, rawCode, source === "none" ? null : source);
}

async function postReferralCheck(
  interaction: ButtonInteraction | ModalSubmitInteraction,
  channel: TextChannel,
  openerId: string,
  tier: LicenseTier,
  code: string,
  source: string | null
) {
  const staffChannel = findTextChannel(channel.guild, CHANNELS.referRequests);
  if (!staffChannel?.isTextBased()) {
    await interaction.reply({
      content: "Referral checks are unavailable. Clear the code to pay the full price.",
      ephemeral: true,
    });
    return;
  }

  await interaction.deferUpdate();
  if (interaction.message) await disableCustomIds(interaction.message, [BUY_CHECKOUT_GO]);

  const full = getTierPrice(tier) ?? 0;
  const cents = discountCents(full);
  const known = findReferralCode(code);
  const ping = staffPing(channel.guild);
  await staffChannel.send({
    content: `${ping ?? ""} <#${channel.id}>`.trim(),
    embeds: [
      new EmbedBuilder()
        .setColor(BRAND.colors.crimson)
        .setTitle("Referral code check")
        .setDescription(
          [
            `**Buyer:** <@${openerId}>`,
            `**License:** ${getTierDisplayName(tier)}`,
            `**Code:** \`${code}\``,
            `**Heard about NeonAi:** ${heardLabel(source)}`,
            `**Ticket:** <#${channel.id}>`,
            known?.status === "approved"
              ? "**Record:** this code was approved before."
              : "**Record:** no approved code is on file. Confirm it yourself.",
            "",
            "Allow the 10% discount, or disallow the code.",
          ].join("\n")
        )
        .setFooter(brandEmbed().footer),
    ],
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`${REF_USE_YES}${channel.id}:${encodeTier(tier)}:${code}:${cents}:${source ?? "none"}`)
          .setLabel("Allow")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`${REF_USE_NO}${channel.id}:${encodeTier(tier)}:${code}:${source ?? "none"}`)
          .setLabel("Disallow")
          .setStyle(ButtonStyle.Danger)
      ),
    ],
  });

  await channel.send({
    content: `<@${openerId}>`,
    embeds: [
      new EmbedBuilder()
        .setColor(BRAND.colors.crimson)
        .setTitle(`${BRAND.emoji.purchase} Referral code received`)
        .setDescription(
          `<@${openerId}> — staff are checking **${code}**. The amount to pay will be posted in this ticket.`
        )
        .setFooter(brandEmbed().footer),
    ],
  });
}

async function handleCheckoutModal(interaction: ModalSubmitInteraction) {
  const channel = asTicketChannel(interaction.channel);
  const openerId = parseTicketOpenerId(channel?.topic);
  if (!channel || !openerId || !isOpener(interaction, openerId)) {
    await interaction.reply({
      content: "Only the customer who opened this ticket can continue.",
      ephemeral: true,
    });
    return;
  }

  const payload = interaction.customId.slice(BUY_CHECKOUT_MODAL.length);
  const [tierEncoded, sourceRaw] = payload.split(":");
  const tier = decodeTier(tierEncoded ?? "");
  if (!tier) {
    await interaction.reply({
      content: "Choose a license again.",
      ephemeral: true,
    });
    return;
  }

  const rawCode = interaction.fields.getTextInputValue(BUY_CHECKOUT_CODE).trim();
  const source = sourceRaw && sourceRaw !== "none" ? sourceRaw : null;
  if (!rawCode) {
    await interaction.deferUpdate();
    if (interaction.message) await disableCustomIds(interaction.message, [BUY_CHECKOUT_GO]);
    await offerPaymentMethods(channel, openerId, tier);
    return;
  }

  const code = normalizeReferralCode(rawCode);
  if (!isReferralCode(code)) {
    await interaction.reply({
      content: "A referral code must be exactly 6 letters or numbers, or leave it blank.",
      ephemeral: true,
    });
    return;
  }

  await postReferralCheck(interaction, channel, openerId, tier, code, source);
}

async function handleReferralUse(interaction: ButtonInteraction, allow: boolean) {
  if (!(await requireStaff(interaction))) {
    await interaction.reply({
      content: "Only staff can review a referral code.",
      ephemeral: true,
    });
    return;
  }

  const rest = interaction.customId.split(":").slice(1);
  const channelId = rest[0];
  const tier = decodeTier(rest[1] ?? "");
  const code = rest[2] ?? "";
  const cents = allow ? Number(rest[3]) : Number.NaN;
  if (!channelId || !tier) {
    await interaction.reply({
      content: "This referral check is missing the ticket.",
      ephemeral: true,
    });
    return;
  }

  const fetched = await interaction.guild?.channels.fetch(channelId).catch(() => null);
  const channel = asTicketChannel(fetched as TextChannel | null);
  const openerId = parseTicketOpenerId(channel?.topic);
  if (!channel || !openerId) {
    await interaction.reply({
      content: "That purchase ticket is no longer available.",
      ephemeral: true,
    });
    return;
  }

  await interaction.deferUpdate();
  await disableCustomIds(interaction.message, buttonCustomIds(interaction.message));

  if (!allow) {
    await channel.send({
      content: `<@${openerId}>`,
      embeds: [
        new EmbedBuilder()
          .setColor(BRAND.colors.ruby)
          .setTitle(`${BRAND.emoji.purchase} Referral code`)
          .setDescription("Your referral code is expired or does not exist.")
          .setFooter(brandEmbed().footer),
      ],
    });
    await offerPaymentMethods(channel, openerId, tier);
    return;
  }

  queueReferralPurchase(code, channel.id, openerId);
  const full = getTierPrice(tier) ?? 0;
  await offerPaymentMethods(channel, openerId, tier, {
    cents: Number.isFinite(cents) ? cents : discountCents(full),
    note: `Referral code **${code}** accepted.`,
  });
}

function buttonCustomIds(message: Message) {
  const ids: string[] = [];
  for (const row of message.components) {
    const json = row.toJSON() as { components?: { custom_id?: string }[] };
    for (const component of json.components ?? []) {
      if (component.custom_id) ids.push(component.custom_id);
    }
  }
  return ids;
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
  tier: LicenseTier,
  options?: { cents?: number; note?: string }
) {
  const full = getTierPrice(tier);
  if (full == null) return;
  const amount = options?.cents != null ? options.cents / 100 : full;
  const amountLabel = formatMoney(amount);
  const fullLabel = formatMoney(full);

  const embed = new EmbedBuilder()
    .setColor(BRAND.colors.crimson)
    .setTitle(`${BRAND.emoji.purchase} Payment Method`)
    .setDescription(
      [
        options?.note ? `<@${openerId}> — ${options.note}` : `<@${openerId}> — you selected **${getTierDisplayName(tier)}**.`,
        "",
        options?.cents != null
          ? `Pay **${amountLabel}** instead of ${fullLabel}.`
          : `Pay **${amountLabel} USD**.`,
        "",
        "Choose how you want to pay:",
        "• **Credit/Debit card**",
        "• **Remitly** — bank deposit",
        "• **PayPal** — send the exact amount",
      ].join("\n")
    )
    .setFooter(brandEmbed().footer);

  await channel.send({
    content: `<@${openerId}>`,
    embeds: [embed],
    components: [buildPayButtonRow(tier, options?.cents)],
  });
  const stage = options?.cents != null
    ? `pay:${encodeTier(tier)}:${options.cents}`
    : `pay:${encodeTier(tier)}`;
  void setPurchaseStage(channel, openerId, stage);
}

function buildPayButtonRow(tier: LicenseTier, cents?: number) {
  const encoded = encodeTier(tier);
  const suffix = cents != null ? `:${cents}` : "";
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${BUY_PAY_PREFIX}kofi:${encoded}${suffix}`)
      .setLabel("Credit/Debit card")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`${BUY_PAY_PREFIX}remitly:${encoded}${suffix}`)
      .setLabel("Remitly")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`${BUY_PAY_PREFIX}paypal:${encoded}${suffix}`)
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

  const fullPrice = getTierPrice(tier);
  const centsRaw = parts[3];
  const price = centsRaw ? Number(centsRaw) / 100 : fullPrice;
  if (price == null || !Number.isFinite(price)) {
    await interaction.reply({
      content: "Could not resolve the price for that tier.",
      ephemeral: true,
    });
    return;
  }

  const priceSuffix = centsRaw ? `:${centsRaw}` : "";
  const payIds = [
    `${BUY_PAY_PREFIX}kofi:${encodedTier}${priceSuffix}`,
    `${BUY_PAY_PREFIX}remitly:${encodedTier}${priceSuffix}`,
    `${BUY_PAY_PREFIX}paypal:${encodedTier}${priceSuffix}`,
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

  if (!unlocked) {
    await alertStaff(
      channel,
      `<@${openerId}> paid with **${method}** for **${getTierDisplayName(tier)}** in <#${channel.id}>, but chat did not unlock. Run **/unmute** in that ticket.`
    );
  }
  await channel.send({
    content: `<@${openerId}>`,
    embeds: [
      new EmbedBuilder()
        .setColor(unlocked ? BRAND.colors.crimson : BRAND.colors.ruby)
        .setTitle(`${BRAND.emoji.purchase} Send your payment screenshot`)
        .setDescription(
          unlocked
            ? `<@${openerId}> — after you pay, send your screenshot in this ticket.`
            : `<@${openerId}> — after you pay, staff need to enable messages in this ticket. You will be pinged here once you can send the screenshot.`
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
      { name: "Amount", value: `**${formatMoney(price)} USD**`, inline: true },
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
      "Credit/Debit card",
      openerId,
      tier,
      price,
      `[Pay with credit or debit card](${KOFI_TIP_URL})\nPay the amount above with a credit or debit card.`
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

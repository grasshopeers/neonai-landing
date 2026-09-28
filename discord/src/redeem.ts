import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  type ButtonInteraction,
  type Interaction,
  type ModalSubmitInteraction,
  type StringSelectMenuInteraction,
  type TextChannel,
} from "discord.js";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BRAND, brandEmbed } from "./brand.js";
import {
  CHANNELS,
  findTextChannel,
  grantCustomerAccess,
  isStaffMember,
  resolveRoleMap,
} from "./layout.js";
import {
  hashLicenseKey,
  lookupLicenseKey,
  maskLicenseKey,
  normalizeLicenseKey,
} from "./license-lookup.js";
import { LICENSE_TIERS, isLicenseTier, type LicenseTier } from "./tiers.js";
import {
  deferEphemeral,
  resolveInteractionMember,
} from "./interaction-utils.js";
import { recordLicensePurchase } from "./purchase-history.js";
import { applyCustomerKeyNickname } from "./customer-keys.js";
import { postFeedbackPanels } from "./feedback.js";

export const REDEEM_BUTTON = "neonai_redeem_open";
export const REDEEM_TIER_SELECT = "neonai_redeem_tier";
export const REDEEM_MODAL_PREFIX = "neonai_redeem_modal:";
export const REDEEM_ACCEPT = "neonai_redeem_accept";
export const REDEEM_DENY = "neonai_redeem_deny";

const attempts = new Map<string, number[]>();
const ATTEMPT_WINDOW_MS = 60 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function redeemedStorePath() {
  return join(dirname(fileURLToPath(import.meta.url)), "..", "data", "redeemed-keys.json");
}

function loadRedeemed(): Set<string> {
  const path = redeemedStorePath();
  if (!existsSync(path)) return new Set();
  try {
    const data = JSON.parse(readFileSync(path, "utf8")) as { hashes?: string[] };
    return new Set(data.hashes ?? []);
  } catch {
    return new Set();
  }
}

function saveRedeemed(set: Set<string>) {
  const path = redeemedStorePath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(
    path,
    JSON.stringify({ updatedAt: new Date().toISOString(), hashes: [...set] }, null, 2)
  );
}

function isKeyAlreadyRedeemed(key: string) {
  return loadRedeemed().has(hashLicenseKey(key));
}

function markKeyRedeemed(key: string) {
  const set = loadRedeemed();
  set.add(hashLicenseKey(key));
  saveRedeemed(set);
}

function rateLimited(userId: string) {
  const now = Date.now();
  const list = (attempts.get(userId) ?? []).filter((t) => now - t < ATTEMPT_WINDOW_MS);
  attempts.set(userId, list);
  return list.length >= MAX_ATTEMPTS;
}

function recordAttempt(userId: string) {
  const list = attempts.get(userId) ?? [];
  list.push(Date.now());
  attempts.set(userId, list);
}

function encodeTier(tier: LicenseTier) {
  return encodeURIComponent(tier);
}

function decodeTier(raw: string): LicenseTier | null {
  try {
    const v = decodeURIComponent(raw);
    return isLicenseTier(v) ? v : null;
  } catch {
    return null;
  }
}

export function buildRedeemPanel() {
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(REDEEM_BUTTON)
      .setLabel("Verify")
      .setStyle(ButtonStyle.Success)
  );

  return {
    content: "Verify Customer",
    components: [row],
  };
}

function unlockChannelsBlurb() {
  return [
    `**#${CHANNELS.setup}** · **#${CHANNELS.guide}**`,
    `**#${CHANNELS.reviewUs}** · **#${CHANNELS.reportBug}** · **#${CHANNELS.reportBan}**`,
    `**#${CHANNELS.customerSupport}**`,
  ].join("\n");
}

async function approveRedeem(opts: {
  guild: import("discord.js").Guild;
  userId: string;
  key: string;
  tier: LicenseTier;
  approvedBy: string;
  auto: boolean;
}) {
  const access = await grantCustomerAccess(
    opts.guild,
    opts.userId,
    opts.auto
      ? `NeonAi auto-redeem (${opts.tier})`
      : `NeonAi redeem approved by ${opts.approvedBy} (${opts.tier})`
  );

  markKeyRedeemed(opts.key);
  recordLicensePurchase(opts.userId, opts.tier);
  const nick = await applyCustomerKeyNickname(opts.guild, opts.userId, opts.key, opts.tier);

  const log = findTextChannel(opts.guild, CHANNELS.ticketLogs);
  if (log?.isTextBased()) {
    await log.send({
      embeds: [
        new EmbedBuilder()
          .setColor(BRAND.colors.crimson)
          .setTitle(opts.auto ? "License Auto-Redeemed" : "License Redeem Approved")
          .setDescription(
            [
              `**User:** <@${opts.userId}>`,
              `**Tier:** ${opts.tier}`,
              `**Key:** \`${maskLicenseKey(opts.key)}\``,
              `**Staff tag:** \`·${nick.last4}\`${nick.ok && "nick" in nick ? ` → \`${nick.nick}\`` : ""}`,
              `**By:** ${opts.auto ? "bot (inventory match)" : opts.approvedBy}`,
              access.granted
                ? access.alreadyHad
                  ? "Customer role already present."
                  : "Customer role granted."
                : `⚠️ Customer role failed (${access.error}).`,
            ].join("\n")
          )
          .setFooter(brandEmbed().footer),
      ],
    });
  }

  return access;
}

async function postStaffRequest(opts: {
  guild: import("discord.js").Guild;
  userId: string;
  key: string;
  tier: LicenseTier;
  note: string;
  lookupSummary: string;
}) {
  const channel = findTextChannel(opts.guild, CHANNELS.redeemRequests);
  if (!channel?.isTextBased()) {
    return null;
  }

  const embed = new EmbedBuilder()
    .setColor(BRAND.colors.ruby)
    .setTitle("Pending Redeem Request")
    .setDescription(opts.note)
    .addFields(
      { name: "User", value: `<@${opts.userId}> (\`${opts.userId}\`)`, inline: false },
      { name: "Tier selected", value: opts.tier, inline: true },
      { name: "Key", value: `\`${normalizeLicenseKey(opts.key)}\``, inline: false },
      { name: "Lookup", value: opts.lookupSummary.slice(0, 1024), inline: false }
    )
    .setFooter(brandEmbed().footer)
    .setTimestamp();

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(REDEEM_ACCEPT)
      .setLabel("Accept")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(REDEEM_DENY)
      .setLabel("Deny")
      .setStyle(ButtonStyle.Danger)
  );

  return channel.send({ embeds: [embed], components: [row] });
}

function parseRequestEmbed(interaction: ButtonInteraction) {
  const embed = interaction.message.embeds[0];
  if (!embed) return null;

  const userField = embed.fields.find((f) => f.name === "User")?.value ?? "";
  const tierField = embed.fields.find((f) => f.name === "Tier selected")?.value ?? "";
  const keyField = embed.fields.find((f) => f.name === "Key")?.value ?? "";

  const userId = userField.match(/`(\d{15,25})`/)?.[1];
  const key = keyField.replace(/`/g, "").trim();
  const tier = isLicenseTier(tierField) ? tierField : null;

  if (!userId || !key || !tier) return null;
  return { userId, key, tier };
}

async function finishApproved(
  interaction: Interaction,
  userId: string,
  tier: LicenseTier,
  auto: boolean
) {
  const content = [
    auto
      ? `✅ **Verified.** You now have **Customer** access (**${tier}**).`
      : `✅ Staff approved your **${tier}** verification. You now have **Customer** access.`,
    "",
    "Unlocked:",
    unlockChannelsBlurb(),
  ].join("\n");

  try {
    const user = await interaction.client.users.fetch(userId);
    await user.send({ content }).catch(() => undefined);
  } catch {
    /* DMs closed */
  }
}

export async function handleRedeemOpenButton(interaction: ButtonInteraction) {
  const roles = resolveRoleMap(interaction.guild!);
  const member = await resolveInteractionMember(interaction);
  if (!member) {
    await interaction.reply({
      content: "Could not load your profile. Try again.",
      ephemeral: true,
    });
    return;
  }

  if (!roles.member || !member.roles.cache.has(roles.member.id)) {
    await interaction.reply({
      content: `Verify first in **#${CHANNELS.verify}**, then verify your key here.`,
      ephemeral: true,
    });
    return;
  }

  if (rateLimited(interaction.user.id)) {
    await interaction.reply({
      content: "Too many redeem attempts. Try again in about an hour.",
      ephemeral: true,
    });
    return;
  }

  const menu = new StringSelectMenuBuilder()
    .setCustomId(REDEEM_TIER_SELECT)
    .setPlaceholder("Select Tier")
    .addOptions(
      LICENSE_TIERS.map((t) => ({
        label: t.name,
        description: `${t.value} — $${t.price}`,
        value: t.value,
      }))
    );

  await interaction.reply({
    content: "Select your license tier, then enter your key.",
    components: [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu),
    ],
    ephemeral: true,
  });
}

export async function handleRedeemTierSelect(
  interaction: StringSelectMenuInteraction
) {
  const tierRaw = interaction.values[0];
  if (!isLicenseTier(tierRaw)) {
    await interaction.reply({
      content: "Invalid tier.",
      ephemeral: true,
    });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId(`${REDEEM_MODAL_PREFIX}${encodeTier(tierRaw)}`)
    .setTitle("Verification");

  const keyInput = new TextInputBuilder()
    .setCustomId("license_key")
    .setLabel("Enter your Key")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("XXXX-XXXX-XXXX-XXXX")
    .setRequired(true)
    .setMinLength(10)
    .setMaxLength(64);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(keyInput)
  );

  await interaction.showModal(modal);
}

export async function handleRedeemModal(interaction: ModalSubmitInteraction) {
  const tier = decodeTier(interaction.customId.slice(REDEEM_MODAL_PREFIX.length));
  if (!tier) {
    await interaction.reply({
      content: "Invalid session. Click **Verify** again.",
      ephemeral: true,
    });
    return;
  }

  const key = normalizeLicenseKey(interaction.fields.getTextInputValue("license_key"));
  recordAttempt(interaction.user.id);

  if (!(await deferEphemeral(interaction))) return;

  if (isKeyAlreadyRedeemed(key)) {
    await interaction.editReply({
      content:
        "This key was already verified on Discord. Open a support ticket if you need a device reset or help.",
    });
    return;
  }

  const lookup = await lookupLicenseKey(key);
  const lookupSummary = lookup.found
    ? `${lookup.source}: status=**${lookup.status}** plan=\`${lookup.plan ?? "?"}\` tier=\`${lookup.tier ?? "?"}\``
    : `${lookup.source}: not found (${lookup.reason ?? "unknown"})`;

  // Hard reject expired/revoked — don't spam staff
  if (lookup.status === "expired") {
    await interaction.editReply({
      content: "❌ This license key is expired.",
    });
    return;
  }
  if (lookup.status === "revoked") {
    await interaction.editReply({
      content: "❌ This license key has been revoked.",
    });
    return;
  }

  const staffHints: string[] = ["Manual staff verification required."];
  if (lookup.found && lookup.tier && lookup.tier !== tier) {
    staffHints.push(
      `Selected tier **${tier}** does not match key plan **${lookup.tier}**.`
    );
  } else if (lookup.found && !lookup.tier) {
    staffHints.push("Key found but plan could not be matched to a tier.");
  } else if (!lookup.found) {
    staffHints.push("Key not found in inventory / verify-status.");
  }

  const staffMsg = await postStaffRequest({
    guild: interaction.guild!,
    userId: interaction.user.id,
    key,
    tier,
    note: staffHints.join("\n"),
    lookupSummary,
  });

  await interaction.editReply({
    content: staffMsg
      ? [
          "📨 Redeem request sent to staff.",
          "",
          `Staff will review and Accept / Deny in **#${CHANNELS.redeemRequests}**.`,
          "You’ll get **Customer** access once they approve.",
        ].join("\n")
      : [
          "Could not reach the staff redeem queue. Ping staff with your key's **last 4 characters**.",
        ].join("\n"),
  });
}

export async function handleRedeemStaffDecision(interaction: ButtonInteraction) {
  const roles = resolveRoleMap(interaction.guild!);
  const member = await resolveInteractionMember(interaction);
  if (!member || !isStaffMember(roles, member.roles)) {
    await interaction.reply({
      content: "Only staff can Accept / Deny redeem requests.",
      ephemeral: true,
    });
    return;
  }

  const parsed = parseRequestEmbed(interaction);
  if (!parsed) {
    await interaction.reply({
      content: "Could not read this redeem request.",
      ephemeral: true,
    });
    return;
  }

  const accept = interaction.customId === REDEEM_ACCEPT;

  if (!(await deferEphemeral(interaction))) return;

  if (!accept) {
    await interaction.message.edit({
      embeds: [
        EmbedBuilder.from(interaction.message.embeds[0])
          .setColor(0x6b7280)
          .setTitle("Redeem Denied")
          .setDescription(`Denied by **${interaction.user.tag}**.`),
      ],
      components: [],
    });

    try {
      const user = await interaction.client.users.fetch(parsed.userId);
      await user
        .send({
          content:
            "Your NeonAi license redeem request was **denied**. Open a support ticket if this is a mistake.",
        })
        .catch(() => undefined);
    } catch {
      /* ignore */
    }

    await interaction.editReply({ content: "Denied." });
    return;
  }

  if (isKeyAlreadyRedeemed(parsed.key)) {
    await interaction.editReply({
      content: "This key was already redeemed. Marking request closed.",
    });
    await interaction.message.edit({
      embeds: [
        EmbedBuilder.from(interaction.message.embeds[0])
          .setTitle("Redeem Already Used")
          .setColor(0x6b7280),
      ],
      components: [],
    });
    return;
  }

  const access = await approveRedeem({
    guild: interaction.guild!,
    userId: parsed.userId,
    key: parsed.key,
    tier: parsed.tier,
    approvedBy: interaction.user.tag,
    auto: false,
  });

  await finishApproved(interaction, parsed.userId, parsed.tier, false);

  await interaction.message.edit({
    embeds: [
      EmbedBuilder.from(interaction.message.embeds[0])
        .setColor(0x22c55e)
        .setTitle("Redeem Accepted")
        .setDescription(
          `Accepted by **${interaction.user.tag}**.\nCustomer: <@${parsed.userId}> · **${parsed.tier}**`
        ),
    ],
    components: [],
  });

  await interaction.editReply({
    content: access.granted
      ? `Accepted. Granted Customer to <@${parsed.userId}>.`
      : `Accepted key, but Customer role failed (${access.error}).`,
  });
}

export function isRedeemInteraction(interaction: Interaction) {
  if (interaction.isButton()) {
    return (
      interaction.customId === REDEEM_BUTTON ||
      interaction.customId === REDEEM_ACCEPT ||
      interaction.customId === REDEEM_DENY
    );
  }
  if (interaction.isStringSelectMenu()) {
    return interaction.customId === REDEEM_TIER_SELECT;
  }
  if (interaction.isModalSubmit()) {
    return interaction.customId.startsWith(REDEEM_MODAL_PREFIX);
  }
  return false;
}

export async function handleRedeemInteraction(interaction: Interaction) {
  if (interaction.isButton() && interaction.customId === REDEEM_BUTTON) {
    await handleRedeemOpenButton(interaction);
    return;
  }
  if (interaction.isStringSelectMenu() && interaction.customId === REDEEM_TIER_SELECT) {
    await handleRedeemTierSelect(interaction);
    return;
  }
  if (interaction.isModalSubmit() && interaction.customId.startsWith(REDEEM_MODAL_PREFIX)) {
    await handleRedeemModal(interaction);
    return;
  }
  if (
    interaction.isButton() &&
    (interaction.customId === REDEEM_ACCEPT || interaction.customId === REDEEM_DENY)
  ) {
    await handleRedeemStaffDecision(interaction);
  }
}

/** @deprecated Use postFeedbackPanels from feedback.js */
export async function postCustomerFeedbackChannelIntros(
  guild: import("discord.js").Guild
) {
  await postFeedbackPanels(guild);
}

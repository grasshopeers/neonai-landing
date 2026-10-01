import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
} from "discord.js";
import { PURCHASE_TICKET_BUTTON } from "./commands.js";
import { BRAND, brandEmbed } from "./brand.js";
import { CHANNELS, TICKET_OPTIONS } from "./layout.js";

export function buildVerifyPanel() {
  const embed = new EmbedBuilder()
    .setColor(BRAND.colors.crimson)
    .setTitle(`${BRAND.emoji.verify} Server Verification`)
    .setDescription(
      [
        `Welcome to **${BRAND.name}** — ${BRAND.tagline}.`,
        "",
        "To keep the server clean and secure, every new member must verify.",
        "",
        "**Before you continue:**",
        `• Read **#${CHANNELS.welcome}** and **#${CHANNELS.tos}** after you're in`,
        "• No cracked builds, leaked keys, or harassment",
        "• External software is your own responsibility",
        "",
        "Click **Verify** to get the **Member** role and unlock info + tickets.",
        "Purchase a license to receive **Customer** — unlocks product channels, chat & voice.",
      ].join("\n")
    )
    .setFooter(brandEmbed().footer);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("neonai_verify")
      .setLabel("Verify")
      .setStyle(ButtonStyle.Danger)
      .setEmoji(BRAND.emoji.verify)
  );

  return { embeds: [embed], components: [row] };
}

export function buildTicketPanel() {
  const embed = new EmbedBuilder()
    .setColor(BRAND.colors.crimson)
    .setTitle(`${BRAND.emoji.ticket} ${BRAND.name} Support`)
    .setDescription(
      [
        "Need help? Pick a category below.",
        "A private channel opens for you and our support team.",
        "",
        "**Available 24/7**",
      ].join("\n")
    )
    .setFooter(brandEmbed().footer);

  const menu = new StringSelectMenuBuilder()
    .setCustomId("neonai_ticket_select")
    .setPlaceholder("Choose a support category…")
    .addOptions(
      TICKET_OPTIONS.map((opt) => ({
        label: opt.label,
        description: opt.description.slice(0, 100),
        value: opt.id,
        emoji: opt.emoji,
      }))
    );

  const row =
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);

  return { embeds: [embed], components: [row] };
}

export function ticketPanelNotice(purchaseChannelId: string) {
  return [
    `To buy a license, open a purchase ticket in <#${purchaseChannelId}>. A support ticket is for help only.`,
    "",
    "If there is no response within **24 hours**, the ticket will be closed.",
  ].join("\n");
}

export function buildPurchasePanel() {
  const embed = new EmbedBuilder()
    .setColor(BRAND.colors.crimson)
    .setTitle(`${BRAND.emoji.purchase} Purchase NeonAi`)
    .setDescription(
      [
        "Ready to buy? Click below to open a **private purchase ticket**.",
        "",
        "Only open this ticket if you are **sure you will buy**.",
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

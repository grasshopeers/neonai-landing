import { EmbedBuilder } from "discord.js";
import { BRAND, brandEmbed } from "./brand.js";
import { CHANNELS } from "./layout.js";
import { formatLifetimeRequirement, formatTierList } from "./tiers.js";

/** Staff-only onboarding embeds — posted to #┃staff-guide */
export function buildStaffOnboardingEmbeds() {
  const tiers = formatTierList();

  const welcome = new EmbedBuilder()
    .setColor(BRAND.colors.crimson)
    .setTitle(`${BRAND.emoji.staff} Staff Onboarding`)
    .setDescription(
      [
        `Welcome to **${BRAND.name}** staff. This channel is **staff-only** — members and customers cannot see it.`,
        "",
        "**Your role:** handle tickets, payments, and delivery. The bot handles first replies, tier detection, and spam mutes.",
        "",
        "**Rules:**",
        "• **No DMs** with customers — keep everything in tickets",
        "• **Stripe only** — never mention other payment methods",
        "• Never ask for card numbers, OTPs, or payment screenshots",
        "• Use **Close Ticket**, `/close`, or let `/deliver` auto-close after 10 minutes",
        "• Inactive tickets auto-close after **48 hours**",
      ].join("\n")
    )
    .setFooter(brandEmbed().footer);

  const commands = new EmbedBuilder()
    .setColor(BRAND.colors.ruby)
    .setTitle("Slash Commands")
    .setDescription(
      [
        "**`/price`** — post license tiers and prices for the customer to choose",
        "**`/stripe tier link`** — post Stripe checkout after they pick a tier",
        "• Use official `checkout.stripe.com` or `buy.stripe.com` links only",
        "• Match the tier the customer chose",
        "",
        "**`/deliver tier key`** — deliver license + grant **Customer** role",
        "• Run inside the customer's ticket channel",
        "• Bot grants **Customer** automatically (redeem, product, chat, voice)",
        "• Ticket closes in **10 minutes** after delivery",
        "",
        "**`/unmute`** — restore send permissions if a customer was spam-muted",
        "",
        "**`/members`** — full member list (staff only, private reply)",
        "",
        "**`/setup`** — repost purchase panel (Management / setup permission)",
      ].join("\n")
    )
    .setFooter(brandEmbed().footer);

  const pricing = new EmbedBuilder()
    .setColor(BRAND.colors.crimson)
    .setTitle("License Pricing")
    .setDescription(
      [
        "Current tiers (Stripe checkout must match):",
        tiers,
        "",
        "If a customer asks for an unsupported duration, the bot will redirect them to these tiers.",
        "",
        formatLifetimeRequirement(),
        "",
        "Purchase history for Lifetime eligibility is tracked automatically when you run **`/deliver`**.",
      ].join("\n")
    )
    .setFooter(brandEmbed().footer);

  const workflow = new EmbedBuilder()
    .setColor(BRAND.colors.ruby)
    .setTitle("Purchase & Support Flow")
    .setDescription(
      [
        "**New purchase**",
        `1. Customer opens a ticket via **#${CHANNELS.purchase}** or **#${CHANNELS.customerSupport}**`,
        "2. Bot may ask for tier / answer payment questions",
        "3. You send **`/stripe`** with the correct tier link",
        "4. After payment, run **`/deliver`** with tier + key",
        "",
        "**Support tickets**",
        `• Members → **#${CHANNELS.ticket}**`,
        `• Customers → **#${CHANNELS.customerSupport}**`,
        "• Technical tickets: bot sends patience replies; staff takes over for real issues",
        "• Compatibility: bot links website FAQ first",
        "",
        "**Spam mutes**",
        "• Bot auto-mutes after repeated gibberish / unrecognized spam (10 min)",
        "• **Auto-unmute + bot stops replying** as soon as a staff member responds in the ticket",
        "• Use **`/unmute`** manually if needed before staff replies",
      ].join("\n")
    )
    .setFooter(brandEmbed().footer);

  const channels = new EmbedBuilder()
    .setColor(BRAND.colors.crimson)
    .setTitle("Channel Quick Reference")
    .setDescription(
      [
        `**#${CHANNELS.members}** — open this to see **everyone** in the right member list`,
        `_Discord only shows members who share the channel you're viewing — staff channels hide regular members._`,
        `**#${CHANNELS.verify}** — unverified users only see this channel (no public join pings)`,
        `**#${CHANNELS.ticketLogs}** — delivery & Stripe logs`,
        `**#${CHANNELS.staffChat}** — internal coordination`,
        `**#${CHANNELS.moderation}** — bans, reports, escalations`,
        `**#${CHANNELS.redeem}** — customer-only (after purchase)`,
        "",
        "Live ticket channels live under the **staff** category.",
      ].join("\n")
    )
    .setFooter(brandEmbed().footer);

  return [welcome, commands, pricing, workflow, channels];
}

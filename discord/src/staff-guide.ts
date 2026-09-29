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
        "• **No DMs** with customers — keep everything in tickets. The bot sends the license key by DM when staff deliver it",
        "• Purchase tickets collect hardware first — **Approve / Deny** in the ticket",
        "• Payments: **Ko-fi / card**, **Remitly**, or **PayPal** (bot posts details after they pick)",
        "• Customers send a **payment screenshot** in the purchase ticket after paying — never ask for card numbers or OTPs",
        "• Close a ticket with **Close Ticket** or `/close`. Delivering a key does not close it",
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
        "**`/kofi tier`** — post Ko-fi tip link with the amount for that tier",
        "• One-time tip on https://ko-fi.com/drowndeer for the listed USD amount",
        "",
        "**`/remitly tier`** — post Remitly bank-deposit details with the tier amount",
        "• UAE · First Abu Dhabi Bank · Aasim Attar",
        "",
        "**`/deliver tier key`** — deliver license + grant **Customer** role",
        "• Run inside the customer's ticket channel",
        "• Bot grants **Customer** automatically (setup, guides, support, review/report channels, chat, voice)",
        "• The ticket stays open after delivery until staff or the customer closes it",
        "",
        `**Redeem queue** — **#${CHANNELS.redeemRequests}**`,
        "• Members redeem in public **#${CHANNELS.redeem}** (key + tier)",
        "• **All** requests go to staff — Accept / Deny manually (no bot auto-accept)",
        "• Lookup status is shown on the request to help you verify",
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
        "Current tiers:",
        tiers,
        "",
        "If a customer asks for an unsupported duration, the bot will redirect them to these tiers.",
        "",
        formatLifetimeRequirement(),
      ].join("\n")
    )
    .setFooter(brandEmbed().footer);

  const workflow = new EmbedBuilder()
    .setColor(BRAND.colors.ruby)
    .setTitle("Purchase & Support Flow")
    .setDescription(
      [
        `**New purchase** (#${CHANNELS.purchase})`,
        "1. Customer opens a purchase ticket — chat is locked",
        "2. They submit GPU / RAM / in-game FPS — you **Approve** or **Deny**",
        "3. After Approve they pick a license, then Ko-fi / Remitly / PayPal",
        "4. Bot posts payment details, then unlocks chat — if the customer still cannot type, tap **Allow messages** in **#┃staff-chat**",
        "5. After the screenshot, run **`/deliver`** with tier + key",
        "6. Staff overrides still work: **`/kofi`**, **`/remitly`**, **`/stripe`**",
        "",
        "**Support tickets**",
        `• Members → **#${CHANNELS.ticket}**`,
        `• Customers → **#${CHANNELS.customerSupport}**`,
        "• Billing: bot lists Ko-fi / card, Remitly, and PayPal. **Report a problem** opens a form",
        "• Compatibility: customer submits GPU, RAM, game, and the question. **Approve** or **Deny** in the private review thread. After either choice they can type — if you deny, explain why in the ticket",
        "• Purchase stuck on payment buttons: **#┃staff-chat** is pinged when they pick a license. Run **/kofi**, **/remitly**, or **/unmute** in that ticket",
        "",
        "**Spam mutes**",
        "• Bot auto-mutes after repeated gibberish / unrecognized spam (10 min)",
        "• **Auto-unmute + bot stops replying** as soon as a staff member responds (purchase tickets stay locked until payment instructions)",
        "• Use **`/unmute`** manually if needed before staff replies",
      ].join("\n")
    )
    .setFooter(brandEmbed().footer);

  const channels = new EmbedBuilder()
    .setColor(BRAND.colors.crimson)
    .setTitle("Channel Quick Reference")
    .setDescription(
      [
        `**#${CHANNELS.members}** — staff-only notes channel`,
        `Use **\`/members\`** for the full member list (private reply)`,
        `_Discord only shows people who share a channel with you — do not give Members view on staff channels._`,
        `**#${CHANNELS.verify}** — unverified users only see this channel (no public join pings)`,
        `**#${CHANNELS.ticketLogs}** — ticket open/close summaries plus a \`.txt\` transcript (**view only** for staff; only server owner can delete)`,
        `**#${CHANNELS.redeemRequests}** — staff Accept / Deny redeem requests`,
        `**#${CHANNELS.staffChat}** — internal coordination`,
        `**#${CHANNELS.moderation}** — bans, reports, escalations`,
        `**#${CHANNELS.redeem}** — public redeem panel (verified Members)`,
        `**#${CHANNELS.reviewUs}** / **#${CHANNELS.reportBug}** / **#${CHANNELS.reportBan}** — Customer forms (private → staff)`,
        `**#${CHANNELS.customerReviews}** / **#${CHANNELS.bugReports}** / **#${CHANNELS.banReports}** — staff inboxes`,
        `**#${CHANNELS.chat}** / **#${CHANNELS.voice}** — **staff only**`,
        "",
        "Live ticket channels live under the **staff** category.",
      ].join("\n")
    )
    .setFooter(brandEmbed().footer);

  return [welcome, commands, pricing, workflow, channels];
}

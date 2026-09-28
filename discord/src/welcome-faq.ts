import { EmbedBuilder } from "discord.js";
import { BRAND, brandEmbed } from "./brand.js";
import { CHANNELS } from "./layout.js";
import { formatTierList } from "./tiers.js";

/** Welcome + FAQ embeds for #┃welcome — keep descriptions under Discord limits */
export function buildWelcomeFaqEmbeds(): EmbedBuilder[] {
  const intro = new EmbedBuilder()
    .setColor(BRAND.colors.crimson)
    .setTitle(`${BRAND.emoji.welcome} NeonAi — Welcome & FAQ`)
    .setDescription(
      [
        `Welcome to **${BRAND.name}**.`,
        "",
        "This channel covers the basics.",
        `For **purchases**, **support**, and **device resets** — open a ticket in **#${CHANNELS.ticket}** or **#${CHANNELS.purchase}**.`,
        "",
        `_Read this once — it'll save you a ticket._`,
      ].join("\n")
    )
    .setFooter(brandEmbed().footer);

  const whatIs = new EmbedBuilder()
    .setColor(BRAND.colors.crimson)
    .setTitle("What is NeonAi and how does it work?")
    .setDescription(
      [
        `**NeonAi** is an **external** aim assist tool for PC games (focus: **BloodStrike**).`,
        "",
        "It runs as a **separate app** next to your game — **not** injected into the game process.",
        "It reads what's on your screen, finds targets with **AI**, and moves your mouse based on your settings.",
      ].join("\n")
    );

  const undetected = new EmbedBuilder()
    .setColor(BRAND.colors.ruby)
    .setTitle("Why is NeonAi more undetected than internal cheats?")
    .setDescription(
      [
        "**Internal** cheats inject code into the game process — that's what most anti-cheats hunt hardest for.",
        "",
        "**NeonAi is external:**",
        "• It does **not** inject into the game",
        "• It does **not** modify game memory or files",
        "• It works from **screen capture + mouse movement** outside the game",
        "",
        "⚠️ **No cheat is 100% safe forever.**",
        "Play smart — **don't rage**, **don't stream** obvious settings, **don't share your key**.",
      ].join("\n")
    );

  const whyChoose = new EmbedBuilder()
    .setColor(BRAND.colors.crimson)
    .setTitle("Why choose NeonAi?")
    .setDescription(
      [
        "• **External AI aim** — not another internal injector dump",
        "• Clean **portable** setup",
        "• Multiple inputs: **VTM**, **Software**, **Arduino**, **MAKCU**",
        "• **AI Model** mode + **Color** detection mode",
        "• Configs you can **save and reload**",
        "• Manual Discord support + license keys after payment",
        "• Active updates focused on **BloodStrike**",
      ].join("\n")
    );

  const buy = new EmbedBuilder()
    .setColor(BRAND.colors.crimson)
    .setTitle("How do I buy NeonAi?")
    .setDescription(
      [
        `1. Open a **Purchase** ticket in **#${CHANNELS.purchase}**`,
        "2. Pay via the method staff sends (e.g. **Stripe**)",
        "3. Confirm in the ticket when payment is done",
        "4. Staff sends your **license key** + **download** link",
        "",
        `⏱ Plans start when you **first activate** on your PC — **not** when you receive the key.`,
      ].join("\n")
    );

  const plans = new EmbedBuilder()
    .setColor(BRAND.colors.crimson)
    .setTitle("What plans are available?")
    .setDescription(
      [
        formatTierList(),
        "",
        `Ask staff in a ticket (or use **/price**) for current options.`,
        "",
        `🔐 **One key = one PC.**`,
      ].join("\n")
    );

  const defender = new EmbedBuilder()
    .setColor(BRAND.colors.ruby)
    .setTitle("What if Windows Defender deletes NeonAi.exe?")
    .setDescription(
      [
        "Common **false positive** for game tools.",
        "",
        "**Fix:**",
        "`Windows Security` → `Virus & threat protection` → `Exclusions`",
        "→ Add the **whole NeonAi folder**",
        "",
        "Then restore `NeonAi.exe` from **Protection history**, or re-extract the zip.",
      ].join("\n")
    );

  const broken = new EmbedBuilder()
    .setColor(BRAND.colors.crimson)
    .setTitle("What if it doesn't work for me?")
    .setDescription(
      [
        `Even after doing everything right, if it's still broken — open a support ticket in **#${CHANNELS.ticket}** with:`,
        "",
        "• Last **4 characters** of your key",
        "• **Windows** version",
        "• **Screenshot** of the error",
        "• **GPU / RAM** if you know them",
      ].join("\n")
    );

  const refund = new EmbedBuilder()
    .setColor(BRAND.colors.ruby)
    .setTitle("Can I refund my purchase?")
    .setDescription(
      [
        `**Generally no refunds** after the key is **delivered / activated**.`,
        "",
        "Exceptions are **rare** and only for staff-confirmed cases (e.g. key never sent, wrong product, clear staff error).",
        "",
        `❌ _“It doesn't aim well on my PC”_ or _“I changed my mind”_ are **not** refund reasons.`,
        "",
        "Ask in a ticket **before paying** if you're unsure about PC requirements.",
      ].join("\n")
    );

  const device = new EmbedBuilder()
    .setColor(BRAND.colors.crimson)
    .setTitle("License, activation & PC requirements")
    .setDescription(
      [
        "**Can I use one key on two PCs?**",
        "No. **One license = one device.**",
        "Changed hardware / new PC? Open a ticket and ask for a **device reset**.",
        "**Abuse / key sharing = revoke.**",
        "",
        "**When does my subscription start?**",
        "On **first successful activation** on your PC — not when you receive the key.",
        "",
        "**Do I need internet?**",
        "Yes for **first activation** and periodic checks. Stay online when you can.",
        "",
        "**Minimum PC requirements**",
        "• **Windows 10 / 11** (64-bit)",
        "• **8 GB RAM** minimum (**16 GB** better for AI)",
        "• GPU that supports **DirectML** (NVIDIA / AMD / Intel)",
        "• **SSD** recommended",
        "",
        "Weak / old GPUs (e.g. GT 730, very low RAM): AI mode may be slow — use **CPU / Lite / Color** mode.",
        "We **don't guarantee** smooth AI on low-end PCs.",
      ].join("\n")
    );

  const misc = new EmbedBuilder()
    .setColor(BRAND.colors.crimson)
    .setTitle("More FAQ")
    .setDescription(
      [
        "**Is NeonAi an internal cheat / DLL inject?**",
        "No. NeonAi is **external**. It does **not** inject into the game process.",
        "",
        "**Can I stream / record while using NeonAi?**",
        "Use **Stream Proof** / hide overlay as needed.",
        "",
        "**Where do I get help?**",
        `Open a Discord ticket in **#${CHANNELS.ticket}**. Don't spam DMs with random staff.`,
        "Useful: key (last 4 chars), screenshot, what you already tried.",
      ].join("\n")
    );

  const rules = new EmbedBuilder()
    .setColor(BRAND.colors.glow)
    .setTitle("Rules (short)")
    .setDescription(
      [
        "• Don't **share / resell** keys",
        "• Don't **spam** or **scam** in this server",
        "• Respect staff — **tickets get answers**, rage doesn't",
        "",
        `⛔ Breaking rules = **key revoke** + **ban**.`,
        "",
        `**${BRAND.name}** — Play smart.`,
      ].join("\n")
    )
    .setFooter(brandEmbed().footer);

  return [
    intro,
    whatIs,
    undetected,
    whyChoose,
    buy,
    plans,
    defender,
    broken,
    refund,
    device,
    misc,
    rules,
  ];
}

/** Discord allows max 10 embeds per message — pack into batches */
export function chunkWelcomeFaqEmbeds(embeds = buildWelcomeFaqEmbeds()) {
  const batches: EmbedBuilder[][] = [];
  const size = 8;
  for (let i = 0; i < embeds.length; i += size) {
    batches.push(embeds.slice(i, i + size));
  }
  return batches;
}

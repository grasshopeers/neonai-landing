import { EmbedBuilder, type Client } from "discord.js";
import { BRAND, brandEmbed } from "./brand.js";
import { CHANNELS, findTextChannel } from "./layout.js";
import { NEONAI_SITE_URL } from "./site.js";

/** Timed discount on the latest #┃updates release post */
export const NEWS_PROMO = {
  /** #┃updates */
  channelId: "1524728066931294288",
  /** NeonAi v1.5 UPDATE message */
  messageId: "1550387356173996143",
  /** 15% off for 15 days from when the discount was added */
  expiresAtMs: Date.parse("2026-09-30T12:13:40.926Z"),
  percent: 15,
  days: 15,
};

const CHECK_MS = 60 * 60 * 1000;
const DOWNLOAD_URL = `${NEONAI_SITE_URL.replace(/\/$/, "")}/download`;

function expiryUnix() {
  return Math.floor(NEWS_PROMO.expiresAtMs / 1000);
}

export function downloadPageUrl() {
  return DOWNLOAD_URL.startsWith("http")
    ? DOWNLOAD_URL
    : "https://neonai-official.netlify.app/download";
}

export function discountLine(expired: boolean) {
  const t = expiryUnix();
  return expired
    ? `❌ **Promo expired** — the **${NEWS_PROMO.percent}%** discount ended <t:${t}:R>.`
    : `🤝 **${NEWS_PROMO.percent}% off** all license keys — ends <t:${t}:F> · <t:${t}:R>`;
}

export function buildV15EmbedDescription(opts: {
  redeemMention: string;
  reviewMention: string;
  downloadUrl: string;
  expired: boolean;
}) {
  return [
    "ⓘ **Version v1.5**",
    "",
    "• This update is focused on **optimization**",
    "• Fixed several bugs",
    "• Improved overall performance",
    "• RTX 40-series GPUs can reach **200+ FPS** with a few tweaks",
    "• Reworked optimization for weaker GPUs",
    "• And much more...",
    "",
    "We’re also looking at bringing **Stream Mode** back. If you’d like that, tell us in " +
      opts.reviewMention +
      ".",
    "",
    discountLine(opts.expired),
    "",
    "**Enjoy!**",
    `Download your unique build: ${opts.downloadUrl}`,
    `Verify your key in ${opts.redeemMention} first.`,
  ].join("\n");
}

export function buildV15Embed(opts: {
  redeemMention: string;
  reviewMention: string;
  downloadUrl: string;
  expired: boolean;
  createdAt?: Date;
}) {
  return new EmbedBuilder()
    .setColor(BRAND.colors.crimson)
    .setTitle("NeonAi Update")
    .setDescription(buildV15EmbedDescription(opts))
    .setFooter(brandEmbed().footer)
    .setTimestamp(opts.createdAt);
}

export function buildV14EmbedDescription(opts: {
  redeemMention: string;
  downloadUrl: string;
  expired: boolean;
}) {
  return [
    "ⓘ **Version v1.4**",
    "",
    "• Fixed LMB keybind bug",
    "• Overall aimbot improved by ~30%",
    "• Unique per-customer builds from the download site",
    "• Improved security",
    "• Improved model detection",
    "• Additional fixes and changes",
    "• And much more...",
    "",
    discountLine(opts.expired),
    "",
    "**Enjoy!**",
    `Download your unique build: ${opts.downloadUrl}`,
    `Verify your key in ${opts.redeemMention} first.`,
  ].join("\n");
}

export function buildV14Embed(opts: {
  redeemMention: string;
  downloadUrl: string;
  expired: boolean;
  createdAt?: Date;
}) {
  return new EmbedBuilder()
    .setColor(BRAND.colors.crimson)
    .setTitle("NeonAi Update")
    .setDescription(buildV14EmbedDescription(opts))
    .setFooter(brandEmbed().footer)
    .setTimestamp(opts.createdAt);
}

export function isNewsPromoExpired(now = Date.now()) {
  return now >= NEWS_PROMO.expiresAtMs;
}

export async function syncNewsPromoMessage(client: Client, guildId: string) {
  if (
    !NEWS_PROMO.messageId ||
    NEWS_PROMO.messageId === "PLACEHOLDER" ||
    !NEWS_PROMO.expiresAtMs ||
    Number.isNaN(NEWS_PROMO.expiresAtMs)
  ) {
    return;
  }

  const guild = await client.guilds.fetch(guildId).catch(() => null);
  if (!guild) return;

  const channel =
    guild.channels.cache.get(NEWS_PROMO.channelId) ??
    (await guild.channels.fetch(NEWS_PROMO.channelId).catch(() => null));
  if (!channel?.isTextBased()) {
    console.error(`News promo: missing channel ${NEWS_PROMO.channelId}`);
    return;
  }

  const redeem = findTextChannel(guild, CHANNELS.redeem);
  const reviewUs = findTextChannel(guild, CHANNELS.reviewUs);
  const expired = isNewsPromoExpired();
  const embed = buildV15Embed({
    redeemMention: redeem ? `<#${redeem.id}>` : `**#${CHANNELS.redeem}**`,
    reviewMention: reviewUs ? `<#${reviewUs.id}>` : `**#${CHANNELS.reviewUs}**`,
    downloadUrl: "https://neonai-official.netlify.app/download",
    expired,
  });

  const message = await channel.messages.fetch(NEWS_PROMO.messageId).catch(() => null);
  if (!message) {
    console.error(`News promo: missing message ${NEWS_PROMO.messageId}`);
    return;
  }

  const nextDesc = embed.data.description ?? "";
  const currentDesc = message.embeds[0]?.description ?? "";
  if (currentDesc === nextDesc) return;

  await message.edit({
    content: "@everyone",
    embeds: [embed.setTimestamp(message.createdAt)],
    allowedMentions: { parse: [] },
  });
  console.log(
    expired
      ? "News promo: marked discount as expired"
      : "News promo: refreshed active discount text"
  );
}

/** Keeps the #updates discount line in sync — Discord timestamps update live; we flip to expired after the window */
export function startNewsPromoWatcher(client: Client, guildId: string) {
  const run = () => syncNewsPromoMessage(client, guildId).catch(console.error);

  if (client.isReady()) {
    run();
    setInterval(run, CHECK_MS);
    return;
  }

  client.once("ready", () => {
    run();
    setInterval(run, CHECK_MS);
  });
}

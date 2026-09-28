import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  AttachmentBuilder,
  EmbedBuilder,
  type Guild,
  type Message,
  type TextChannel,
  type ThreadChannel,
} from "discord.js";
import { BRAND, brandEmbed } from "./brand.js";
import { CHANNELS, findTextChannel } from "./layout.js";
import { parseTicketKind, parseTicketOpenerId } from "./ticket-guard.js";

const MAX_MESSAGES = 500;

type ReadableChannel = TextChannel | ThreadChannel;

export type TranscriptParticipant = {
  id: string;
  label: string;
  count: number;
};

export type TicketTranscriptRecord = {
  channelId: string;
  channelName: string;
  panel: string;
  openerId: string | null;
  openerLabel: string | null;
  closedBy: string;
  closedAt: string;
  messageCount: number;
  attachmentCount: number;
  participants: TranscriptParticipant[];
  delivered: boolean;
  text: string;
  backupPath: string;
};

function transcriptsDir() {
  return join(dirname(fileURLToPath(import.meta.url)), "..", "data", "ticket-transcripts");
}

function stamp(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())} UTC`;
}

export function parseTicketPanel(topic: string | null | undefined, channelName?: string) {
  const fromTopic = topic?.match(/·\s*([^·]+?)\s*·\s*opened by/)?.[1]?.trim();
  if (fromTopic) return fromTopic;
  const kind = parseTicketKind(topic, channelName);
  if (kind === "purchase") return "Purchase";
  if (kind === "unknown") return "Ticket";
  return kind.replace(/^\w/, (c) => c.toUpperCase());
}

function plainText(
  text: string,
  names: Map<string, string>,
  roles: Map<string, string>,
  channels: Map<string, string>
) {
  return text
    .replace(/<@&(\d+)>/g, (_, id: string) => `@${roles.get(id) ?? "role"}`)
    .replace(/<@!?(\d+)>/g, (_, id: string) => `@${names.get(id) ?? "user"}`)
    .replace(/<#(\d+)>/g, (_, id: string) => `#${channels.get(id) ?? "channel"}`);
}

function formatMessage(
  message: Message,
  names: Map<string, string>,
  roles: Map<string, string>,
  channels: Map<string, string>
) {
  const who = names.get(message.author.id) ?? message.author.username;
  const lines = [`[${stamp(message.createdAt)}] ${who}`];
  if (message.content?.trim()) {
    lines.push(plainText(message.content.trim(), names, roles, channels));
  }
  for (const attachment of message.attachments.values()) {
    lines.push(`  [file] ${attachment.name || "file"}`);
    lines.push(`  ${attachment.url}`);
  }
  for (const embed of message.embeds) {
    if (embed.title) lines.push(`  [embed] ${plainText(embed.title, names, roles, channels)}`);
    if (embed.description) {
      const body = plainText(embed.description, names, roles, channels);
      for (const row of body.split("\n")) lines.push(`  ${row}`);
    }
    for (const field of embed.fields) {
      const value = plainText(field.value, names, roles, channels).replaceAll("\n", "\n  ");
      lines.push(`  ${plainText(field.name, names, roles, channels)}: ${value}`);
    }
  }
  if (message.stickers.size > 0) {
    lines.push(`  [stickers] ${[...message.stickers.values()].map((s) => s.name).join(", ")}`);
  }
  return lines.join("\n");
}

async function fetchChannelMessages(channel: ReadableChannel) {
  const collected: Message[] = [];
  let before: string | undefined;

  while (collected.length < MAX_MESSAGES) {
    const batch = await channel.messages.fetch({
      limit: 100,
      ...(before ? { before } : {}),
    });
    if (batch.size === 0) break;
    const arr = [...batch.values()];
    collected.push(...arr);
    before = arr[arr.length - 1]?.id;
    if (batch.size < 100) break;
  }

  return collected.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
}

async function fetchThreads(channel: TextChannel) {
  const threads: ThreadChannel[] = [];
  const seen = new Set<string>();
  const active = await channel.threads.fetchActive().catch(() => null);
  for (const thread of active?.threads.values() ?? []) {
    if (seen.has(thread.id)) continue;
    seen.add(thread.id);
    threads.push(thread);
  }
  const archivedPublic = await channel.threads
    .fetchArchived({ type: "public" })
    .catch(() => null);
  const archivedPrivate = await channel.threads
    .fetchArchived({ type: "private" })
    .catch(() => null);
  for (const thread of [
    ...(archivedPublic?.threads.values() ?? []),
    ...(archivedPrivate?.threads.values() ?? []),
  ]) {
    if (seen.has(thread.id)) continue;
    seen.add(thread.id);
    threads.push(thread);
  }
  return threads;
}

function rememberIds(text: string | null | undefined, ids: Set<string>) {
  if (!text) return;
  for (const match of text.matchAll(/<@!?(\d+)>/g)) ids.add(match[1]);
}

async function resolveNames(guild: Guild, messages: Message[]) {
  const names = new Map<string, string>();
  const ids = new Set<string>();
  for (const message of messages) {
    names.set(message.author.id, message.author.username);
    ids.add(message.author.id);
    rememberIds(message.content, ids);
    for (const embed of message.embeds) {
      rememberIds(embed.description, ids);
      rememberIds(embed.title, ids);
      for (const field of embed.fields) rememberIds(field.value, ids);
    }
  }
  for (const id of ids) {
    if (names.has(id)) continue;
    const user = await guild.client.users.fetch(id).catch(() => null);
    if (user) names.set(id, user.username);
  }
  const roles = new Map(guild.roles.cache.map((role) => [role.id, role.name]));
  const channels = new Map(
    guild.channels.cache
      .filter((item) => "name" in item && item.name)
      .map((item) => [item.id, item.name ?? "channel"])
  );
  return { names, roles, channels };
}

function keyWasDelivered(channel: TextChannel, messages: Message[]) {
  if (channel.topic?.includes(" · delivered")) return true;
  return messages.some((message) =>
    message.embeds.some(
      (embed) =>
        (embed.title ?? "").includes("Purchase Confirmed") ||
        (embed.description ?? "").includes("Your Key:")
    )
  );
}

export async function buildClosedTranscript(
  guild: Guild,
  channel: TextChannel,
  closedBy: string
): Promise<TicketTranscriptRecord> {
  const parentMessages = await fetchChannelMessages(channel);
  const threads = await fetchThreads(channel);
  const threadBundles: { name: string; messages: Message[] }[] = [];
  for (const thread of threads) {
    const messages = await fetchChannelMessages(thread).catch(() => [] as Message[]);
    threadBundles.push({ name: thread.name, messages });
  }

  const all = [...parentMessages, ...threadBundles.flatMap((bundle) => bundle.messages)];
  const { names, roles, channels } = await resolveNames(guild, all);
  const openerId = parseTicketOpenerId(channel.topic);
  if (openerId && !names.has(openerId)) {
    const opener = await guild.client.users.fetch(openerId).catch(() => null);
    if (opener) names.set(opener.id, opener.username);
  }

  const counts = new Map<string, number>();
  for (const message of all) {
    if (message.system && !message.content && message.embeds.length === 0) continue;
    counts.set(message.author.id, (counts.get(message.author.id) ?? 0) + 1);
  }
  const participants = [...counts.entries()]
    .map(([id, count]) => ({
      id,
      label: names.get(id) ?? "user",
      count,
    }))
    .sort((a, b) => b.count - a.count);

  const attachmentCount = all.reduce((sum, message) => sum + message.attachments.size, 0);
  const panel = parseTicketPanel(channel.topic, channel.name);
  const closedAt = new Date().toISOString();
  const openerLabel = openerId ? names.get(openerId) ?? null : null;

  const header = [
    `${BRAND.name} ticket transcript`,
    `Server: ${guild.name}`,
    `Channel: #${channel.name}`,
    `Panel: ${panel}`,
    `Ticket owner: ${openerLabel ? `@${openerLabel}` : "unknown"}${openerId ? ` (${openerId})` : ""}`,
    `Closed by: ${closedBy}`,
    `Closed at: ${stamp(new Date(closedAt))}`,
    `Messages: ${all.length}`,
    `Attachments: ${attachmentCount}`,
    "".padEnd(64, "="),
    "",
  ];

  const body = [
    ...parentMessages.map((message) => formatMessage(message, names, roles, channels)),
  ];
  for (const bundle of threadBundles) {
    if (bundle.messages.length === 0) continue;
    body.push("", `----- Thread: ${bundle.name} -----`, "");
    body.push(...bundle.messages.map((message) => formatMessage(message, names, roles, channels)));
  }

  const text = `${header.join("\n")}${body.filter((line) => line !== undefined).join("\n\n")}\n`;
  const safeName = channel.name.replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 40);
  const fileStamp = closedAt.replace(/[:.]/g, "-");

  return {
    channelId: channel.id,
    channelName: channel.name,
    panel,
    openerId,
    openerLabel,
    closedBy,
    closedAt,
    messageCount: all.length,
    attachmentCount,
    participants,
    delivered: parseTicketKind(channel.topic, channel.name) === "purchase" && keyWasDelivered(channel, all),
    text,
    backupPath: join(transcriptsDir(), `${fileStamp}_${safeName}.txt`),
  };
}

export function saveTranscriptBackup(record: TicketTranscriptRecord) {
  mkdirSync(transcriptsDir(), { recursive: true });
  writeFileSync(record.backupPath, record.text, "utf8");

  const metaPath = record.backupPath.replace(/\.txt$/, ".json");
  writeFileSync(
    metaPath,
    JSON.stringify(
      {
        channelId: record.channelId,
        channelName: record.channelName,
        panel: record.panel,
        openerId: record.openerId,
        closedBy: record.closedBy,
        closedAt: record.closedAt,
        messageCount: record.messageCount,
        attachmentCount: record.attachmentCount,
        delivered: record.delivered,
        backupPath: record.backupPath,
      },
      null,
      2
    ),
    "utf8"
  );

  return record.backupPath;
}

export function findBackupByLogMessageHint(channelName: string) {
  const dir = transcriptsDir();
  if (!existsSync(dir)) return null;
  const needle = channelName.replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 40);
  const files = readdirSync(dir)
    .filter((file) => file.endsWith(".txt") && file.includes(needle))
    .sort()
    .reverse();
  return files[0] ? join(dir, files[0]) : null;
}

function transcriptFile(record: TicketTranscriptRecord) {
  return new AttachmentBuilder(Buffer.from(record.text || "(empty)\n", "utf8"), {
    name: `${record.channelName}.txt`,
  });
}

function usersField(participants: TranscriptParticipant[]) {
  if (participants.length === 0) return "_No messages_";
  const lines = participants.slice(0, 20).map((person) => `**${person.count}** — <@${person.id}>`);
  if (participants.length > 20) lines.push(`…and ${participants.length - 20} more`);
  return lines.join("\n");
}

export async function postTicketOpened(
  guild: Guild,
  info: { channelName: string; openerId: string; panel: string }
) {
  const logChannel = findTextChannel(guild, CHANNELS.ticketLogs);
  if (!logChannel?.isTextBased()) return null;

  const user = await guild.client.users.fetch(info.openerId).catch(() => null);
  const embed = new EmbedBuilder()
    .setColor(BRAND.colors.crimson)
    .setTitle(`Ticket opened · #${info.channelName}`)
    .setDescription(`<@${info.openerId}> opened a **${info.panel}** ticket.`)
    .addFields(
      { name: "Ticket Owner", value: `<@${info.openerId}>`, inline: true },
      { name: "Ticket Name", value: info.channelName, inline: true },
      { name: "Panel", value: info.panel, inline: true }
    )
    .setFooter(brandEmbed().footer)
    .setTimestamp();

  if (user) {
    embed.setAuthor({ name: user.username, iconURL: user.displayAvatarURL() });
    embed.setThumbnail(user.displayAvatarURL({ size: 128 }));
  }

  return logChannel.send({
    content: `<@${info.openerId}>`,
    embeds: [embed],
    allowedMentions: { users: [info.openerId] },
  });
}

export async function postTicketTranscript(guild: Guild, record: TicketTranscriptRecord) {
  const logChannel = findTextChannel(guild, CHANNELS.ticketLogs);
  if (!logChannel?.isTextBased()) return null;

  saveTranscriptBackup(record);

  const opener = record.openerId
    ? await guild.client.users.fetch(record.openerId).catch(() => null)
    : null;

  const summary = new EmbedBuilder()
    .setColor(BRAND.colors.ruby)
    .setTitle(`Ticket closed · #${record.channelName}`)
    .addFields(
      { name: "Server", value: guild.name, inline: true },
      { name: "Channel", value: `#${record.channelName}`, inline: true },
      { name: "Panel", value: record.panel, inline: true },
      { name: "Messages", value: String(record.messageCount), inline: true },
      { name: "Attachments", value: String(record.attachmentCount), inline: true },
      { name: "Closed by", value: record.closedBy, inline: true }
    )
    .setFooter(brandEmbed().footer)
    .setTimestamp();

  const owner = new EmbedBuilder()
    .setColor(BRAND.colors.crimson)
    .setTitle(record.channelName)
    .addFields(
      {
        name: "Ticket Owner",
        value: record.openerId ? `<@${record.openerId}>` : "_unknown_",
        inline: true,
      },
      { name: "Ticket Name", value: record.channelName, inline: true },
      { name: "Panel", value: record.panel, inline: true },
      { name: "Users in transcript", value: usersField(record.participants) }
    )
    .setFooter(brandEmbed().footer);

  if (opener) {
    owner.setAuthor({ name: opener.username, iconURL: opener.displayAvatarURL() });
    owner.setThumbnail(opener.displayAvatarURL({ size: 128 }));
  }

  const mentions = record.participants.map((person) => person.id);
  if (record.openerId && !mentions.includes(record.openerId)) mentions.unshift(record.openerId);

  return logChannel.send({
    content: record.openerId ? `<@${record.openerId}>` : undefined,
    embeds: [summary, owner],
    files: [transcriptFile(record)],
    allowedMentions: { users: mentions.slice(0, 20) },
  });
}

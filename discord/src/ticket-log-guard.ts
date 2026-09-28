import {
  AuditLogEvent,
  EmbedBuilder,
  type Client,
  type Message,
  type PartialMessage,
} from "discord.js";
import { readFileSync, existsSync } from "node:fs";
import { BRAND, brandEmbed } from "./brand.js";
import { CHANNELS, findTextChannel } from "./layout.js";

/** Cache of ticket-log message content we posted (for restore if deleted) */
const logCache = new Map<
  string,
  { content?: string; embeds: object[]; filesNote?: string; channelName?: string }
>();

export function rememberTicketLogMessage(message: Message) {
  logCache.set(message.id, {
    content: message.content || undefined,
    embeds: message.embeds.map((e) => e.toJSON()),
    channelName:
      message.embeds[0]?.title?.replace(/^Ticket (?:opened|closed) · #/, "") || undefined,
  });
  // Bound memory
  if (logCache.size > 200) {
    const first = logCache.keys().next().value;
    if (first) logCache.delete(first);
  }
}

async function resolveDeleter(
  guild: import("discord.js").Guild,
  channelId: string,
  messageId: string
) {
  try {
    const logs = await guild.fetchAuditLogs({
      type: AuditLogEvent.MessageDelete,
      limit: 6,
    });
    const entry = logs.entries.find(
      (e) =>
        e.target?.id === messageId ||
        (e.extra &&
          typeof e.extra === "object" &&
          "channel" in e.extra &&
          (e.extra as { channel?: { id?: string } }).channel?.id === channelId)
    );
    // Discord audit for message delete often targets the author, not message id —
    // fall back to most recent delete in this channel within 15s
    const recent = [...logs.entries.values()].find((e) => {
      if (Date.now() - e.createdTimestamp > 15_000) return false;
      const ch = (e.extra as { channel?: { id?: string } } | undefined)?.channel?.id;
      return !ch || ch === channelId;
    });
    return (entry ?? recent)?.executor ?? null;
  } catch {
    return null;
  }
}

export function registerTicketLogGuard(client: Client, guildId: string) {
  client.on("messageCreate", (message) => {
    if (!message.guild || message.guild.id !== guildId) return;
    if (message.channel.isDMBased()) return;
    if (message.channel.name !== CHANNELS.ticketLogs) return;
    if (message.author.id !== client.user?.id) return;
    rememberTicketLogMessage(message);
  });

  client.on("messageDelete", async (message: Message | PartialMessage) => {
    try {
      if (!message.guild || message.guild.id !== guildId) return;
      const channel = message.channel;
      if (!channel || channel.isDMBased()) return;
      if (!("name" in channel) || channel.name !== CHANNELS.ticketLogs) return;

      const ownerId = process.env.DISCORD_OWNER_ID;
      const deleter = await resolveDeleter(message.guild, channel.id, message.id);
      const deleterId = deleter?.id;

      // Owner may delete; everyone else is blocked via perms — still alert if it happens
      if (ownerId && deleterId === ownerId) {
        console.log(`Ticket-log message deleted by server owner (${deleter?.tag})`);
        return;
      }

      const cached = message.id ? logCache.get(message.id) : undefined;
      const alert = findTextChannel(message.guild, CHANNELS.moderation)
        ?? findTextChannel(message.guild, CHANNELS.staffChat);

      if (alert?.isTextBased()) {
        await alert.send({
          content: ownerId ? `<@${ownerId}>` : undefined,
          embeds: [
            new EmbedBuilder()
              .setColor(BRAND.colors.ruby)
              .setTitle("Ticket log deleted")
              .setDescription(
                [
                  `A message in **#${CHANNELS.ticketLogs}** was deleted.`,
                  `**By:** ${deleter ? `${deleter.tag} (\`${deleter.id}\`)` : "_unknown (not in audit / uncached)_"}`,
                  `**Message ID:** \`${message.id}\``,
                  cached?.channelName ? `**Ticket:** #${cached.channelName}` : null,
                  "",
                  "Staff cannot delete ticket logs — only the **server owner** should.",
                ]
                  .filter(Boolean)
                  .join("\n")
              )
              .setFooter(brandEmbed().footer)
              .setTimestamp(),
          ],
          allowedMentions: ownerId ? { users: [ownerId] } : { parse: [] },
        });
      }

      // Best-effort restore of embed preview (attachments cannot always be rebuilt)
      if (cached?.embeds?.length && channel.isTextBased() && "send" in channel) {
        await channel.send({
          content: `_Restored after unauthorized delete${deleter ? ` by ${deleter.tag}` : ""}._`,
          embeds: cached.embeds.map((data) => EmbedBuilder.from(data as never)),
        });
      }
    } catch (err) {
      console.error("Ticket log guard error:", err);
    }
  });
}

/** One-shot: scan Discord audit log for MessageDelete related to ticket-logs */
export async function auditTicketLogDeletions(client: Client, guildId: string) {
  const guild = await client.guilds.fetch(guildId);
  const logsChannel = findTextChannel(guild, CHANNELS.ticketLogs);
  if (!logsChannel) {
    return { ok: false as const, error: "missing_channel" };
  }

  const audit = await guild.fetchAuditLogs({
    type: AuditLogEvent.MessageDelete,
    limit: 50,
  });

  const hits: {
    when: string;
    executor: string;
    count: number;
  }[] = [];

  for (const entry of audit.entries.values()) {
    const ch = (entry.extra as { channel?: { id?: string }; count?: number } | undefined)
      ?.channel;
    if (ch?.id && ch.id !== logsChannel.id) continue;
    // Include entries that might be ticket-logs when channel missing (best effort)
    if (ch?.id === logsChannel.id || (!ch && entry.createdTimestamp > Date.now() - 7 * 864e5)) {
      if (ch?.id !== logsChannel.id && ch) continue;
      hits.push({
        when: entry.createdAt.toISOString(),
        executor: entry.executor
          ? `${entry.executor.tag} (${entry.executor.id})`
          : "unknown",
        count: (entry.extra as { count?: number } | undefined)?.count ?? 1,
      });
    }
  }

  // Also check remaining messages
  const recent = await logsChannel.messages.fetch({ limit: 20 });
  return {
    ok: true as const,
    channelId: logsChannel.id,
    recentLogCount: recent.size,
    deletions: hits.filter((h) =>
      // Prefer confirmed channel matches — filter loose ones if we have any confirmed
      true
    ),
  };
}

export function readLocalTranscript(path: string) {
  if (!existsSync(path)) return null;
  return readFileSync(path, "utf8");
}

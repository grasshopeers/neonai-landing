import { type TextChannel } from "discord.js";
import type { TicketIntent } from "./ticket-intents.js";
import { isPatienceSpamIntent } from "./ticket-intents.js";
import type { TicketKind } from "./ticket-guard.js";

/** Gibberish / patience-reply spam in one ticket before auto-mute */
export const TICKET_SPAM_MESSAGE_LIMIT = 5;

/** Temporary mute duration in ticket channels */
export const TICKET_MUTE_DURATION_MS = 10 * 60_000;

const unrecognizedMessageCounts = new Map<string, number>();
const ticketMuted = new Set<string>();
const muteTimers = new Map<string, NodeJS.Timeout>();

function spamKey(channelId: string, userId: string) {
  return `${channelId}:${userId}`;
}

export function isTicketCustomerMuted(channelId: string, userId: string) {
  return ticketMuted.has(spamKey(channelId, userId));
}

export function isGibberishMessage(text: string) {
  const t = text.trim();
  if (!t) return true;
  if (t.length <= 2) return true;

  const compact = t.replace(/\s/g, "");
  if (/^(.)\1{3,}$/.test(compact)) return true;

  if (/^(he+k+|asdf+|qwerty+|lol+|lmao+|bruh+|test+|[?!.]+)$/i.test(t)) {
    return true;
  }

  const meaningful =
    /\b(help|hi|hey|hello|yes|no|okay|ok|thanks|thank|please|pls|fix|issue|error|bug|install|config|gpu|cpu|windows|game|work|broken|crash|lag|fps|key|license|pay|stripe|buy|week|month|year|lifetime|neon|setup|driver|update|support|ticket|dont|doesnt|won't|cant|cannot)\b/i;
  if (meaningful.test(t)) return false;

  if (t.split(/\s+/).length >= 3 && t.length >= 15) return false;

  if (t.length < 12 && !/\s/.test(t)) return true;

  return false;
}

export function shouldCountTowardTicketMute(
  intent: TicketIntent,
  text: string,
  ticketKind: TicketKind
) {
  if (ticketKind === "technical") {
    return isGibberishMessage(text);
  }
  return isPatienceSpamIntent(intent);
}

export function recordUnrecognizedTicketMessage(channelId: string, userId: string) {
  const key = spamKey(channelId, userId);
  const count = (unrecognizedMessageCounts.get(key) ?? 0) + 1;
  unrecognizedMessageCounts.set(key, count);
  return count;
}

function clearTicketMuteState(channelId: string, userId: string) {
  const key = spamKey(channelId, userId);
  ticketMuted.delete(key);
  unrecognizedMessageCounts.delete(key);

  const timer = muteTimers.get(key);
  if (timer) {
    clearTimeout(timer);
    muteTimers.delete(key);
  }
}

export async function muteCustomerInTicket(
  channel: import("discord.js").Message["channel"],
  userId: string
) {
  if (!channel.isTextBased() || channel.isDMBased()) return;

  const textChannel = channel as TextChannel;
  await textChannel.permissionOverwrites.edit(userId, {
    SendMessages: false,
    AddReactions: false,
    AttachFiles: false,
  });
}

export async function unmuteCustomerInTicket(
  channel: import("discord.js").Message["channel"],
  userId: string
) {
  if (!channel.isTextBased() || channel.isDMBased()) return;

  const textChannel = channel as TextChannel;
  await textChannel.permissionOverwrites.edit(userId, {
    SendMessages: true,
    AddReactions: null,
    AttachFiles: true,
  });
}

export async function temporaryMuteCustomerInTicket(
  channel: import("discord.js").Message["channel"],
  channelId: string,
  userId: string
) {
  const key = spamKey(channelId, userId);

  const existing = muteTimers.get(key);
  if (existing) clearTimeout(existing);

  ticketMuted.add(key);
  await muteCustomerInTicket(channel, userId);

  const timer = setTimeout(() => {
    unmuteCustomerInTicket(channel, userId).catch((err) =>
      console.error("Ticket unmute error:", err)
    );
    clearTicketMuteState(channelId, userId);
  }, TICKET_MUTE_DURATION_MS);

  muteTimers.set(key, timer);
}

/** Staff manual unmute — clears timer, spam count, and restores send permissions */
export async function staffUnmuteTicketCustomer(
  channel: import("discord.js").Message["channel"],
  channelId: string,
  userId: string
) {
  clearTicketMuteState(channelId, userId);
  await unmuteCustomerInTicket(channel, userId);
}

export function buildTicketMuteReply(userId: string) {
  const minutes = TICKET_MUTE_DURATION_MS / 60_000;
  return {
    title: "Ticket Muted",
    description: [
      `<@${userId}> — you have been **muted in this ticket for ${minutes} minutes** due to repeated messages we couldn't assist with automatically.`,
      "",
      "Please be patient. A staff member will assist you as soon as possible.",
      "",
      `You can still read this channel. Sending will be re-enabled automatically after **${minutes} minutes**.`,
    ].join("\n"),
    pingStaff: false,
  };
}

import { ChannelType, type Guild, type TextChannel } from "discord.js";
import type { TicketCategory } from "./layout.js";

const TICKET_PREFIX = "ticket-";

export type TicketKind = TicketCategory | "purchase" | "unknown";

export function parseTicketOpenerId(topic: string | null | undefined) {
  return topic?.match(/<@(\d+)>/)?.[1] ?? null;
}

export function parseTicketKind(
  topic: string | null | undefined,
  channelName?: string
): TicketKind {
  if (topic?.includes("Compatibility")) return "compatibility";
  if (topic?.includes("Technical Support")) return "technical";
  if (topic?.includes("Billing & License")) return "billing";
  if (topic?.includes("Purchase")) return "purchase";

  const name = channelName ?? "";
  if (name.includes("compatibility")) return "compatibility";
  if (name.includes("technical")) return "technical";
  if (name.includes("billing")) return "billing";
  if (name.includes("purchase")) return "purchase";

  return "unknown";
}

/** Min wait between "Open Ticket" button clicks (anti button-mash) */
export const TICKET_OPEN_ATTEMPT_COOLDOWN_MS = 15_000;

/** Min wait after closing before the same user can open a new ticket */
export const TICKET_REOPEN_AFTER_CLOSE_MS = 5 * 60_000;

const openAttemptAt = new Map<string, number>();
const closedAt = new Map<string, number>();

export function findOpenTicketForUser(
  guild: Guild,
  userId: string
): TextChannel | null {
  const match = guild.channels.cache.find(
    (c) =>
      c.type === ChannelType.GuildText &&
      c.name.startsWith(TICKET_PREFIX) &&
      parseTicketOpenerId(c.topic) === userId
  );
  return match?.isTextBased() ? (match as TextChannel) : null;
}

export function recordTicketClosed(userId: string) {
  closedAt.set(userId, Date.now());
}

export function checkCanOpenTicket(userId: string): {
  allowed: boolean;
  reason?: string;
} {
  const now = Date.now();

  const lastAttempt = openAttemptAt.get(userId) ?? 0;
  if (now - lastAttempt < TICKET_OPEN_ATTEMPT_COOLDOWN_MS) {
    const secs = Math.ceil(
      (TICKET_OPEN_ATTEMPT_COOLDOWN_MS - (now - lastAttempt)) / 1000
    );
    return {
      allowed: false,
      reason: `Slow down — wait **${secs}s** before trying again.`,
    };
  }

  const lastClosed = closedAt.get(userId) ?? 0;
  if (now - lastClosed < TICKET_REOPEN_AFTER_CLOSE_MS) {
    const mins = Math.ceil(
      (TICKET_REOPEN_AFTER_CLOSE_MS - (now - lastClosed)) / 60_000
    );
    return {
      allowed: false,
      reason: `You recently closed a ticket. Wait **${mins} min** before opening a new one.`,
    };
  }

  return { allowed: true };
}

export function recordTicketOpenAttempt(userId: string) {
  openAttemptAt.set(userId, Date.now());
}

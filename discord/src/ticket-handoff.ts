import { staffUnmuteTicketCustomer } from "./ticket-spam.js";

const staffHandledTickets = new Set<string>();

export function isTicketStaffHandled(channelId: string) {
  return staffHandledTickets.has(channelId);
}

export function markTicketStaffHandled(channelId: string) {
  staffHandledTickets.add(channelId);
}

export function clearTicketStaffHandled(channelId: string) {
  staffHandledTickets.delete(channelId);
}

/** Staff replied or took action — stop bot auto-replies and lift any spam mute */
export async function staffTakesOverTicket(
  channel: import("discord.js").Message["channel"],
  channelId: string,
  openerId: string | null
) {
  markTicketStaffHandled(channelId);

  if (!openerId) return;

  try {
    await staffUnmuteTicketCustomer(channel, channelId, openerId);
  } catch (err) {
    console.error("Staff handoff unmute error:", err);
  }
}

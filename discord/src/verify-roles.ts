import type { Guild } from "discord.js";
import { resolveRoleMap } from "./layout.js";

const DEFAULT_TICKET_BOT_ID = "1531682970048532740";

/** Ticket bot role must sit above Member or verify button cannot assign the role. */
export async function ensureTicketBotRoleHierarchy(
  guild: Guild,
  ticketBotUserId = process.env.DISCORD_TICKET_BOT_ID ?? DEFAULT_TICKET_BOT_ID
) {
  const roles = resolveRoleMap(guild);
  const memberRole = roles.member;
  if (!memberRole) {
    throw new Error("Member role missing — run npm run setup");
  }

  const ticketMember = await guild.members.fetch(ticketBotUserId);
  const ticketRole = ticketMember.roles.botRole ?? ticketMember.roles.highest;

  if (ticketRole.position > memberRole.position) {
    return { fixed: false, ticketRole, memberRole };
  }

  await ticketRole.setPosition(memberRole.position, {
    reason: "NeonAi: ticket bot must assign Member role for verify",
  });

  await guild.roles.fetch();
  const updated = guild.roles.cache.get(ticketRole.id)!;
  return { fixed: true, ticketRole: updated, memberRole };
}

import type { Guild } from "discord.js";
import { resolveRoleMap } from "./layout.js";

/** Main NeonAi bot role must sit above Member or verify cannot assign the role. */
export async function ensureMainBotRoleHierarchy(guild: Guild) {
  const me = guild.members.me;
  if (!me) throw new Error("Bot member not found in guild");

  const roles = resolveRoleMap(guild);
  const memberRole = roles.member;
  if (!memberRole) {
    throw new Error("Member role missing — run npm run setup");
  }

  const botRole = me.roles.highest;
  if (botRole.position > memberRole.position) {
    return { fixed: false, botRole, memberRole };
  }

  await botRole.setPosition(memberRole.position, {
    reason: "NeonAi: main bot must assign Member role for verify",
  });

  await guild.roles.fetch();
  const updated = guild.roles.cache.get(botRole.id)!;
  return { fixed: true, botRole: updated, memberRole };
}

/** @deprecated Ticket bot no longer handles verify */
export async function ensureTicketBotRoleHierarchy(
  guild: Guild,
  _ticketBotUserId?: string
) {
  return ensureMainBotRoleHierarchy(guild);
}

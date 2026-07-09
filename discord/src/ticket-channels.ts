import {
  ChannelType,
  PermissionFlagsBits,
  type Guild,
  type GuildMember,
  type OverwriteResolvable,
} from "discord.js";
import { CATEGORIES, staffRoles, type RoleMap } from "./layout.js";

export function getStaffCategory(guild: Guild) {
  return guild.channels.cache.find(
    (c) =>
      c.type === ChannelType.GuildCategory && c.name === CATEGORIES.staff
  );
}

export function getBotRoleId(guild: Guild) {
  const me = guild.members.me as GuildMember | null;
  return me?.roles.botRole?.id ?? me?.roles.highest?.id ?? null;
}

export function buildTicketOverwrites(
  guild: Guild,
  roles: RoleMap,
  userId: string
): OverwriteResolvable[] {
  const overwrites: OverwriteResolvable[] = [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel],
    },
    {
      id: userId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
      ],
    },
  ];

  for (const role of staffRoles(roles)) {
    overwrites.push({
      id: role.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageMessages,
      ],
    });
  }

  const botRoleId = getBotRoleId(guild);
  if (botRoleId) {
    overwrites.push({
      id: botRoleId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.ManageMessages,
        PermissionFlagsBits.ManageChannels,
      ],
    });
  }

  return overwrites;
}

export async function relocateOpenTickets(guild: Guild) {
  const staffCategory = getStaffCategory(guild);
  if (!staffCategory) return;

  const tickets = guild.channels.cache.filter(
    (c) =>
      c.name.startsWith("ticket-") &&
      c.type === ChannelType.GuildText &&
      c.parentId !== staffCategory.id
  );

  for (const ticket of tickets.values()) {
    await ticket.setParent(staffCategory.id, {
      lockPermissions: false,
      reason: "Move ticket channels under staff",
    });
    console.log(`  ↻ moved #${ticket.name} → staff`);
  }
}

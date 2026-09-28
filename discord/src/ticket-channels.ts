import {
  ChannelType,
  PermissionFlagsBits,
  type Guild,
  type GuildMember,
  type OverwriteResolvable,
  type TextChannel,
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
  userId: string,
  options?: { customerCanSpeak?: boolean }
): OverwriteResolvable[] {
  const canSpeak = options?.customerCanSpeak !== false;
  const overwrites: OverwriteResolvable[] = [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel],
    },
    {
      id: userId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.ReadMessageHistory,
        ...(canSpeak
          ? [
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.AttachFiles,
            ]
          : []),
      ],
      deny: [
        PermissionFlagsBits.ManageThreads,
        PermissionFlagsBits.CreatePrivateThreads,
        PermissionFlagsBits.SendMessagesInThreads,
        ...(canSpeak
          ? []
          : [
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.AttachFiles,
              PermissionFlagsBits.AddReactions,
            ]),
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
        PermissionFlagsBits.ManageThreads,
        PermissionFlagsBits.SendMessagesInThreads,
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
        PermissionFlagsBits.ManageThreads,
        PermissionFlagsBits.CreatePrivateThreads,
        PermissionFlagsBits.SendMessagesInThreads,
      ],
    });
  }

  return overwrites;
}

const SEND_MESSAGES = 1n << 11n;
const VIEW_CHANNEL = 1n << 10n;
const EMBED_LINKS = 1n << 14n;
const ATTACH_FILES = 1n << 15n;
const READ_HISTORY = 1n << 16n;
const MANAGE_THREADS = 1n << 34n;
const CREATE_PRIVATE_THREADS = 1n << 36n;

type RawOverwrite = { id: string; type: number; allow: string; deny: string };

/** Replace only the customer's overwrite, using the live channel list from Discord. */
export async function unlockCustomerInTicket(
  channel: TextChannel,
  userId: string
) {
  const current = (await channel.client.rest.get(`/channels/${channel.id}`)) as {
    permission_overwrites?: RawOverwrite[];
  };
  const overwrites = (current.permission_overwrites ?? []).filter(
    (overwrite) => overwrite.id !== userId
  );
  overwrites.push({
    id: userId,
    type: 1,
    allow: (VIEW_CHANNEL | READ_HISTORY | SEND_MESSAGES | EMBED_LINKS | ATTACH_FILES).toString(),
    deny: (MANAGE_THREADS | CREATE_PRIVATE_THREADS).toString(),
  });

  await channel.client.rest.patch(`/channels/${channel.id}`, {
    body: { permission_overwrites: overwrites },
  });

  const after = (await channel.client.rest.get(`/channels/${channel.id}`)) as {
    permission_overwrites?: RawOverwrite[];
  };
  const opener = after.permission_overwrites?.find((overwrite) => overwrite.id === userId);
  const allow = BigInt(opener?.allow ?? "0");
  const deny = BigInt(opener?.deny ?? "0");
  if ((allow & SEND_MESSAGES) === 0n || (deny & SEND_MESSAGES) !== 0n) {
    throw new Error("Customer still cannot send messages after unlock");
  }
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

import {
  ChannelType,
  PermissionFlagsBits,
  type Guild,
  type GuildMemberRoleManager,
  type Role,
} from "discord.js";
import { BRAND } from "./brand.js";

export type TicketCategory = "technical" | "billing" | "compatibility";

export const TICKET_OPTIONS: {
  id: TicketCategory;
  label: string;
  description: string;
  emoji: string;
}[] = [
  {
    id: "technical",
    label: "Technical Support",
    description: "Install, configs, performance, or general product help.",
    emoji: "🛠️",
  },
  {
    id: "billing",
    label: "Billing & License",
    description: "Activation keys, Stripe checkout, or refund questions.",
    emoji: "💳",
  },
  {
    id: "compatibility",
    label: "Compatibility",
    description: "Hardware, games, or setup isolation questions.",
    emoji: "🖥️",
  },
];

/** Stable channel names — Nyron-style `┃name` format */
export const CHANNELS = {
  verify: "┃verify",
  tos: "┃tos",
  welcome: "┃welcome",
  news: "┃news",
  purchase: "┃purchase",
  media: "┃media",
  reviews: "┃reviews",
  neonai: "┃neonai",
  featuresList: "┃features-list",
  extraHardware: "┃extra-hardware",
  updates: "┃updates",
  ticket: "┃ticket",
  customerSupport: "┃customer-support",
  redeem: "┃redeem",
  chat: "┃chat",
  voice: "┃voice",
  ticketLogs: "┃ticket-logs",
  members: "┃members",
  staffGuide: "┃staff-guide",
  staffChat: "┃staff-chat",
  moderation: "┃moderation",
} as const;

export const CATEGORIES = {
  verification: "verification",
  info: "info",
  neonai: "neonai",
  support: "support",
  staff: "staff",
} as const;

/** Hoisted roles appear in the right member list (Nyron-style) */
export const ROLES = [
  {
    name: "Management",
    color: BRAND.colors.glow,
    hoist: true,
    permissions: [PermissionFlagsBits.Administrator],
    mentionable: true,
  },
  {
    name: "Support (NO DMS)",
    color: 0x3b82f6,
    hoist: true,
    permissions: [PermissionFlagsBits.ManageMessages],
    mentionable: true,
  },
  {
    name: "Head Staff (NO DMS)",
    color: BRAND.colors.crimson,
    hoist: true,
    permissions: [],
    mentionable: true,
  },
  {
    name: "Staff (NO DMS)",
    color: 0xf97316,
    hoist: true,
    permissions: [],
    mentionable: true,
  },
  {
    name: "Media",
    color: 0x22c55e,
    hoist: true,
    permissions: [],
    mentionable: false,
  },
  {
    name: "Customer",
    color: 0xd1d5db,
    hoist: false,
    permissions: [],
    mentionable: false,
  },
  {
    name: "Member",
    color: 0x6b7280,
    hoist: false,
    permissions: [],
    mentionable: false,
  },
] as const;

/** Maps old role names from earlier setup runs */
export const LEGACY_ROLE_NAMES: Record<string, string> = {
  Admin: "Management",
  Support: "Support (NO DMS)",
};

type ChannelDef = {
  name: string;
  type: ChannelType;
  topic?: string;
  readOnly?: boolean;
  staffOnly?: boolean;
  customerOnly?: boolean;
  memberOnly?: boolean;
  verifyChannel?: boolean;
  /** Staff open this channel to see the full sidebar member list */
  staffMemberList?: boolean;
};

type CategoryDef = {
  name: string;
  channels: ChannelDef[];
};

export const SERVER_LAYOUT: CategoryDef[] = [
  {
    name: CATEGORIES.verification,
    channels: [
      {
        name: CHANNELS.verify,
        type: ChannelType.GuildText,
        topic: "New members must verify here before accessing the server.",
        verifyChannel: true,
      },
    ],
  },
  {
    name: CATEGORIES.info,
    channels: [
      {
        name: CHANNELS.tos,
        type: ChannelType.GuildText,
        topic: "Terms of service and server rules.",
        readOnly: true,
        memberOnly: true,
      },
      {
        name: CHANNELS.welcome,
        type: ChannelType.GuildText,
        topic: "Welcome to NeonAi — start here after verifying.",
        readOnly: true,
        memberOnly: true,
      },
      {
        name: CHANNELS.news,
        type: ChannelType.GuildText,
        topic: "Major announcements and product news.",
        readOnly: true,
        memberOnly: true,
      },
      {
        name: CHANNELS.purchase,
        type: ChannelType.GuildText,
        topic: "How to buy NeonAi and activate your license.",
        readOnly: true,
        memberOnly: true,
      },
      {
        name: CHANNELS.media,
        type: ChannelType.GuildText,
        topic: "Showcase clips, screenshots, and community media.",
        readOnly: true,
        memberOnly: true,
      },
      {
        name: CHANNELS.reviews,
        type: ChannelType.GuildText,
        topic: "Customer reviews and feedback.",
        readOnly: true,
        memberOnly: true,
      },
    ],
  },
  {
    name: CATEGORIES.neonai,
    channels: [
      {
        name: CHANNELS.neonai,
        type: ChannelType.GuildText,
        topic: "Overview of NeonAi — external AI aim assistant.",
        readOnly: true,
        customerOnly: true,
      },
      {
        name: CHANNELS.featuresList,
        type: ChannelType.GuildText,
        topic: "Feature breakdown: aim assist, humanization, configs.",
        readOnly: true,
        customerOnly: true,
      },
      {
        name: CHANNELS.extraHardware,
        type: ChannelType.GuildText,
        topic: "Optional external hardware and isolation setups.",
        readOnly: true,
        customerOnly: true,
      },
      {
        name: CHANNELS.updates,
        type: ChannelType.GuildText,
        topic: "Build updates, model releases, and patch notes.",
        readOnly: true,
        customerOnly: true,
      },
    ],
  },
  {
    name: CATEGORIES.support,
    channels: [
      {
        name: CHANNELS.ticket,
        type: ChannelType.GuildText,
        topic: "Open a private support ticket — members only.",
        readOnly: true,
        memberOnly: true,
      },
      {
        name: CHANNELS.customerSupport,
        type: ChannelType.GuildText,
        topic: "Open a private support ticket — customers only.",
        readOnly: true,
        customerOnly: true,
      },
      {
        name: CHANNELS.redeem,
        type: ChannelType.GuildText,
        topic: "Redeem your license key after purchase.",
        readOnly: true,
        customerOnly: true,
      },
      {
        name: CHANNELS.ticketLogs,
        type: ChannelType.GuildText,
        topic: "Closed ticket transcripts for staff.",
        staffOnly: true,
      },
      {
        name: CHANNELS.chat,
        type: ChannelType.GuildText,
        topic: "Customer lounge — paid members only.",
        customerOnly: true,
      },
      {
        name: CHANNELS.voice,
        type: ChannelType.GuildVoice,
        customerOnly: true,
      },
    ],
  },
  {
    name: CATEGORIES.staff,
    channels: [
      {
        name: CHANNELS.members,
        type: ChannelType.GuildText,
        topic: "Staff: open this channel to view the full server member list.",
        readOnly: true,
        staffMemberList: true,
      },
      {
        name: CHANNELS.staffGuide,
        type: ChannelType.GuildText,
        topic: "Staff onboarding and internal procedures — staff only.",
        readOnly: true,
        staffOnly: true,
      },
      {
        name: CHANNELS.staffChat,
        type: ChannelType.GuildText,
        topic: "Internal staff coordination.",
        staffOnly: true,
      },
      {
        name: CHANNELS.moderation,
        type: ChannelType.GuildText,
        topic: "Reports, bans, and escalations.",
        staffOnly: true,
      },
    ],
  },
];

export const REMOVED_CHANNELS = ["┃quick-news"] as const;

/** Discord default categories created on new servers */
export const DEFAULT_DISCORD_CATEGORIES = [
  "Text Channels",
  "Voice Channels",
] as const;

export const DEFAULT_DISCORD_CHANNELS = ["general", "General"] as const;

export const LEGACY_CATEGORIES = [
  "◈ START HERE",
  "💬 COMMUNITY",
  "🎫 SUPPORT",
  "⚡ PRODUCT",
  "🔒 STAFF",
];

export type RoleMap = {
  management: Role | null;
  support: Role | null;
  headStaff: Role | null;
  staff: Role | null;
  media: Role | null;
  customer: Role | null;
  member: Role | null;
};

export function resolveRoleMap(guild: Guild): RoleMap {
  const find = (name: string) =>
    guild.roles.cache.find((r) => r.name === name) ?? null;

  return {
    management: find("Management") ?? find("Admin"),
    support: find("Support (NO DMS)") ?? find("Support"),
    headStaff: find("Head Staff (NO DMS)"),
    staff: find("Staff (NO DMS)"),
    media: find("Media"),
    customer: find("Customer"),
    member: find("Member"),
  };
}

export function staffRoles(roles: RoleMap) {
  return [roles.management, roles.support, roles.headStaff, roles.staff].filter(
    (r): r is Role => r !== null
  );
}

export function isStaffMember(
  roles: RoleMap,
  memberRoles: GuildMemberRoleManager
) {
  return staffRoles(roles).some((r) => memberRoles.cache.has(r.id));
}

export async function grantCustomerAccess(
  guild: Guild,
  userId: string,
  reason: string
) {
  const roles = resolveRoleMap(guild);
  if (!roles.customer) {
    return { granted: false as const, alreadyHad: false, error: "missing_role" as const };
  }

  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member) {
    return { granted: false as const, alreadyHad: false, error: "member_not_found" as const };
  }

  if (member.roles.cache.has(roles.customer.id)) {
    return { granted: true as const, alreadyHad: true, error: null };
  }

  try {
    await member.roles.add(roles.customer, reason);
    return { granted: true as const, alreadyHad: false, error: null };
  } catch {
    return { granted: false as const, alreadyHad: false, error: "assign_failed" as const };
  }
}

function addStaffAccess(
  overwrites: { id: string; deny?: bigint[]; allow?: bigint[] }[],
  roles: RoleMap,
  allow: bigint[]
) {
  for (const role of staffRoles(roles)) {
    overwrites.push({ id: role.id, allow });
  }
}

function addBotAccess(
  guild: Guild,
  overwrites: { id: string; deny?: bigint[]; allow?: bigint[] }[]
) {
  const botRoleId = guild.members.me?.roles.botRole?.id;
  if (!botRoleId) return;
  overwrites.push({
    id: botRoleId,
    allow: [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.ReadMessageHistory,
      PermissionFlagsBits.EmbedLinks,
      PermissionFlagsBits.AttachFiles,
      PermissionFlagsBits.ManageMessages,
    ],
  });
}

export function channelOverwrites(
  guild: Guild,
  roles: RoleMap,
  channel: ChannelDef
) {
  const everyone = guild.roles.everyone;
  const isVoice = channel.type === ChannelType.GuildVoice;
  const overwrites: {
    id: string;
    deny?: bigint[];
    allow?: bigint[];
  }[] = [];

  const memberRead = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.ReadMessageHistory,
  ];
  const denyPost = [
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.AttachFiles,
    PermissionFlagsBits.AddReactions,
    PermissionFlagsBits.CreatePublicThreads,
    PermissionFlagsBits.CreatePrivateThreads,
    PermissionFlagsBits.SendMessagesInThreads,
  ];
  const memberWrite = [
    ...memberRead,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.AttachFiles,
  ];
  const memberVoice = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.Connect,
    PermissionFlagsBits.Speak,
  ];
  const staffWrite = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.ReadMessageHistory,
    PermissionFlagsBits.ManageMessages,
  ];
  const staffVoice = [
    ...memberVoice,
    PermissionFlagsBits.MuteMembers,
    PermissionFlagsBits.MoveMembers,
  ];

  if (channel.staffMemberList) {
    overwrites.push({
      id: everyone.id,
      deny: [PermissionFlagsBits.ViewChannel],
    });
    const viewOnly = [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.ReadMessageHistory,
    ];
    if (roles.member) {
      overwrites.push({
        id: roles.member.id,
        allow: viewOnly,
        deny: denyPost,
      });
    }
    if (roles.customer) {
      overwrites.push({
        id: roles.customer.id,
        allow: viewOnly,
        deny: denyPost,
      });
    }
    addStaffAccess(overwrites, roles, staffWrite);
    addBotAccess(guild, overwrites);
    return overwrites;
  }

  if (channel.verifyChannel) {
    overwrites.push({
      id: everyone.id,
      allow: memberRead,
      deny: [PermissionFlagsBits.SendMessages],
    });
    if (roles.member) {
      overwrites.push({
        id: roles.member.id,
        deny: [PermissionFlagsBits.ViewChannel],
      });
    }
    if (roles.customer) {
      overwrites.push({
        id: roles.customer.id,
        deny: [PermissionFlagsBits.ViewChannel],
      });
    }
    addStaffAccess(overwrites, roles, [PermissionFlagsBits.ViewChannel]);
    addBotAccess(guild, overwrites);
    return overwrites;
  }

  if (channel.staffOnly) {
    overwrites.push({
      id: everyone.id,
      deny: [PermissionFlagsBits.ViewChannel],
    });
    addStaffAccess(
      overwrites,
      roles,
      isVoice ? staffVoice : staffWrite
    );
    addBotAccess(guild, overwrites);
    return overwrites;
  }

  if (channel.customerOnly) {
    overwrites.push({
      id: everyone.id,
      deny: [PermissionFlagsBits.ViewChannel],
    });
    const customerPerms = isVoice
      ? memberVoice
      : channel.readOnly
        ? memberRead
        : memberWrite;
    if (roles.customer) {
      overwrites.push({
        id: roles.customer.id,
        allow: channel.readOnly ? memberRead : customerPerms,
        deny: channel.readOnly ? denyPost : undefined,
      });
    }
    addStaffAccess(
      overwrites,
      roles,
      isVoice ? staffVoice : channel.readOnly ? staffWrite : memberWrite
    );
    addBotAccess(guild, overwrites);
    return overwrites;
  }

  if (channel.memberOnly) {
    overwrites.push({
      id: everyone.id,
      deny: [PermissionFlagsBits.ViewChannel],
    });
    const memberPerms = isVoice
      ? memberVoice
      : channel.readOnly
        ? memberRead
        : memberWrite;
    if (roles.member) {
      overwrites.push({
        id: roles.member.id,
        allow: memberPerms,
        deny: channel.readOnly ? denyPost : undefined,
      });
    }
    addStaffAccess(
      overwrites,
      roles,
      isVoice ? staffVoice : channel.readOnly ? staffWrite : memberWrite
    );
    addBotAccess(guild, overwrites);
    return overwrites;
  }

  overwrites.push({
    id: everyone.id,
    deny: [PermissionFlagsBits.ViewChannel],
  });

  const memberPerms = isVoice
    ? memberVoice
    : channel.readOnly
      ? memberRead
      : memberWrite;

  if (roles.member) {
    overwrites.push({
      id: roles.member.id,
      allow: memberPerms,
      deny: channel.readOnly ? denyPost : undefined,
    });
  }
  if (roles.customer) {
    overwrites.push({
      id: roles.customer.id,
      allow: isVoice
        ? memberVoice
        : channel.readOnly
          ? memberRead
          : memberWrite,
      deny: channel.readOnly ? denyPost : undefined,
    });
  }
  addStaffAccess(
    overwrites,
    roles,
    isVoice ? staffVoice : channel.readOnly ? staffWrite : memberWrite
  );
  addBotAccess(guild, overwrites);

  return overwrites;
}

export function assignOwnerManagement(
  guild: Guild,
  ownerId: string,
  managementRole: Role | null
) {
  if (!managementRole) return;
  return guild.members.fetch(ownerId).then((member) =>
    member.roles.add(managementRole, "NeonAi setup — server owner")
  );
}

export function findChannel(guild: Guild, name: string) {
  return guild.channels.cache.find((c) => c.name === name);
}

export function findTextChannel(guild: Guild, name: string) {
  const ch = findChannel(guild, name);
  return ch?.isTextBased() ? ch : undefined;
}

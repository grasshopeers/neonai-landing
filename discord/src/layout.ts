import {
  ChannelType,
  PermissionFlagsBits,
  type Guild,
  type GuildMember,
  type GuildMemberRoleManager,
  type Role,
} from "discord.js";
import { BRAND } from "./brand.js";

export type TicketCategory = "billing" | "compatibility";

export const TICKET_OPTIONS: {
  id: TicketCategory;
  label: string;
  description: string;
  emoji: string;
}[] = [
  {
    id: "billing",
    label: "Billing & License",
    description: "Payments, license keys, or refund questions.",
    emoji: "💳",
  },
  {
    id: "compatibility",
    label: "Compatibility",
    description: "Hardware, games, or setup questions.",
    emoji: "🖥️",
  },
];

/** Stable channel names — Nyron-style `┃name` format */
export const CHANNELS = {
  verify: "┃verify",
  tos: "┃tos",
  welcome: "┃welcome",
  news: "┃news",
  updates: "┃updates",
  purchase: "┃purchase",
  media: "┃media",
  reviews: "┃reviews",
  neonai: "┃neonai",
  featuresList: "┃features-list",
  extraHardware: "┃extra-hardware",
  changelogs: "┃changelogs",
  setup: "┃setup",
  guide: "┃guide",
  ticket: "┃ticket",
  customerSupport: "┃customer-support",
  redeem: "┃redeem",
  reviewUs: "┃review-us",
  reportBug: "┃report-a-bug",
  reportBan: "┃report-a-ban",
  ticketLogs: "┃ticket-logs",
  redeemRequests: "┃redeem-requests",
  customerReviews: "┃customer-reviews",
  bugReports: "┃bug-reports",
  banReports: "┃ban-reports",
  chat: "┃chat",
  voice: "┃voice",
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
    // No Administrator — channel overwrites (e.g. ticket-logs) must stick.
    // Server owner keeps full power outside roles.
    permissions: [
      PermissionFlagsBits.ManageGuild,
      PermissionFlagsBits.ManageChannels,
      PermissionFlagsBits.ManageRoles,
      PermissionFlagsBits.ManageNicknames,
      PermissionFlagsBits.KickMembers,
      PermissionFlagsBits.BanMembers,
      PermissionFlagsBits.ModerateMembers,
      PermissionFlagsBits.ManageMessages,
      PermissionFlagsBits.ViewAuditLog,
      PermissionFlagsBits.MentionEveryone,
    ],
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
  /** Staff can view only — no send/delete (survives Manage Messages; not Administrator) */
  immutableStaffLogs?: boolean;
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
        name: CHANNELS.updates,
        type: ChannelType.GuildText,
        topic: "Product and server updates.",
        readOnly: true,
        memberOnly: true,
      },
      {
        name: CHANNELS.news,
        type: ChannelType.GuildText,
        topic: "Major announcements and important notices.",
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
        staffOnly: true,
      },
      {
        name: CHANNELS.featuresList,
        type: ChannelType.GuildText,
        topic: "Feature breakdown: aim assist, humanization, configs.",
        readOnly: true,
        staffOnly: true,
      },
      {
        name: CHANNELS.extraHardware,
        type: ChannelType.GuildText,
        topic: "Optional external hardware and isolation setups.",
        readOnly: true,
        staffOnly: true,
      },
      {
        name: CHANNELS.changelogs,
        type: ChannelType.GuildText,
        topic: "Build updates, model releases, and patch notes.",
        readOnly: true,
        staffOnly: true,
      },
      {
        name: CHANNELS.setup,
        type: ChannelType.GuildText,
        topic: "Setup, configs, and first-run guidance — customers only.",
        readOnly: true,
        customerOnly: true,
      },
      {
        name: CHANNELS.guide,
        type: ChannelType.GuildText,
        topic: "How to install NeonAi and usage guides — customers only.",
        readOnly: true,
        customerOnly: true,
      },
      {
        name: CHANNELS.reviewUs,
        type: ChannelType.GuildText,
        topic: "Submit a private review — opens a form for staff only.",
        readOnly: true,
        customerOnly: true,
      },
      {
        name: CHANNELS.reportBug,
        type: ChannelType.GuildText,
        topic: "Submit a private bug report — opens a form for staff only.",
        readOnly: true,
        customerOnly: true,
      },
      {
        name: CHANNELS.reportBan,
        type: ChannelType.GuildText,
        topic: "Submit a private ban report — opens a form for staff only.",
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
        topic: "Verify your customer key to unlock Customer access.",
        readOnly: true,
        memberOnly: true,
      },
      {
        name: CHANNELS.ticketLogs,
        type: ChannelType.GuildText,
        topic: "Closed ticket transcripts — view only for staff; deletes restricted.",
        immutableStaffLogs: true,
      },
    ],
  },
  {
    name: CATEGORIES.staff,
    channels: [
      {
        name: CHANNELS.members,
        type: ChannelType.GuildText,
        topic: "Staff-only channel. Use /members for the full member list.",
        readOnly: true,
        staffOnly: true,
      },
      {
        name: CHANNELS.redeemRequests,
        type: ChannelType.GuildText,
        topic: "Pending license redeem requests — Accept or Deny.",
        staffOnly: true,
      },
      {
        name: CHANNELS.customerReviews,
        type: ChannelType.GuildText,
        topic: "Private customer reviews submitted via #┃review-us.",
        staffOnly: true,
      },
      {
        name: CHANNELS.bugReports,
        type: ChannelType.GuildText,
        topic: "Private bug reports submitted via #┃report-a-bug.",
        staffOnly: true,
      },
      {
        name: CHANNELS.banReports,
        type: ChannelType.GuildText,
        topic: "Private ban reports submitted via #┃report-a-ban.",
        staffOnly: true,
      },
      {
        name: CHANNELS.chat,
        type: ChannelType.GuildText,
        topic: "Staff chat only.",
        staffOnly: true,
      },
      {
        name: CHANNELS.voice,
        type: ChannelType.GuildVoice,
        staffOnly: true,
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

/** Owner / Administrator / named staff roles — skip ticket open cooldowns */
export function canBypassTicketLimits(guild: Guild, member: GuildMember) {
  const ownerId = process.env.DISCORD_OWNER_ID;
  if (ownerId && member.id === ownerId) return true;
  if (member.id === guild.ownerId) return true;
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  return isStaffMember(resolveRoleMap(guild), member.roles);
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

  if (channel.verifyChannel) {
    overwrites.push({
      id: everyone.id,
      allow: [
        ...memberRead,
        PermissionFlagsBits.CreatePrivateThreads,
        PermissionFlagsBits.SendMessagesInThreads,
      ],
      deny: [
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.CreatePublicThreads,
      ],
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
    addStaffAccess(overwrites, roles, [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.ReadMessageHistory,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.SendMessagesInThreads,
      PermissionFlagsBits.ManageThreads,
      PermissionFlagsBits.CreatePrivateThreads,
    ]);
    addBotAccess(guild, overwrites);
    const botRoleId = guild.members.me?.roles.botRole?.id;
    if (botRoleId) {
      const bot = overwrites.find((overwrite) => overwrite.id === botRoleId);
      if (bot) {
        bot.allow = [
          ...(bot.allow ?? []),
          PermissionFlagsBits.ManageThreads,
          PermissionFlagsBits.CreatePrivateThreads,
          PermissionFlagsBits.SendMessagesInThreads,
        ];
      }
    }
    return overwrites;
  }

  if (channel.immutableStaffLogs) {
    overwrites.push({
      id: everyone.id,
      deny: [PermissionFlagsBits.ViewChannel],
    });
    const staffViewOnly = [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.ReadMessageHistory,
    ];
    const staffDenyMutate = [
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.ManageMessages,
      PermissionFlagsBits.AttachFiles,
      PermissionFlagsBits.AddReactions,
      PermissionFlagsBits.CreatePublicThreads,
      PermissionFlagsBits.CreatePrivateThreads,
      PermissionFlagsBits.SendMessagesInThreads,
      PermissionFlagsBits.ManageChannels,
    ];
    for (const role of staffRoles(roles)) {
      overwrites.push({
        id: role.id,
        allow: staffViewOnly,
        deny: staffDenyMutate,
      });
    }
    const botRoleId = guild.members.me?.roles.botRole?.id;
    if (botRoleId) {
      overwrites.push({
        id: botRoleId,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.EmbedLinks,
          PermissionFlagsBits.AttachFiles,
        ],
        deny: [PermissionFlagsBits.ManageMessages],
      });
    }
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

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Guild, GuildMember } from "discord.js";
import { normalizeLicenseKey } from "./license-lookup.js";
import { isStaffMember, resolveRoleMap } from "./layout.js";

type CustomerKeyRecord = {
  last4: string;
  /** Full normalized key — staff inboxes only */
  key: string;
  tier?: string;
  updatedAt: string;
};

type Store = {
  updatedAt: string;
  byUserId: Record<string, CustomerKeyRecord>;
};

function storePath() {
  return join(dirname(fileURLToPath(import.meta.url)), "..", "data", "customer-key-tags.json");
}

function loadStore(): Store {
  const path = storePath();
  if (!existsSync(path)) return { updatedAt: new Date().toISOString(), byUserId: {} };
  try {
    return JSON.parse(readFileSync(path, "utf8")) as Store;
  } catch {
    return { updatedAt: new Date().toISOString(), byUserId: {} };
  }
}

function saveStore(store: Store) {
  const path = storePath();
  mkdirSync(dirname(path), { recursive: true });
  store.updatedAt = new Date().toISOString();
  writeFileSync(path, JSON.stringify(store, null, 2));
}

export function keyLast4(key: string) {
  const n = normalizeLicenseKey(key);
  return n.slice(-4).toUpperCase();
}

export function getCustomerKeyTag(userId: string): CustomerKeyRecord | null {
  return loadStore().byUserId[userId] ?? null;
}

export function rememberCustomerKeyTag(
  userId: string,
  key: string,
  tier?: string
) {
  const normalized = normalizeLicenseKey(key);
  const store = loadStore();
  store.byUserId[userId] = {
    last4: keyLast4(normalized),
    key: normalized,
    tier,
    updatedAt: new Date().toISOString(),
  };
  saveStore(store);
}

/** Strip prior NeonAi key suffix so we don't stack · ABCD · EFGH */
export function stripKeyTagFromNick(nick: string) {
  return nick.replace(/\s*[·|]\s*[A-Z0-9]{4}\s*$/i, "").trim();
}

/**
 * Staff-facing key tag in the server nickname: "Display · XXXX"
 * Discord cannot hide nicknames from other members who share a channel —
 * we keep chat/voice staff-only so this mainly surfaces in staff views + /members.
 */
export async function applyCustomerKeyNickname(
  guild: Guild,
  userId: string,
  key: string,
  tier?: string
) {
  const last4 = keyLast4(key);
  rememberCustomerKeyTag(userId, key, tier);

  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member) return { ok: false as const, last4 };

  const roles = resolveRoleMap(guild);
  // Don't rewrite staff/admin display names
  if (isStaffMember(roles, member.roles)) {
    return { ok: true as const, last4, skipped: "staff" as const };
  }

  const base = stripKeyTagFromNick(
    member.nickname ?? member.user.globalName ?? member.user.username
  ).slice(0, 26);
  const nick = `${base} · ${last4}`.slice(0, 32);

  try {
    await member.setNickname(nick, `NeonAi redeem key tag ·${last4}`);
    return { ok: true as const, last4, nick };
  } catch {
    return { ok: false as const, last4 };
  }
}

export function formatMemberKeyTag(member: GuildMember) {
  const tag = getCustomerKeyTag(member.id);
  if (!tag) return null;
  return `·${tag.last4}`;
}

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export type ReferralRecord = {
  code: string;
  ownerId: string;
  license: string;
  key: string;
  status: "pending" | "approved" | "denied";
};

type Store = { codes: ReferralRecord[] };

const filePath = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "referral-codes.json");

function load(): Store {
  if (!existsSync(filePath)) return { codes: [] };
  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf8")) as Store;
    return { codes: Array.isArray(parsed.codes) ? parsed.codes : [] };
  } catch {
    return { codes: [] };
  }
}

function save(store: Store) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(store, null, 2));
}

export function normalizeReferralCode(raw: string) {
  return raw.trim().toUpperCase();
}

export function isReferralCode(raw: string) {
  return /^[A-Z0-9]{6}$/.test(normalizeReferralCode(raw));
}

export function findReferralCode(code: string) {
  const normalized = normalizeReferralCode(code);
  return load().codes.find((record) => record.code === normalized) ?? null;
}

export function codeTaken(code: string) {
  const found = findReferralCode(code);
  return Boolean(found && found.status !== "denied");
}

export function saveReferralCode(record: ReferralRecord) {
  const store = load();
  const normalized = normalizeReferralCode(record.code);
  const next = { ...record, code: normalized };
  const index = store.codes.findIndex((item) => item.code === normalized);
  if (index >= 0) store.codes[index] = next;
  else store.codes.push(next);
  save(store);
  return next;
}

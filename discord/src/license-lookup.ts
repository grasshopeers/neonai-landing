import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { LicenseTier } from "./tiers.js";
import { isLicenseTier } from "./tiers.js";

export type InventoryStatus = "unused" | "used" | "expired" | "revoked" | "invalid";

export type KeyLookupResult = {
  found: boolean;
  status: InventoryStatus;
  plan: string | null;
  /** Mapped Discord license tier when known */
  tier: LicenseTier | null;
  source: "inventory" | "verify-status" | "none";
  reason?: string;
};

const VERIFY_STATUS_URL =
  process.env.NEONAI_VERIFY_STATUS_URL ??
  "https://neonai-license.shioneggs.workers.dev/verify-status";

const PLAN_TO_TIER: Record<string, LicenseTier | null> = {
  "24h": null,
  "24hour": null,
  "24hours": null,
  "1week": "1 Week",
  week: "1 Week",
  "7d": "1 Week",
  "1month": "1 Month",
  month: "1 Month",
  monthly: "1 Month",
  standard: "1 Month",
  "3months": "3 Months",
  "3month": "3 Months",
  lifetime: "Lifetime",
  life: "Lifetime",
  forever: "Lifetime",
};

type IndexEntry = {
  hash: string;
  plan: string;
  status: InventoryStatus;
};

type IndexFile = {
  updatedAt: string;
  entries: IndexEntry[];
};

function here() {
  return dirname(fileURLToPath(import.meta.url));
}

export function normalizeLicenseKey(raw: string) {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

export function hashLicenseKey(key: string) {
  return createHash("sha256").update(normalizeLicenseKey(key)).digest("hex");
}

export function maskLicenseKey(key: string) {
  const n = normalizeLicenseKey(key);
  if (n.length <= 4) return "****";
  return `****-****-****-${n.slice(-4)}`;
}

export function planToTier(plan: string | null | undefined): LicenseTier | null {
  if (!plan) return null;
  const label = plan.trim();
  if (isLicenseTier(label)) return label;
  const mapped = PLAN_TO_TIER[label.toLowerCase().replace(/\s+/g, "")];
  if (mapped) return mapped;
  const lower = label.toLowerCase();
  if (lower.includes("week")) return "1 Week";
  if (lower.includes("3 month") || lower.includes("quarter")) return "3 Months";
  if (lower.includes("month")) return "1 Month";
  if (lower.includes("life")) return "Lifetime";
  return null;
}

function loadHashedIndex(): IndexFile | null {
  const candidates = [
    process.env.LICENSE_INVENTORY_INDEX_PATH,
    join(here(), "..", "data", "license-inventory-index.json"),
  ].filter(Boolean) as string[];

  for (const path of candidates) {
    if (!existsSync(path)) continue;
    try {
      return JSON.parse(readFileSync(path, "utf8")) as IndexFile;
    } catch {
      /* try next */
    }
  }
  return null;
}

/** Parse plaintext inventory (local only — never ship this file to Render) */
export function parseInventoryFile(text: string): IndexEntry[] {
  const entries: IndexEntry[] = [];
  let plan = "unknown";
  let status: InventoryStatus = "unused";

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const planMatch = line.match(
      /^(24 Hour|1 Week|1 Month|3 Months|Lifetime|Standard)\s*\(([^)]+)\)/i
    );
    if (planMatch) {
      plan = planMatch[2].trim().toLowerCase();
      continue;
    }

    if (/^\[UNUSED\]/i.test(line)) {
      status = "unused";
      continue;
    }
    if (/^\[USED\]/i.test(line)) {
      status = "used";
      continue;
    }
    if (/^\[EXPIRED\]/i.test(line)) {
      status = "expired";
      continue;
    }
    if (/^\[REVOKED\]/i.test(line)) {
      status = "revoked";
      continue;
    }

    const keyMatch = line.match(
      /^([A-Z0-9]{4}(?:-[A-Z0-9]{4}){3})(?:\s|$)/i
    );
    if (!keyMatch) continue;

    entries.push({
      hash: hashLicenseKey(keyMatch[1]),
      plan,
      status,
    });
  }

  return entries;
}

function lookupInIndex(key: string): KeyLookupResult | null {
  const index = loadHashedIndex();
  if (!index) return null;

  const hash = hashLicenseKey(key);
  const hit = index.entries.find((e) => e.hash === hash);
  if (!hit) return null;

  return {
    found: true,
    status: hit.status,
    plan: hit.plan,
    tier: planToTier(hit.plan),
    source: "inventory",
  };
}

function lookupInPlaintextInventory(key: string): KeyLookupResult | null {
  const path = process.env.LICENSE_INVENTORY_PATH;
  if (!path || !existsSync(path)) return null;

  try {
    const entries = parseInventoryFile(readFileSync(path, "utf8"));
    const hash = hashLicenseKey(key);
    const hit = entries.find((e) => e.hash === hash);
    if (!hit) return null;
    return {
      found: true,
      status: hit.status,
      plan: hit.plan,
      tier: planToTier(hit.plan),
      source: "inventory",
    };
  } catch {
    return null;
  }
}

async function lookupVerifyStatus(key: string): Promise<KeyLookupResult> {
  try {
    const res = await fetch(VERIFY_STATUS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: normalizeLicenseKey(key) }),
    });
    const data = (await res.json()) as {
      valid?: boolean;
      reason?: string | null;
      plan?: string;
      activated?: boolean;
      revoked?: boolean;
    };

    if (data.reason === "invalid_key" || data.reason === "invalid_key_data") {
      return {
        found: false,
        status: "invalid",
        plan: null,
        tier: null,
        source: "verify-status",
        reason: data.reason,
      };
    }

    if (data.revoked || data.reason === "revoked") {
      return {
        found: true,
        status: "revoked",
        plan: data.plan ?? null,
        tier: planToTier(data.plan),
        source: "verify-status",
        reason: "revoked",
      };
    }

    if (data.reason === "expired") {
      return {
        found: true,
        status: "expired",
        plan: data.plan ?? null,
        tier: planToTier(data.plan),
        source: "verify-status",
        reason: "expired",
      };
    }

    if (data.valid) {
      return {
        found: true,
        status: data.activated ? "used" : "unused",
        plan: data.plan ?? null,
        tier: planToTier(data.plan),
        source: "verify-status",
      };
    }

    return {
      found: false,
      status: "invalid",
      plan: data.plan ?? null,
      tier: planToTier(data.plan),
      source: "verify-status",
      reason: data.reason ?? "unknown",
    };
  } catch (err) {
    return {
      found: false,
      status: "invalid",
      plan: null,
      tier: null,
      source: "none",
      reason: err instanceof Error ? err.message : "verify_failed",
    };
  }
}

/** Inventory hash index first, then optional plaintext path, then Cloudflare verify-status */
export async function lookupLicenseKey(rawKey: string): Promise<KeyLookupResult> {
  const key = normalizeLicenseKey(rawKey);
  if (!key) {
    return {
      found: false,
      status: "invalid",
      plan: null,
      tier: null,
      source: "none",
      reason: "missing_key",
    };
  }

  const fromIndex = lookupInIndex(key);
  if (fromIndex) return fromIndex;

  const fromFile = lookupInPlaintextInventory(key);
  if (fromFile) return fromFile;

  return lookupVerifyStatus(key);
}

export function canAutoAccept(
  lookup: KeyLookupResult,
  selectedTier: LicenseTier
): { ok: true } | { ok: false; reason: string } {
  if (!lookup.found) {
    return { ok: false, reason: "Key not found in inventory — queued for staff." };
  }
  if (lookup.status === "expired") {
    return { ok: false, reason: "This license key is expired." };
  }
  if (lookup.status === "revoked") {
    return { ok: false, reason: "This license key has been revoked." };
  }
  if (lookup.status !== "unused" && lookup.status !== "used") {
    return { ok: false, reason: "This license key cannot be redeemed automatically." };
  }
  if (!lookup.tier) {
    return {
      ok: false,
      reason: "Key found but plan could not be matched to a tier — queued for staff.",
    };
  }
  if (lookup.tier !== selectedTier) {
    return {
      ok: false,
      reason: `Selected tier **${selectedTier}** does not match key plan **${lookup.tier}**.`,
    };
  }
  return { ok: true };
}

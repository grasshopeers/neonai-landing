import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  LIFETIME_MIN_MONTH_CREDITS,
  tierMonthCredits,
  type LicenseTier,
} from "./tiers.js";

type PurchaseRecord = {
  tier: Exclude<LicenseTier, "Lifetime">;
  at: string;
};

type UserHistory = {
  purchases: PurchaseRecord[];
};

type HistoryFile = Record<string, UserHistory>;

const dataDir = join(dirname(fileURLToPath(import.meta.url)), "..", "data");
const historyPath = join(dataDir, "purchase-history.json");

function loadHistory(): HistoryFile {
  if (!existsSync(historyPath)) return {};
  try {
    return JSON.parse(readFileSync(historyPath, "utf8")) as HistoryFile;
  } catch {
    return {};
  }
}

function saveHistory(data: HistoryFile) {
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
  writeFileSync(historyPath, JSON.stringify(data, null, 2), "utf8");
}

export function getPurchasedMonthCredits(userId: string): number {
  const history = loadHistory();
  const record = history[userId];
  if (!record) return 0;

  return record.purchases.reduce(
    (total, purchase) => total + tierMonthCredits(purchase.tier),
    0
  );
}

export function isLifetimeEligible(userId: string): boolean {
  return getPurchasedMonthCredits(userId) >= LIFETIME_MIN_MONTH_CREDITS;
}

export function recordLicensePurchase(
  userId: string,
  tier: LicenseTier
): void {
  if (tier === "Lifetime") return;

  const history = loadHistory();
  const record = history[userId] ?? { purchases: [] };

  record.purchases.push({
    tier,
    at: new Date().toISOString(),
  });

  history[userId] = record;
  saveHistory(history);
}

export function lifetimeRequirementMessage(userId: string): string {
  const credits = getPurchasedMonthCredits(userId);
  const remaining = Math.max(0, LIFETIME_MIN_MONTH_CREDITS - credits);

  return [
    `Hey <@${userId}> — **Lifetime** is only available after you've purchased **at least 3 months** of licenses in the past.`,
    "",
    `Your recorded history: **${formatMonthCredits(credits)}** of prior licenses.`,
    remaining > 0
      ? `You still need about **${formatMonthCredits(remaining)}** more from **1 Week**, **1 Month**, or **3 Months** tiers first.`
      : "",
    "",
    "Start with a shorter tier — once you've hit 3 months total, staff can process Lifetime for you.",
  ]
    .filter(Boolean)
    .join("\n");
}

function formatMonthCredits(credits: number): string {
  if (credits >= 1) {
    const rounded = Math.round(credits * 10) / 10;
    return rounded === 1 ? "1 month" : `${rounded} months`;
  }

  const weeks = Math.round(credits * 4);
  return weeks === 1 ? "1 week" : `${weeks} weeks`;
}

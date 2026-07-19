/** License tiers for /deliver and /stripe — values must match exactly */
export const LICENSE_TIERS = [
  { name: "1 Week", value: "1 Week", price: 22 },
  { name: "1 Month", value: "1 Month", price: 34 },
  { name: "3 Months", value: "3 Months", price: 68 },
  { name: "Lifetime", value: "Lifetime", price: 89 },
] as const;

export type LicenseTier = (typeof LICENSE_TIERS)[number]["value"];

/** Prior license months required before Lifetime can be purchased */
export const LIFETIME_MIN_MONTH_CREDITS = 3;

export function isLicenseTier(value: string): value is LicenseTier {
  return LICENSE_TIERS.some((t) => t.value === value);
}

export function tierMonthCredits(tier: Exclude<LicenseTier, "Lifetime">): number {
  switch (tier) {
    case "1 Week":
      return 0.25;
    case "1 Month":
      return 1;
    case "3 Months":
      return 3;
  }
}

export function formatTierList() {
  return LICENSE_TIERS.map((tier) => {
    const line = `• **${tier.name}** — $${tier.price}`;
    if (tier.value === "Lifetime") {
      return `${line} _(requires 3+ months of prior licenses)_`;
    }
    return line;
  }).join("\n");
}

export function getTierPrice(tier: LicenseTier) {
  return LICENSE_TIERS.find((t) => t.value === tier)?.price;
}

export function formatLifetimeRequirement() {
  return "Lifetime requires **at least 3 months** of prior license purchases (e.g. one **3 Months** license, or multiple shorter tiers totaling 3+ months).";
}

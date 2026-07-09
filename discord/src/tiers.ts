/** License tiers for /deliver and /stripe — values must match exactly */
export const LICENSE_TIERS = [
  { name: "1 Week", value: "1 Week", price: 14 },
  { name: "1 Month", value: "1 Month", price: 29 },
  { name: "3 Months", value: "3 Months", price: 39 },
  { name: "Lifetime", value: "Lifetime", price: 89 },
] as const;

export type LicenseTier = (typeof LICENSE_TIERS)[number]["value"];

export function isLicenseTier(value: string): value is LicenseTier {
  return LICENSE_TIERS.some((t) => t.value === value);
}

export function formatTierList() {
  return LICENSE_TIERS.map((tier) => `• **${tier.name}** — $${tier.price}`).join(
    "\n"
  );
}

export function getTierPrice(tier: LicenseTier) {
  return LICENSE_TIERS.find((t) => t.value === tier)?.price;
}

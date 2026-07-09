/** Official site — set NEONAI_WEBSITE_URL in discord/.env when deployed */
export const NEONAI_SITE_URL =
  process.env.NEONAI_WEBSITE_URL ?? "https://neonai.app";

export const SYSTEM_REQUIREMENTS = [
  "Windows 10 / 11",
  "DirectML-compatible GPU (recommended for vision inference)",
  "1080p display minimum",
  "Optional external hardware for advanced isolation setups",
] as const;

export function siteRequirementsUrl() {
  return `${NEONAI_SITE_URL.replace(/\/$/, "")}/#faq`;
}

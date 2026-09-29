/** Official site — set NEONAI_WEBSITE_URL in discord/.env when deployed */
export const NEONAI_SITE_URL =
  process.env.NEONAI_WEBSITE_URL ?? "https://neonai.app";

/** Single Ko-fi tip page — customers tip the tier amount once */
export const KOFI_TIP_URL =
  process.env.KOFI_TIP_URL ?? "https://ko-fi.com/drowndeer";

/** PayPal.me link posted in purchase tickets */
export const PAYPAL_PAYMENT_URL =
  process.env.PAYPAL_PAYMENT_URL ?? "https://www.paypal.com/paypalme/Aasimzaz";

/** Remitly bank-deposit details (UAE / FAB) */
export const REMITLY_PAYMENT = {
  mode: "Bank Deposit",
  country: "UNITED ARAB EMIRATES",
  bank: "First Abu Dhabi Bank",
  name: "Aasim Attar",
  iban: "AE660355640012024819550",
  ibanDisplay: "AE66 0355 6400 1202 4819 550",
  phone: "+971507241373",
} as const;

/** Unlisted install guide (posted in #┃guide) */
export const TUTORIAL_INSTALL_URL =
  process.env.TUTORIAL_INSTALL_URL ??
  "https://www.youtube.com/watch?v=Xmsy5dNM6TA";

export const SYSTEM_REQUIREMENTS = [
  "Windows 10 / 11",
  "DirectML-compatible GPU (recommended for vision inference)",
  "1080p display minimum",
  "Optional external hardware for advanced isolation setups",
] as const;

export function siteRequirementsUrl() {
  return `${NEONAI_SITE_URL.replace(/\/$/, "")}/#faq`;
}

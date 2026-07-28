import { Crosshair, Shield, Zap, Headphones } from "lucide-react";

/** Discord server invite — all purchase CTAs redirect here for ticket bot flow */
export const DISCORD_INVITE_URL = "https://discord.gg/mPD4AfwbGU";

/** Read-only license status (website verify page — no model_key, no HWID bind) */
export const VERIFY_STATUS_URL =
  "https://neonai-license.shioneggs.workers.dev/verify-status";

export type VerifyStatusResponse = {
  valid: boolean;
  reason?: string | null;
  plan?: string;
  plan_label?: string;
  expires?: string | null;
  activated?: boolean;
  revoked?: boolean;
  server_time?: string;
};

/** @deprecated Use DISCORD_INVITE_URL — kept as alias for community links */
export const DISCORD_URL = DISCORD_INVITE_URL;

/** Append optional ?source= for future analytics (bot can read on join if needed) */
export function getPurchaseDiscordUrl(source = "purchase"): string {
  const url = new URL(DISCORD_INVITE_URL);
  url.searchParams.set("source", source);
  return url.toString();
}

export const NAV_LINKS = [
  { label: "Features", href: "#features", sectionId: "features" },
  { label: "Pricing", href: "#pricing", sectionId: "pricing" },
  { label: "Verify Key", href: "/verify", sectionId: "verify", external: true },
  { label: "Control Panel", href: "#demo", sectionId: "demo" },
  { label: "FAQ", href: "#faq", sectionId: "faq" },
  { label: "Discord", href: DISCORD_INVITE_URL, sectionId: "discord-cta" },
];

export const FEATURES = [
  {
    icon: Crosshair,
    title: "Universal Support",
    description: "Seamless integration across multiple game titles.",
  },
  {
    icon: Shield,
    title: "External by Design",
    description:
      "Screen capture and vector math — no memory reads, no process injection, ever.",
  },
  {
    icon: Zap,
    title: "Zero Input Delay",
    description:
      "Fully multi-threaded architecture with optimized engine loops.",
  },
  {
    icon: Headphones,
    title: "24/7 Live Support",
    description: "Direct integration with community ticket systems.",
  },
];

export type DemoTab =
  | "aim-assist"
  | "humanization"
  | "target-settings"
  | "configs";

export const DEMO_TABS: { id: DemoTab; label: string }[] = [
  { id: "aim-assist", label: "Aim Assist" },
  { id: "humanization", label: "Humanization" },
  { id: "target-settings", label: "Target Settings" },
  { id: "configs", label: "Configs" },
];

export const FAQ_ITEMS = [
  {
    question: "How does NeonAi work?",
    answer:
      "NeonAi uses optimized screen capture and vision models to compute external mouse offset instructions — no game memory access or process injection required.",
  },
  {
    question: "What hardware is required?",
    answer:
      "NeonAi requires Windows 10 or 11 (64-bit) and a 1080p display minimum. A DirectML-compatible GPU is recommended for vision inference, though the software runs fully standalone without external hardware. Exact requirements depend on your system and use case — open a support ticket in our Discord for a personalized compatibility review.",
  },
  {
    question: "Do you support external hardware?",
    answer:
      "Yes. NeonAi supports external input devices for advanced isolation, including Makcu, Arduino-based controllers, and other compatible microcontroller boards. Supported devices and setup steps may vary — open a ticket in our Discord and our team will walk you through the right configuration for your hardware.",
  },
  {
    question: "Can I use this with Valorant?",
    answer:
      "Using NeonAi for Valorant without external hardware support is not recommended. Kernel-level anti-cheat on the same system carries significant risk with any third-party tooling. For guidance on external hardware options and setup, please open a support ticket in our Discord — our team will advise on compatible configurations.",
  },
  {
    question: "How do I purchase a license?",
    answer:
      "Click any Get License or Purchase button on this site — you'll be redirected to our Discord server where our ticket bot opens a private channel and walks you through tier selection and payment. Current tiers: Weekly ($22), Monthly ($34), Quarterly ($59), and Lifetime ($95).",
  },
  {
    question: "Who can buy Lifetime?",
    answer:
      "Lifetime is available only if you've previously purchased at least 3 months worth of licenses (for example, one Quarterly license, or multiple shorter tiers that add up to 3+ months). New customers should start with Weekly, Monthly, or Quarterly first.",
  },
  {
    question: "What is the return policy?",
    answer:
      "All purchases are final once a license is activated. Due to the digital, single-use nature of our activations, refunds are not available under standard terms. If you believe your situation qualifies as an exception, please submit a support ticket through Discord and our team will review your case.",
  },
  {
    question: "Are my payments secure?",
    answer:
      "Yes. All payments are processed through Stripe, a PCI DSS Level 1 certified payment provider trusted by millions of businesses worldwide. Your card details are encrypted end-to-end and never stored on our servers — Stripe handles tokenization and fraud protection directly. We never see or retain your full payment information.",
  },
];

export const SAVED_CONFIGS = [
  { name: "Tactical — FPS A", active: true },
  { name: "Arena — Battle Royale", active: false },
  { name: "Precision — Tactical Shooter", active: false },
];

export const PRICING_TIERS = [
  {
    id: "1_week",
    name: "Weekly",
    price: 22,
    highlight: false,
    tag: "Quick trial",
  },
  {
    id: "1_month",
    name: "Monthly",
    price: 34,
    highlight: false,
    tag: "Flexible start",
  },
  {
    id: "3_months",
    name: "Quarterly",
    price: 59,
    highlight: true,
    tag: "Best value",
  },
  {
    id: "lifetime",
    name: "Lifetime",
    price: 95,
    highlight: false,
    tag: "Requires 3 mo. prior",
    note: "Available only after 3+ months of prior license purchases.",
  },
];

export const HERO_ROTATE_WORDS = ["Precision", "Performance", "Control"];

export const HERO_STATS = [
  { value: 200, suffix: "+", label: "FPS maintained", prefix: "" },
  { value: 1, suffix: "ms", label: "Capture latency", prefix: "<" },
  { display: "Custom", label: "Customizable models" },
] as const;

export const ACTIVATION_TICKER_ITEMS = [
  "User in EU activated license",
  "User in NA online — VTM active",
  "User in APAC loaded config: Tactical — FPS A",
  "User in EU switched to DXGI capture",
  "User in NA session started — external mode",
];

export const SYSTEM_REQUIREMENTS = [
  "Windows 10 / 11",
  "DirectML GPU (optional)",
  "1080p display minimum",
];

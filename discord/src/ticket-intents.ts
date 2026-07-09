import { formatTierList, getTierPrice, type LicenseTier } from "./tiers.js";
import { CHANNELS } from "./layout.js";
import {
  NEONAI_SITE_URL,
  SYSTEM_REQUIREMENTS,
  siteRequirementsUrl,
} from "./site.js";
import type { TicketKind } from "./ticket-guard.js";

export type TicketIntent =
  | "invalid_plan"
  | "payment"
  | "valid_tier"
  | "compatibility_intro"
  | "compatibility_followup"
  | "technical_patience"
  | "fallback";

const VALID_TIER_PATTERNS: { pattern: RegExp; name: string }[] = [
  { pattern: /\b(1|one)\s*[-]?\s*weeks?\b/i, name: "1 Week" },
  { pattern: /\b1week\b/i, name: "1 Week" },
  { pattern: /\b(3|three)\s*[-]?\s*months?\b/i, name: "3 Months" },
  { pattern: /\b3months?\b/i, name: "3 Months" },
  { pattern: /\b(1|one)\s*[-]?\s*months?\b/i, name: "1 Month" },
  { pattern: /\b1months?\b/i, name: "1 Month" },
  { pattern: /\b(monthly)\b/i, name: "1 Month" },
  { pattern: /\blifetime\b/i, name: "Lifetime" },
  { pattern: /\blife\s*time\b/i, name: "Lifetime" },
];

const DURATION_OR_PLAN_HINT =
  /\b\d+\s*[-]?\s*(day|week|month|year|hr|hour|min|minute)s?\b|\b\d+(day|week|month|year)s?\b|\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|thirty)\s+(day|week|month|year|hour|minute)s?\b|\b(daily|weekly|monthly|yearly|hourly)\b|\b(license|licence|plan|tier|subscription|sub|lisence)\b/i;

function isPaymentQuestion(text: string) {
  const t = text.toLowerCase();
  return (
    /how\s+(do|can|should|would|will)\s+i\s+pay/.test(t) ||
    /how\s+(do|does)\s+(the\s+)?payment/.test(t) ||
    /how\s+(to|do i)\s+(purchase|buy|checkout|order)/.test(t) ||
    /how\s+(does|do)\s+(buying|purchasing|checkout)\s+work/.test(t) ||
    /payment\s+(work|works|method|methods|process|link|option|options)/.test(
      t
    ) ||
    /(where|how)\s+(do|can)\s+i\s+(pay|purchase|buy|checkout)/.test(t) ||
    /\bstripe\b/.test(t) ||
    /(pay|payment|checkout|purchase)\s*\?/.test(t) ||
    /what\s+(payment|pay)\s+method/.test(t)
  );
}

export function matchValidTier(text: string) {
  for (const { pattern, name } of VALID_TIER_PATTERNS) {
    if (pattern.test(text)) return name;
  }
  return null;
}

function mentionsUnsupportedDuration(text: string) {
  return DURATION_OR_PLAN_HINT.test(text) && !matchValidTier(text);
}

export function classifyTicketMessage(
  text: string,
  context?: { ticketKind: TicketKind; compatibilityIntroSent: boolean }
): {
  intent: TicketIntent;
  tier?: string;
} {
  if (context?.ticketKind === "technical") {
    return { intent: "technical_patience" };
  }

  if (isPaymentQuestion(text)) {
    return { intent: "payment" };
  }

  const tier = matchValidTier(text);
  if (tier) {
    return { intent: "valid_tier", tier };
  }

  if (mentionsUnsupportedDuration(text)) {
    return { intent: "invalid_plan" };
  }

  if (context?.ticketKind === "compatibility") {
    if (!context.compatibilityIntroSent) {
      return { intent: "compatibility_intro" };
    }
    return { intent: "compatibility_followup" };
  }

  return { intent: "fallback" };
}

/** Intents that repeat the same "please wait / staff is coming" style reply */
export function isPatienceSpamIntent(intent: TicketIntent) {
  return (
    intent === "fallback" ||
    intent === "compatibility_followup" ||
    intent === "technical_patience"
  );
}

export function buildTicketReply(
  userId: string,
  intent: TicketIntent,
  tier?: string
) {
  const tiers = formatTierList();

  switch (intent) {
    case "invalid_plan":
      return {
        title: "Plan Not Available",
        description: [
          `Hey <@${userId}> — **that duration isn't part of our current license lineup.**`,
          "",
          "NeonAi is only offered on these tiers right now:",
          tiers,
          "",
          "Reply with one of the tiers above and a staff member will send your secure checkout link.",
        ].join("\n"),
        pingStaff: false,
      };

    case "payment":
      return {
        title: "How Payment Works",
        description: [
          `Hey <@${userId}> — here's how purchasing works:`,
          "",
          "1. Tell us your preferred **license tier** (if you haven't already).",
          "2. A staff member will post a secure **Stripe** checkout link in this ticket.",
          "3. Open the link and complete payment on Stripe's official hosted checkout page.",
          "4. Once confirmed, your **license key** is delivered right here in this channel.",
          "",
          "🔒 **All payments are processed and secured through Stripe** — encrypted checkout, PCI-compliant, and we never see your card details.",
          "",
          "**Please do not** send card details, OTPs, or payment screenshots in chat.",
        ].join("\n"),
        pingStaff: false,
      };

    case "valid_tier": {
      const price = tier ? getTierPrice(tier as LicenseTier) : null;
      return {
        title: "Tier Received",
        description: [
          `Thanks <@${userId}> — noted your interest in **${tier}**${price ? ` ($${price})` : ""}.`,
          "",
          "A staff member will send your secure **Stripe** payment link here shortly.",
          "All payments are processed and secured through **Stripe**.",
          "Please keep this ticket open until your key is delivered.",
        ].join("\n"),
        pingStaff: true,
      };
    }

    case "compatibility_intro": {
      const requirements = SYSTEM_REQUIREMENTS.map((r) => `• ${r}`).join("\n");
      return {
        title: "Hardware & Compatibility",
        description: [
          `Thank you for reaching out, <@${userId}>.`,
          "",
          "For the most up-to-date **system requirements**, supported hardware, and compatibility guidance, please review our official website first:",
          `🔗 [**NeonAi — System Requirements & FAQ**](${siteRequirementsUrl()})`,
          "",
          "**Quick reference:**",
          requirements,
          "",
          `You can also check **#${CHANNELS.extraHardware}** in this server for optional external hardware notes.`,
          "",
          "If your question isn't covered there, reply here with your **Windows version**, **GPU model**, and **game title** — a staff member will review your setup shortly.",
        ].join("\n"),
        pingStaff: true,
      };
    }

    case "compatibility_followup":
      return {
        title: "Support On The Way",
        description: [
          `Thank you for your patience, <@${userId}>.`,
          "",
          "Your message has been received and is in our queue. A staff member is reviewing your ticket and will respond as soon as possible.",
          "",
          "Please remain in this channel — there is no need to open additional tickets.",
          `If you have not already, our [**hardware requirements & FAQ**](${siteRequirementsUrl()}) on **${NEONAI_SITE_URL.replace(/^https?:\/\//, "")}** may answer common setup questions.`,
        ].join("\n"),
        pingStaff: true,
      };

    case "technical_patience":
      return {
        title: "Support On The Way",
        description: [
          `Thank you for your patience, <@${userId}>.`,
          "",
          "Your message has been received. A staff member from our **technical support team** is reviewing your ticket and will respond as soon as possible.",
          "",
          "Please remain in this channel — there is no need to open additional tickets.",
          "If you haven't already, include your **Windows version**, **GPU model**, and a short description of the issue.",
        ].join("\n"),
        pingStaff: true,
      };

    default:
      return {
        title: "Support On The Way",
        description: [
          `Thank you for your patience, <@${userId}>.`,
          "",
          "Your message has been received and a staff member will be with you shortly.",
          "If you haven't already, let us know your preferred license tier:",
          tiers,
        ].join("\n"),
        pingStaff: true,
      };
  }
}

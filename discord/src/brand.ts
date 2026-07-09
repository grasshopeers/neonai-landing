/** Pulled from tailwind.config.js — keep Discord visuals in sync with the site */
export const BRAND = {
  name: "NeonAi",
  tagline: "Precision · Performance · Control",
  inviteSlug: "neonai",
  colors: {
    bg: 0x0b0b0c,
    panel: 0x111113,
    crimson: 0xdc2626,
    ruby: 0x991b1b,
    glow: 0xe60000,
  },
  emoji: {
    brand: "◈",
    tos: "📜",
    news: "📣",
    quick: "⚡",
    purchase: "💳",
    media: "📷",
    reviews: "💚",
    product: "🎯",
    features: "🔹",
    hardware: "🏢",
    updates: "🔥",
    ticket: "🎫",
    redeem: "🔑",
    verify: "✅",
    welcome: "👋",
    close: "🔒",
    staff: "🔒",
  },
} as const;

export function brandEmbed() {
  return {
    color: BRAND.colors.crimson,
    footer: {
      text: `${BRAND.name} · ${BRAND.tagline}`,
    },
  };
}

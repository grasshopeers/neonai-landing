# NeonAi Landing Page

Premium marketing site for **NeonAi** — external AI aim assistant desktop software.

## Quick start

```bash
npm install
npm run dev
```

Open the URL shown in the terminal (usually `http://localhost:5173`).

## Production build

```bash
npm run build
npm run preview
```

## Configure Discord invite (purchases + community)

All purchase CTAs redirect to Discord — the ticket bot handles tier selection and payment. No frontend checkout.

Edit `src/constants.ts`:

```ts
export const DISCORD_INVITE_URL = "https://discord.gg/your-invite-code";
```

Per-button tracking: `getPurchaseDiscordUrl("hero")` appends `?source=hero` (pricing tiers use `?source=1_week`, etc.).

## Discord server automation

See [`discord/README.md`](discord/README.md) for a NeonAi-branded bot that provisions categories, channels, roles, verify flow, and ticket panels in one command.

Purchase buttons wired to Discord:
- Header **Purchase Now** (`?source=navbar`)
- Hero **Get Instant Access** (`?source=hero`)
- Pricing plan rows (`?source=1_week`, `1_month`, `3_months`, `lifetime`)
- Footer **Get License via Discord** (`?source=footer`)

## Stack

- React 18 + TypeScript + Vite
- Tailwind CSS
- Framer Motion
- Lucide React icons

## Project structure

```
src/
├── constants.ts          # URLs, copy, data arrays
├── components/
│   ├── NeonAiLanding.tsx # Page orchestrator
│   ├── Hero.tsx
│   ├── DemoPanel.tsx
│   ├── Background.tsx
│   └── ui/               # Shared interactive primitives
└── hooks/                # Scroll spy, parallax, etc.
```

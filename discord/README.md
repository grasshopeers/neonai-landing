# NeonAi Discord Automation

One-time server provisioning + ongoing ticket/verify bot, themed to match your landing page (`#DC2626` crimson, dark panels, NeonAi copy).

## What it sets up

Nyron-inspired layout with `┃channel-name` formatting:

| Category | Channels |
|----------|----------|
| verification | `┃verify` — **only channel new joiners see** |
| info | `┃tos`, `┃news`, `┃quick-news`, `┃purchase`, `┃media`, `┃reviews` |
| neonai | `┃neonai`, `┃features-list`, `┃extra-hardware`, `┃updates` (customers) |
| support | `┃ticket`, `┃redeem`, `┃ticket-logs` (staff) |
| staff | `┃staff-chat`, `┃moderation` |

**Roles:** Member · Customer · Support · Admin

**Verification flow:**
- New joiners only see `#┃verify` until they click **Verify**
- Bot DMs them on join with instructions (if DMs are open)
- After verify → **Member** role unlocks `info` + `support` channels
- **Customer** role unlocks `neonai` product channels

## 1. Create the bot

1. Go to [Discord Developer Portal](https://discord.com/developers/applications) → **New Application** → name it `NeonAi`.
2. Open **Bot** → **Reset Token** → copy it.
3. Enable **Privileged Gateway Intents**: `Server Members Intent`, `Message Content Intent`.
4. Open **OAuth2 → URL Generator**:
   - Scopes: `bot`, `applications.commands`
   - Permissions: `Administrator` (simplest for first setup)
5. Open the generated URL and invite the bot to your server.

## 2. Get IDs

Enable **Developer Mode** in Discord (Settings → Advanced).

- **Server ID:** right-click server icon → Copy Server ID
- **Your user ID:** right-click your name → Copy User ID

## 3. Configure

```bash
cd discord
npm install
copy .env.example .env   # Windows
# fill in DISCORD_BOT_TOKEN, DISCORD_GUILD_ID, DISCORD_OWNER_ID
```

## 4. Run setup (once)

```bash
npm run setup
```

Safe to re-run — it skips roles/channels that already exist and only posts starter embeds if channels are empty.

## 5. Run the bot (always)

Keep this running on your PC, a VPS, or Railway/Render:

```bash
npm run bot
```

For local dev with auto-restart:

```bash
npm run dev
```

## Customize

Edit these files, then re-run setup / restart the bot:

- **`src/brand.ts`** — colors, emoji, tagline (synced from `tailwind.config.js`)
- **`src/layout.ts`** — categories, channel names, roles, ticket types

After setup, paste your invite link into the site:

```ts
// src/constants.ts
export const DISCORD_URL = "https://discord.gg/your-invite";
```

## Hosting tips

- **PM2:** `pm2 start "npm run bot" --name neonai-discord`
- **Railway/Render:** set env vars, start command `npm run bot`, root `discord/`
- Never commit `.env` — it contains your bot token

## Recommended companion bots (Nyron-style)

You **already have** ticket + verify in **NeonAi** — do **not** add a separate Tickets bot (duplicate).

| Bot | Add? | What it does |
|-----|------|----------------|
| **NeonAi** (yours) | ✅ Already running | Verify gate, welcome banner, ticket panel, server layout |
| **Dyno** | ✅ Yes | Auto-mod, warnings/kicks/bans, mod logs, slowmode, custom commands, optional backup verify via reactions |
| **Guild Restore** | ✅ Yes | Backs up member list — if server gets nuked/deleted, restore community to a new server |
| **Security / Wick** | ✅ Yes | Anti-nuke — stops rogue staff from mass-deleting channels, banning everyone, or changing permissions |
| **Tickets** | ❌ Skip | Same job as `#┃ticket` in NeonAi — would conflict |

### Invite links (you click these — bots can't be added automatically)

1. **Dyno** — [dyno.gg/bot](https://dyno.gg/bot)  
   After invite: `?setup` in any channel → enable mod log in `#┃moderation`, auto-mod for invite links in `#┃chat`.

2. **Guild Restore** — [guildrestore.com](https://guildrestore.com)  
   Dashboard → link your server → run first backup. Use only if disaster recovery matters to you.

3. **Wick** (Security-style anti-nuke) — [wickbot.com](https://wickbot.com)  
   After invite: whitelist **Management** role, enable anti-nuke + join gate. Pairs well with NeonAi verify.

Keep **NeonAi** bot role **above** Dyno/Wick in **Server Settings → Roles** so your ticket/verify buttons keep working.

## Manual polish (optional)

Discord can't set these via bot API — do once in Server Settings:

- **Server theme:** dark mode
- **Banner/accent:** upload crimson-on-black art matching the site
- **Welcome Screen:** point to `#rules` and `#verify`
- **AutoMod:** block invite links in `#general` if you want

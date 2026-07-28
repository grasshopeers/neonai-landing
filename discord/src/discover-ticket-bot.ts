import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const token = process.env.DISCORD_TICKET_BOT_TOKEN;
const guildId = process.env.DISCORD_GUILD_ID;

if (!token) {
  console.error(`
Missing DISCORD_TICKET_BOT_TOKEN in discord/.env

Create the ticket bot:
  1. https://discord.com/developers/applications → New Application → "NeonAi Tickets"
  2. Bot → Reset Token → copy token
  3. Enable: Server Members Intent + Message Content Intent
  4. Add to discord/.env:
     DISCORD_TICKET_BOT_TOKEN=your_token_here
  5. Re-run: npm run discover-ticket-bot
`);
  process.exit(1);
}

const headers = { Authorization: `Bot ${token}` };

const me = await fetch("https://discord.com/api/v10/users/@me", { headers }).then(
  (r) => r.json()
);

if (!me.id) {
  console.error("Invalid ticket bot token:", me);
  process.exit(1);
}

console.log(`Ticket bot: ${me.username}#${me.discriminator ?? "0"} (${me.id})`);

const app = await fetch("https://discord.com/api/v10/oauth2/applications/@me", {
  headers,
}).then((r) => r.json());

const inviteUrl = guildId
  ? `https://discord.com/api/oauth2/authorize?client_id=${app.id}&permissions=8&scope=bot&guild_id=${guildId}`
  : `https://discord.com/api/oauth2/authorize?client_id=${app.id}&permissions=8&scope=bot`;
console.log(`\nInvite ticket bot to your server (Administrator):\n${inviteUrl}\n`);

const guilds = await fetch("https://discord.com/api/v10/users/@me/guilds", {
  headers,
}).then((r) => r.json());

if (!Array.isArray(guilds) || guilds.length === 0) {
  console.log("Ticket bot is not in any server yet.");
  console.log("Open the invite link above, add it to your NeonAi server, then re-run:");
  console.log("  npm run discover-ticket-bot");
  process.exit(1);
}

const inTarget =
  guildId && guilds.some((g: { id: string }) => g.id === guildId);
const guild = inTarget
  ? guilds.find((g: { id: string }) => g.id === guildId)
  : guilds[0];

console.log(`✓ Ticket bot is in: ${guild.name} (${guild.id})`);

if (!inTarget && guildId) {
  console.warn(
    `⚠ Expected guild ${guildId} — ticket bot is in ${guild.id} instead.`
  );
}

const envPath = resolve(dirname(fileURLToPath(import.meta.url)), "..", ".env");
let env = readFileSync(envPath, "utf8");

if (!/^DISCORD_TICKET_BOT_TOKEN=/m.test(env)) {
  env = `${env.trim()}\nDISCORD_TICKET_BOT_TOKEN=${token}\n`;
  writeFileSync(envPath, env);
}

console.log("\nNext steps:");
console.log("  1. Delete OLD verify/ticket panels posted by the main NeonAi bot");
console.log("  2. npm run repost-panels");
console.log("  3. npm run ticket-bot          (keep running 24/7 — deploy to Render)");
console.log("  4. npm run bot                 (staff slash commands on your PC)\n");

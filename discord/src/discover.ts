import "dotenv/config";
import { writeFileSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const token = process.env.DISCORD_BOT_TOKEN;
if (!token) {
  console.error("Missing DISCORD_BOT_TOKEN in .env");
  process.exit(1);
}

const headers = { Authorization: `Bot ${token}` };

const me = await fetch("https://discord.com/api/v10/users/@me", { headers }).then(
  (r) => r.json()
);
console.log(`Bot: ${me.username}#${me.discriminator ?? "0"} (${me.id})`);

const app = await fetch("https://discord.com/api/v10/oauth2/applications/@me", {
  headers,
}).then((r) => r.json());

const inviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${app.id}&permissions=8&scope=bot`;
console.log(`\nInvite link (open this, pick your NeonAi server):\n${inviteUrl}\n`);

const guilds = await fetch("https://discord.com/api/v10/users/@me/guilds", {
  headers,
}).then((r) => r.json());

if (!Array.isArray(guilds) || guilds.length === 0) {
  console.log("Bot is not in any server yet. Use the invite link above, then re-run:");
  console.log("  npm run discover");
  process.exit(1);
}

const guild = guilds[0];
const guildDetail = await fetch(`https://discord.com/api/v10/guilds/${guild.id}`, {
  headers,
}).then((r) => r.json());

const envPath = resolve(dirname(fileURLToPath(import.meta.url)), "..", ".env");
let env = readFileSync(envPath, "utf8");

const set = (key: string, value: string) => {
  const re = new RegExp(`^${key}=.*$`, "m");
  env = re.test(env) ? env.replace(re, `${key}=${value}`) : `${env.trim()}\n${key}=${value}\n`;
};

set("DISCORD_GUILD_ID", guild.id);
set("DISCORD_OWNER_ID", guildDetail.owner_id);

writeFileSync(envPath, env.endsWith("\n") ? env : `${env}\n`);

console.log(`Linked server: ${guild.name} (${guild.id})`);
console.log(`Owner ID: ${guildDetail.owner_id}`);
console.log("\n.env updated. Next:");
console.log("  npm run setup");
console.log("  npm run bot");

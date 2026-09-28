import "dotenv/config";
import { registerSlashCommands } from "./commands.js";

const token = process.env.DISCORD_BOT_TOKEN;
const guildId = process.env.DISCORD_GUILD_ID;

if (!token || !guildId) {
  console.error("Missing DISCORD_BOT_TOKEN or DISCORD_GUILD_ID");
  process.exit(1);
}

const me = await fetch("https://discord.com/api/v10/users/@me", {
  headers: { Authorization: `Bot ${token}` },
}).then((r) => r.json());

await registerSlashCommands(token, me.id, guildId);

const cmds = await fetch(
  `https://discord.com/api/v10/applications/${me.id}/guilds/${guildId}/commands`,
  { headers: { Authorization: `Bot ${token}` } }
).then((r) => r.json());

console.log(`Registered on ${me.username}: ${cmds.map((c: { name: string }) => c.name).join(", ")}`);

import "dotenv/config";

const token = process.env.DISCORD_BOT_TOKEN;
const guildId = process.env.DISCORD_GUILD_ID;

if (!token || !guildId) {
  console.error("Missing DISCORD_BOT_TOKEN or DISCORD_GUILD_ID");
  process.exit(1);
}

const headers = { Authorization: `Bot ${token}` };

const channels = await fetch(
  `https://discord.com/api/v10/guilds/${guildId}/channels`,
  { headers }
).then((r) => r.json());

if (!Array.isArray(channels)) {
  console.error("Failed to fetch channels:", channels);
  process.exit(1);
}

const welcome =
  channels.find((c: { name?: string }) => c.name === "┃welcome") ??
  channels.find((c: { name?: string }) => c.name === "┃verify") ??
  channels.find((c: { type?: number }) => c.type === 0);

if (!welcome?.id) {
  console.error("No channel found to create invite");
  process.exit(1);
}

const invite = await fetch(
  `https://discord.com/api/v10/channels/${welcome.id}/invites`,
  {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      max_age: 0,
      max_uses: 0,
      unique: true,
    }),
  }
).then((r) => r.json());

if (!invite.code) {
  console.error("Failed to create invite:", invite);
  process.exit(1);
}

console.log(`https://discord.gg/${invite.code}`);

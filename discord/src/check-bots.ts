import "dotenv/config";
import { Client, GatewayIntentBits } from "discord.js";

const token = process.env.DISCORD_BOT_TOKEN;
const guildId = process.env.DISCORD_GUILD_ID;

if (!token || !guildId) {
  console.error("Missing .env credentials");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
  ],
});

client.once("ready", async () => {
  const guild = await client.guilds.fetch(guildId);
  console.log(`Server: ${guild.name} (${guild.id})\n`);

  await guild.members.fetch();
  const bots = [...guild.members.cache.values()]
    .filter((m) => m.user.bot)
    .sort((a, b) => a.user.username.localeCompare(b.user.username));

  console.log(`Bots found (${bots.length}):`);
  for (const m of bots) {
    const status = m.presence?.status ?? "offline";
    const roles = m.roles.cache
      .filter((r) => r.name !== "@everyone")
      .map((r) => r.name)
      .join(", ") || "(no roles)";
    console.log(`  • ${m.user.tag} — ${status} — roles: ${roles}`);
  }

  const carl = bots.find(
    (m) =>
      m.user.username.toLowerCase().includes("carl") ||
      m.user.id === "526265238887280960"
  );

  console.log("");
  if (carl) {
    console.log(`✅ Carl-bot IS in your server: ${carl.user.tag}`);
    console.log(`   Status: ${carl.presence?.status ?? "offline"}`);
    console.log(`   Roles: ${carl.roles.cache.map((r) => r.name).join(", ")}`);
  } else {
    console.log("❌ Carl-bot NOT found — invite may have failed or wrong server.");
    console.log("   Re-invite: https://carl.gg");
  }

  client.destroy();
});

client.login(token);

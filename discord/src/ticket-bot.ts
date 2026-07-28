import "dotenv/config";
import { createServer } from "node:http";
import { Client, GatewayIntentBits } from "discord.js";
import { registerPublicBotEvents } from "./register-public-events.js";

const token =
  process.env.DISCORD_TICKET_BOT_TOKEN ?? process.env.DISCORD_BOT_TOKEN;
const guildId = process.env.DISCORD_GUILD_ID;

if (!token || !guildId) {
  console.error(
    "Missing DISCORD_TICKET_BOT_TOKEN (or DISCORD_BOT_TOKEN) and DISCORD_GUILD_ID in .env"
  );
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

registerPublicBotEvents(client, guildId);

client.once("ready", () => {
  console.log(`NeonAi ticket bot online as ${client.user?.tag}`);
  console.log("Handles: verify, open ticket, purchase ticket, auto-replies");
});

const port = Number(process.env.PORT ?? 3000);
createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end(client.isReady() ? "ok" : "starting");
}).listen(port, () => {
  console.log(`Health check listening on port ${port}`);
});

client.login(token);

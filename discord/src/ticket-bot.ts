import "dotenv/config";
import { Client, GatewayIntentBits } from "discord.js";
import { registerTicketBotEvents } from "./register-public-events.js";
import { startHealthServer } from "./health-server.js";

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

registerTicketBotEvents(client, guildId);
startHealthServer(() => client.isReady(), "NeonAi Tickets");

client.once("ready", () => {
  console.log(`NeonAi Tickets online as ${client.user?.tag}`);
  console.log("Handles: open/close tickets, purchase tickets, auto-replies");
});

client.login(token);

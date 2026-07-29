import "dotenv/config";
import { Client, GatewayIntentBits } from "discord.js";
import { registerMainBotEvents } from "./register-public-events.js";
import { registerTicketBotEvents } from "./register-public-events.js";
import { registerSlashCommands } from "./commands.js";
import {
  handleDeliverCommand,
  handleSetupCommand,
  handleStripeCommand,
  handleUnmuteCommand,
} from "./purchase-tickets.js";
import { handleMembersCommand } from "./staff-members.js";
import { startHealthServer } from "./health-server.js";

const mainToken = process.env.DISCORD_BOT_TOKEN;
const ticketToken = process.env.DISCORD_TICKET_BOT_TOKEN;
const guildId = process.env.DISCORD_GUILD_ID;

if (!mainToken || !ticketToken || !guildId) {
  console.error(
    "Missing DISCORD_BOT_TOKEN, DISCORD_TICKET_BOT_TOKEN, or DISCORD_GUILD_ID"
  );
  process.exit(1);
}

const intents = [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMembers,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.MessageContent,
];

const mainClient = new Client({ intents });
const ticketClient = new Client({ intents });

registerMainBotEvents(mainClient, guildId);
registerTicketBotEvents(ticketClient, guildId);

startHealthServer(
  () => mainClient.isReady() && ticketClient.isReady(),
  "NeonAi cloud"
);

/** Ping ourselves every 14 min so Render free tier does not spin down */
function startSelfKeepAlive() {
  const url = process.env.RENDER_EXTERNAL_URL;
  if (!url) return;
  setInterval(() => {
    fetch(url).catch(() => undefined);
  }, 14 * 60 * 1000);
}

mainClient.once("ready", async () => {
  console.log(`NeonAi online as ${mainClient.user?.tag} (verify + staff)`);
  if (mainClient.user) {
    try {
      await registerSlashCommands(mainToken, mainClient.user.id, guildId);
      console.log("Slash commands registered");
    } catch (err) {
      console.error("Slash command registration failed:", err);
    }
  }
});

ticketClient.once("ready", () => {
  console.log(`NeonAi Tickets online as ${ticketClient.user?.tag} (tickets)`);
});

mainClient.on("interactionCreate", async (interaction) => {
  if (!interaction.guild || !interaction.isChatInputCommand()) return;
  try {
    if (interaction.commandName === "setup") await handleSetupCommand(interaction);
    else if (interaction.commandName === "stripe") await handleStripeCommand(interaction);
    else if (interaction.commandName === "unmute") await handleUnmuteCommand(interaction);
    else if (interaction.commandName === "deliver") await handleDeliverCommand(interaction);
    else if (interaction.commandName === "members") await handleMembersCommand(interaction);
  } catch (err) {
    console.error("Staff command error:", err);
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "Something went wrong. Try again or ping an admin.",
        ephemeral: true,
      });
    }
  }
});

startSelfKeepAlive();
await Promise.all([mainClient.login(mainToken), ticketClient.login(ticketToken)]);

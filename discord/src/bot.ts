import "dotenv/config";
import { Client, GatewayIntentBits } from "discord.js";
import { registerMainBotEvents } from "./register-public-events.js";
import { registerSlashCommands } from "./commands.js";
import {
  handleDeliverCommand,
  handlePriceCommand,
  handleSetupCommand,
  handleStripeCommand,
  handleUnmuteCommand,
} from "./purchase-tickets.js";
import { handleMembersCommand } from "./staff-members.js";
import { handleCloseTicketCommand } from "./ticket-close.js";
import { startHealthServer } from "./health-server.js";

const staffToken = process.env.DISCORD_BOT_TOKEN;
const guildId = process.env.DISCORD_GUILD_ID;

if (!staffToken || !guildId) {
  console.error("Missing DISCORD_BOT_TOKEN or DISCORD_GUILD_ID in .env");
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

registerMainBotEvents(client, guildId);
startHealthServer(() => client.isReady(), "NeonAi");

client.once("ready", async () => {
  console.log(`NeonAi bot online as ${client.user?.tag}`);
  console.log("Handles: verify, welcome DMs, staff slash commands");

  if (client.user && guildId) {
    try {
      await registerSlashCommands(staffToken, client.user.id, guildId);
      console.log(
        "Slash commands: /setup, /stripe, /price, /unmute, /deliver, /close, /members"
      );
    } catch (err) {
      console.error("Failed to register slash commands:", err);
    }
  }
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.guild || !interaction.isChatInputCommand()) return;

  try {
    if (interaction.commandName === "setup") {
      await handleSetupCommand(interaction);
      return;
    }
    if (interaction.commandName === "stripe") {
      await handleStripeCommand(interaction);
      return;
    }
    if (interaction.commandName === "price") {
      await handlePriceCommand(interaction);
      return;
    }
    if (interaction.commandName === "unmute") {
      await handleUnmuteCommand(interaction);
      return;
    }
    if (interaction.commandName === "deliver") {
      await handleDeliverCommand(interaction);
      return;
    }
    if (interaction.commandName === "members") {
      await handleMembersCommand(interaction);
      return;
    }
    if (interaction.commandName === "close") {
      await handleCloseTicketCommand(interaction);
      return;
    }
  } catch (err) {
    console.error("Interaction error:", err);
    if (interaction.isRepliable()) {
      const content = "Something went wrong. Try again or ping an admin.";
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content, ephemeral: true });
      } else {
        await interaction.reply({ content, ephemeral: true });
      }
    }
  }
});

client.login(staffToken);

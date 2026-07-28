import "dotenv/config";
import { Client, GatewayIntentBits } from "discord.js";
import { registerSlashCommands } from "./commands.js";
import {
  handleDeliverCommand,
  handleSetupCommand,
  handleStripeCommand,
  handleUnmuteCommand,
} from "./purchase-tickets.js";
import { handleMembersCommand } from "./staff-members.js";
import { registerPublicBotEvents } from "./register-public-events.js";

const staffToken = process.env.DISCORD_BOT_TOKEN;
const ticketBotToken = process.env.DISCORD_TICKET_BOT_TOKEN;
const guildId = process.env.DISCORD_GUILD_ID;

if (!staffToken || !guildId) {
  console.error("Missing DISCORD_BOT_TOKEN or DISCORD_GUILD_ID in .env");
  process.exit(1);
}

/** When a dedicated ticket bot is configured, this process is staff-only */
const staffOnlyMode = Boolean(ticketBotToken);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

if (!staffOnlyMode) {
  registerPublicBotEvents(client, guildId);
}

client.once("ready", async () => {
  console.log(`NeonAi bot online as ${client.user?.tag}`);
  if (staffOnlyMode) {
    console.log(
      "Staff-only mode — ticket bot handles verify/tickets (DISCORD_TICKET_BOT_TOKEN set)"
    );
  }

  if (client.user && guildId) {
    try {
      await registerSlashCommands(staffToken, client.user.id, guildId);
      console.log(
        "Slash commands registered: /setup, /stripe, /unmute, /deliver, /members"
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

import "dotenv/config";
import { Client, GatewayIntentBits } from "discord.js";
import { closeTicketChannel } from "./ticket-close.js";
import { isTicketChannel } from "./purchase-tickets.js";

const token = process.env.DISCORD_TICKET_BOT_TOKEN ?? process.env.DISCORD_BOT_TOKEN;
const guildId = process.env.DISCORD_GUILD_ID;
const needle = process.argv[2];

if (!token || !guildId || !needle) {
  console.error("Usage: npm run close-ticket -- <ticket-id-or-name>");
  console.error("Example: npm run close-ticket -- 1520");
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("ready", async () => {
  try {
    const guild = await client.guilds.fetch(guildId);
    await guild.channels.fetch();

    const channel = guild.channels.cache.find(
      (c) =>
        c.isTextBased() &&
        isTicketChannel(c) &&
        (c.id === needle || c.name.includes(needle))
    );

    if (!channel?.isTextBased()) {
      console.error(`No ticket matching "${needle}"`);
      process.exitCode = 1;
      return;
    }

    await closeTicketChannel(guild, channel, "Staff (manual close-ticket script)");
    console.log(`Closed #${channel.name}`);
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  } finally {
    client.destroy();
  }
});

client.login(token);

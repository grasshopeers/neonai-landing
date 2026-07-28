import "dotenv/config";
import { Client, GatewayIntentBits } from "discord.js";
import { ensureTicketBotRoleHierarchy } from "./verify-roles.js";

const token = process.env.DISCORD_BOT_TOKEN;
const guildId = process.env.DISCORD_GUILD_ID;

if (!token || !guildId) {
  console.error("Missing DISCORD_BOT_TOKEN or DISCORD_GUILD_ID");
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("ready", async () => {
  try {
    const guild = await client.guilds.fetch(guildId);
    const result = await ensureTicketBotRoleHierarchy(guild);
    if (result.fixed) {
      console.log(
        `Moved "${result.ticketRole.name}" above "${result.memberRole.name}" — verify can assign Member now.`
      );
    } else {
      console.log("Ticket bot role hierarchy already OK for verify.");
    }
  } catch (err) {
    console.error("Fix failed:", err);
    process.exitCode = 1;
  } finally {
    client.destroy();
  }
});

client.login(token);

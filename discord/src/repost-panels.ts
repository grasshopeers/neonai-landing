import "dotenv/config";
import { Client, GatewayIntentBits } from "discord.js";
import { CHANNELS, findTextChannel } from "./layout.js";
import {
  buildPurchasePanel,
  buildTicketPanel,
  buildVerifyPanel,
} from "./panels.js";

const token =
  process.env.DISCORD_TICKET_BOT_TOKEN ?? process.env.DISCORD_BOT_TOKEN;
const guildId = process.env.DISCORD_GUILD_ID;

if (!token || !guildId) {
  console.error(
    "Missing DISCORD_TICKET_BOT_TOKEN (or DISCORD_BOT_TOKEN) and DISCORD_GUILD_ID"
  );
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once("ready", async () => {
  try {
    const guild = await client.guilds.fetch(guildId);
    console.log(`Reposting panels in **${guild.name}** as ${client.user?.tag}…\n`);
    console.log(
      "Delete old verify/ticket panels from the main NeonAi bot first, or users may click the wrong one.\n"
    );

    const verify = findTextChannel(guild, CHANNELS.verify);
    if (verify?.isTextBased()) {
      await verify.send(buildVerifyPanel());
      console.log(`  + posted verify panel in #${CHANNELS.verify}`);
    }

    const ticket = findTextChannel(guild, CHANNELS.ticket);
    if (ticket?.isTextBased()) {
      await ticket.send(
        buildTicketPanel("_Members only — staff handles your private ticket._")
      );
      console.log(`  + posted ticket panel in #${CHANNELS.ticket}`);
    }

    const customerSupport = findTextChannel(guild, CHANNELS.customerSupport);
    if (customerSupport?.isTextBased()) {
      await customerSupport.send(
        buildTicketPanel("_Customers only — staff handles your private ticket._")
      );
      console.log(`  + posted customer panel in #${CHANNELS.customerSupport}`);
    }

    const purchase = findTextChannel(guild, CHANNELS.purchase);
    if (purchase?.isTextBased()) {
      await purchase.send(buildPurchasePanel());
      console.log(`  + posted purchase panel in #${CHANNELS.purchase}`);
    }

    console.log("\n✅ Panels reposted. Deploy `npm run ticket-bot` 24/7 on Render/Railway.\n");
  } catch (err) {
    console.error("Repost failed:", err);
    process.exitCode = 1;
  } finally {
    client.destroy();
  }
});

client.login(token);

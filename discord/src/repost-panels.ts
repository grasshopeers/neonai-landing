import "dotenv/config";
import { Client, GatewayIntentBits } from "discord.js";
import { CHANNELS, findTextChannel } from "./layout.js";
import {
  buildPurchasePanel,
  buildTicketPanel,
  buildVerifyPanel,
} from "./panels.js";

const mainToken = process.env.DISCORD_BOT_TOKEN;
const ticketToken = process.env.DISCORD_TICKET_BOT_TOKEN;
const guildId = process.env.DISCORD_GUILD_ID;

if (!guildId) {
  console.error("Missing DISCORD_GUILD_ID");
  process.exit(1);
}

if (!mainToken && !ticketToken) {
  console.error("Need DISCORD_BOT_TOKEN and/or DISCORD_TICKET_BOT_TOKEN");
  process.exit(1);
}

async function postAs(token: string, label: string) {
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  await new Promise<void>((resolve, reject) => {
    client.once("ready", () => resolve());
    client.login(token).catch(reject);
  });

  const guild = await client.guilds.fetch(guildId!);
  console.log(`\n${label} (${client.user!.tag}):`);

  if (token === mainToken) {
    const verify = findTextChannel(guild, CHANNELS.verify);
    if (verify?.isTextBased()) {
      await verify.send(buildVerifyPanel());
      console.log(`  + verify panel in #${CHANNELS.verify}`);
    }
  }

  if (token === ticketToken) {
    const ticket = findTextChannel(guild, CHANNELS.ticket);
    if (ticket?.isTextBased()) {
      await ticket.send(
        buildTicketPanel("_Members only — staff handles your private ticket._")
      );
      console.log(`  + ticket panel in #${CHANNELS.ticket}`);
    }

    const customerSupport = findTextChannel(guild, CHANNELS.customerSupport);
    if (customerSupport?.isTextBased()) {
      await customerSupport.send(
        buildTicketPanel("_Customers only — staff handles your private ticket._")
      );
      console.log(`  + customer panel in #${CHANNELS.customerSupport}`);
    }

    const purchase = findTextChannel(guild, CHANNELS.purchase);
    if (purchase?.isTextBased()) {
      await purchase.send(buildPurchasePanel());
      console.log(`  + purchase panel in #${CHANNELS.purchase}`);
    }
  }

  client.destroy();
}

try {
  console.log(`Reposting panels in guild ${guildId}…`);
  if (mainToken) await postAs(mainToken, "Main bot");
  if (ticketToken) await postAs(ticketToken, "Ticket bot");
  console.log("\nUse the newest panel at the bottom of each channel.\n");
} catch (err) {
  console.error("Repost failed:", err);
  process.exit(1);
}

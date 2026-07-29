import "dotenv/config";
import { Client, GatewayIntentBits, Message } from "discord.js";
import { CHANNELS, findTextChannel } from "./layout.js";

const staffToken = process.env.DISCORD_BOT_TOKEN;
const ticketToken = process.env.DISCORD_TICKET_BOT_TOKEN;
const guildId = process.env.DISCORD_GUILD_ID;

if (!staffToken || !guildId) {
  console.error("Missing DISCORD_BOT_TOKEN or DISCORD_GUILD_ID");
  process.exit(1);
}

function isVerifyPanel(msg: Message, authorId: string) {
  return (
    msg.author.id === authorId &&
    msg.components.length > 0 &&
    JSON.stringify(msg.components).includes("neonai_verify")
  );
}

function isTicketPanel(msg: Message, authorId: string) {
  if (msg.author.id !== authorId || !msg.components.length) return false;
  const raw = JSON.stringify(msg.components);
  return raw.includes("neonai_ticket_select") || raw.includes("neonai_purchase_ticket");
}

const staff = new Client({ intents: [GatewayIntentBits.Guilds] });
const ticket = ticketToken
  ? new Client({ intents: [GatewayIntentBits.Guilds] })
  : null;

staff.once("ready", async () => {
  try {
    const guild = await staff.guilds.fetch(guildId);
    const staffId = staff.user!.id;
    let ticketId: string | null = null;

    if (ticket && ticketToken) {
      await new Promise<void>((resolve, reject) => {
        ticket!.once("ready", () => resolve());
        ticket!.login(ticketToken).catch(reject);
      });
      ticketId = ticket.user!.id;
    }

    console.log(`Cleaning misplaced panels in **${guild.name}**`);
    let removed = 0;

    const verify = findTextChannel(guild, CHANNELS.verify);
    if (verify?.isTextBased()) {
      for (const msg of (await verify.messages.fetch({ limit: 50 })).values()) {
        if (ticketId && isVerifyPanel(msg, ticketId)) {
          await msg.delete().catch(() => undefined);
          removed++;
          console.log(`  - removed ticket-bot verify panel ${msg.id}`);
        }
      }
    }

    for (const channelName of [
      CHANNELS.ticket,
      CHANNELS.customerSupport,
      CHANNELS.purchase,
    ] as const) {
      const channel = findTextChannel(guild, channelName);
      if (!channel?.isTextBased()) continue;
      for (const msg of (await channel.messages.fetch({ limit: 50 })).values()) {
        if (isTicketPanel(msg, staffId)) {
          await msg.delete().catch(() => undefined);
          removed++;
          console.log(`  - removed staff ticket panel in #${channelName}`);
        }
      }
    }

    console.log(`\nRemoved ${removed} misplaced panel(s).`);
  } catch (err) {
    console.error("Cleanup failed:", err);
    process.exitCode = 1;
  } finally {
    staff.destroy();
    ticket?.destroy();
  }
});

staff.login(staffToken);

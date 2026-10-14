import { lookup } from "node:dns/promises";
import { setDefaultResultOrder } from "node:dns";
import https from "node:https";
import { setDefaultAutoSelectFamily } from "node:net";
import "dotenv/config";
import { Client, GatewayIntentBits } from "discord.js";
import { Agent, setGlobalDispatcher } from "undici";

// Render's IPv6 route to Discord never answers. Force every Discord request onto IPv4.
setDefaultAutoSelectFamily(false);
setDefaultResultOrder("ipv4first");
const ipv4 = new Agent({ connect: { family: 4, autoSelectFamily: false } });
setGlobalDispatcher(ipv4);

const dnsStarted = Date.now();
lookup("discord.com", { all: true })
  .then((rows) =>
    console.log(`discord dns ${Date.now() - dnsStarted}ms families ${rows.map((row) => row.family).join(",")}`)
  )
  .catch((err) => console.error("discord dns failed", err));
import { registerMainBotEvents } from "./register-public-events.js";
import { registerTicketBotEvents } from "./register-public-events.js";
import { registerSlashCommands } from "./commands.js";
import {
  handleDeliverCommand,
  handleKofiCommand,
  handlePaypalCommand,
  handlePriceCommand,
  handleRemitlyCommand,
  handleSetupCommand,
  handleStripeCommand,
  handleUnmuteCommand,
} from "./purchase-tickets.js";
import { handleMembersCommand } from "./staff-members.js";
import { handleCloseTicketCommand } from "./ticket-close.js";
import { handleReviewCommand } from "./reviews.js";
import { startNewsPromoWatcher } from "./news-promo.js";
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

const mainClient = new Client({ intents, rest: { agent: ipv4 } });
const ticketClient = new Client({ intents, rest: { agent: ipv4 } });

for (const [label, client] of [
  ["NeonAi", mainClient],
  ["NeonAi Tickets", ticketClient],
] as const) {
  client.on("error", (err) => console.error(`${label} error:`, err));
  client.on("shardError", (err) => console.error(`${label} connection error:`, err));
  client.on("shardDisconnect", (event) => console.error(`${label} disconnected`, event));
  const onDebug = (message: string) => {
    if (/token/i.test(message)) return;
    console.log(`${label}: ${message.split("\n")[0]?.slice(0, 220)}`);
  };
  client.on("debug", onDebug);
  client.once("ready", () => client.off("debug", onDebug));
}

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

startNewsPromoWatcher(mainClient, guildId);

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
    else if (interaction.commandName === "kofi") await handleKofiCommand(interaction);
    else if (interaction.commandName === "paypal") await handlePaypalCommand(interaction);
    else if (interaction.commandName === "remitly") await handleRemitlyCommand(interaction);
    else if (interaction.commandName === "price") await handlePriceCommand(interaction);
    else if (interaction.commandName === "review") await handleReviewCommand(interaction);
    else if (interaction.commandName === "unmute") await handleUnmuteCommand(interaction);
    else if (interaction.commandName === "deliver") await handleDeliverCommand(interaction);
    else if (interaction.commandName === "members") await handleMembersCommand(interaction);
    else if (interaction.commandName === "close") await handleCloseTicketCommand(interaction);
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

function probe(host: string, path: string) {
  const started = Date.now();
  return new Promise<void>((resolve) => {
    const req = https.request(
      {
        host,
        path,
        method: "GET",
        family: 4,
        timeout: 8_000,
        headers: { "User-Agent": "NeonAi" },
      },
      (res) => {
        console.log(`https ${host} ${res.statusCode} in ${Date.now() - started}ms`);
        res.resume();
        resolve();
      }
    );
    req.on("timeout", () => {
      console.error(`https ${host} timed out after ${Date.now() - started}ms`);
      req.destroy();
      resolve();
    });
    req.on("error", (err) => {
      console.error(`https ${host} failed after ${Date.now() - started}ms: ${err.message}`);
      resolve();
    });
    req.end();
  });
}

await probe("example.com", "/");
await probe("discord.com", "/api/v10/gateway");

setTimeout(() => {
  if (mainClient.isReady() && ticketClient.isReady()) return;
  console.error("Discord login timed out. Exiting so the host can start again.");
  process.exit(1);
}, 75_000).unref();

await Promise.all([mainClient.login(mainToken), ticketClient.login(ticketToken)]);

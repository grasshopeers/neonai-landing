import "dotenv/config";
import { Client, GatewayIntentBits } from "discord.js";
import { CHANNELS, findTextChannel } from "./layout.js";
import { chunkWelcomeFaqEmbeds } from "./welcome-faq.js";

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
    const welcome = findTextChannel(guild, CHANNELS.welcome);
    if (!welcome?.isTextBased()) {
      console.error(`Missing #${CHANNELS.welcome}`);
      process.exitCode = 1;
      return;
    }

    // Remove previous NeonAi FAQ / welcome embeds from this bot
    const recent = await welcome.messages.fetch({ limit: 30 });
    for (const msg of recent.values()) {
      if (msg.author.id !== client.user!.id) continue;
      const title = msg.embeds[0]?.title ?? "";
      if (
        title.includes("Welcome") ||
        title.includes("FAQ") ||
        title.includes("NeonAi") ||
        title.includes("Happy Aiming") ||
        title.includes("Rules") ||
        title.includes("plans") ||
        title.includes("refund") ||
        title.includes("Defender") ||
        title.includes("License") ||
        title.includes("buy") ||
        title.includes("choose") ||
        title.includes("undetected") ||
        title.includes("What is") ||
        title.includes("More FAQ") ||
        title.includes("doesn't work")
      ) {
        await msg.delete().catch(() => undefined);
      }
    }

    const batches = chunkWelcomeFaqEmbeds();
    for (const embeds of batches) {
      await welcome.send({ embeds });
    }

    console.log(
      `Posted ${batches.reduce((n, b) => n + b.length, 0)} FAQ embeds in #${CHANNELS.welcome}`
    );
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  } finally {
    client.destroy();
  }
});

client.login(token);

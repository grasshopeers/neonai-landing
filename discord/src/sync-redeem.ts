/**
 * Sync redeem-related channels/permissions, build hashed inventory index,
 * and post the public Redeem panel.
 */
import "dotenv/config";
import {
  ChannelType,
  Client,
  GatewayIntentBits,
} from "discord.js";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CHANNELS,
  SERVER_LAYOUT,
  channelOverwrites,
  findTextChannel,
  resolveRoleMap,
} from "./layout.js";
import { parseInventoryFile } from "./license-lookup.js";
import { buildRedeemPanel } from "./redeem.js";
import { postFeedbackPanels } from "./feedback.js";

const token = process.env.DISCORD_BOT_TOKEN;
const guildId = process.env.DISCORD_GUILD_ID;

if (!token || !guildId) {
  console.error("Missing DISCORD_BOT_TOKEN or DISCORD_GUILD_ID");
  process.exit(1);
}

function buildIndexIfPossible() {
  const inventoryPath =
    process.env.LICENSE_INVENTORY_PATH ??
    "C:\\Users\\aadit\\Downloads\\NeonAi\\deploy\\LICENSE_KEYS_FULL_INVENTORY.txt";
  if (!existsSync(inventoryPath)) {
    console.log("No local inventory file — using verify-status / existing hashed index");
    return;
  }
  const entries = parseInventoryFile(readFileSync(inventoryPath, "utf8"));
  const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "data");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "license-inventory-index.json");
  writeFileSync(
    outPath,
    JSON.stringify(
      { updatedAt: new Date().toISOString(), source: inventoryPath, entries },
      null,
      2
    )
  );
  console.log(`Hashed inventory index: ${entries.length} keys → ${outPath}`);
}

buildIndexIfPossible();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("ready", async () => {
  try {
    const guild = await client.guilds.fetch(guildId);
    await guild.roles.fetch();
    const roles = resolveRoleMap(guild);

    for (const category of SERVER_LAYOUT) {
      let parent = guild.channels.cache.find(
        (c) => c.type === ChannelType.GuildCategory && c.name === category.name
      );

      if (!parent) {
        parent = await guild.channels.create({
          name: category.name,
          type: ChannelType.GuildCategory,
          reason: "NeonAi redeem sync",
        });
        console.log(`+ category ${category.name}`);
      }

      for (const def of category.channels) {
        const overwrites = channelOverwrites(guild, roles, def);
        let channel = findTextChannel(guild, def.name) ??
          guild.channels.cache.find((c) => c.name === def.name);

        if (!channel) {
          channel = await guild.channels.create({
            name: def.name,
            type: def.type,
            parent: parent.id,
            topic: def.topic,
            permissionOverwrites: overwrites,
            reason: "NeonAi redeem sync",
          });
          console.log(`+ #${def.name}`);
          continue;
        }

        if (channel.isVoiceBased()) {
          await channel.edit({
            parent: parent.id,
            permissionOverwrites: overwrites,
            reason: "NeonAi redeem sync permissions",
          });
        } else if (channel.isTextBased()) {
          await channel.edit({
            parent: parent.id,
            topic: def.topic,
            permissionOverwrites: overwrites,
            reason: "NeonAi redeem sync permissions",
          });
        }
        console.log(`~ #${def.name} permissions`);
      }
    }

    await postFeedbackPanels(guild);

    const redeem = findTextChannel(guild, CHANNELS.redeem);
    if (redeem?.isTextBased()) {
      // Clear old static redeem embeds from prior setup (keep history light)
      const recent = await redeem.messages.fetch({ limit: 20 });
      for (const msg of recent.values()) {
        if (msg.author.id !== client.user?.id) continue;
        const hasRedeemBtn = msg.components.some((row) =>
          row.components.some(
            (c) =>
              "customId" in c &&
              (c as { customId?: string }).customId === "neonai_redeem_open"
          )
        );
        if (!hasRedeemBtn) {
          await msg.delete().catch(() => undefined);
        }
      }
      const still = await redeem.messages.fetch({ limit: 10 });
      const hasPanel = still.some((m) =>
        m.components.some((row) =>
          row.components.some(
            (c) =>
              "customId" in c &&
              (c as { customId?: string }).customId === "neonai_redeem_open"
          )
        )
      );
      if (!hasPanel) {
        await redeem.send(buildRedeemPanel());
        console.log(`+ redeem panel in #${CHANNELS.redeem}`);
      } else {
        console.log(`= redeem panel already present`);
      }
    }

    console.log("\nRedeem sync complete.");
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  } finally {
    client.destroy();
  }
});

client.login(token);

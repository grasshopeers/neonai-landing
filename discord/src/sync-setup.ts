/**
 * Create/sync #┃setup (Customer-only).
 */
import "dotenv/config";
import {
  ChannelType,
  Client,
  EmbedBuilder,
  GatewayIntentBits,
} from "discord.js";
import { BRAND, brandEmbed } from "./brand.js";
import {
  CHANNELS,
  CATEGORIES,
  SERVER_LAYOUT,
  channelOverwrites,
  findTextChannel,
  resolveRoleMap,
} from "./layout.js";

const token = process.env.DISCORD_BOT_TOKEN!;
const guildId = process.env.DISCORD_GUILD_ID!;

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("clientReady", async () => {
  try {
    const guild = await client.guilds.fetch(guildId);
    await guild.roles.fetch();
    await guild.channels.fetch();
    const roles = resolveRoleMap(guild);

    const neonaiCat = SERVER_LAYOUT.find((c) => c.name === CATEGORIES.neonai);
    const setupDef = neonaiCat?.channels.find((c) => c.name === CHANNELS.setup);
    if (!setupDef) {
      console.error("setup channel missing from SERVER_LAYOUT");
      process.exit(1);
    }

    const parent = guild.channels.cache.find(
      (c) => c.type === ChannelType.GuildCategory && c.name === CATEGORIES.neonai
    );
    if (!parent) {
      console.error("missing neonai category");
      process.exit(1);
    }

    const overwrites = channelOverwrites(guild, roles, setupDef);
    let channel = guild.channels.cache.find(
      (c) =>
        c.parentId === parent.id &&
        c.name === CHANNELS.setup &&
        c.type === ChannelType.GuildText
    );

    if (!channel) {
      channel = await guild.channels.create({
        name: CHANNELS.setup,
        type: ChannelType.GuildText,
        parent: parent.id,
        topic: setupDef.topic,
        permissionOverwrites: overwrites,
        reason: "NeonAi setup channel",
      });
      console.log(`+ #${CHANNELS.setup}`);
    } else {
      await channel.edit({
        topic: setupDef.topic,
        permissionOverwrites: overwrites,
        reason: "NeonAi setup sync",
      });
      console.log(`↻ #${CHANNELS.setup}`);
    }

    const guide = guild.channels.cache.find(
      (c) =>
        c.parentId === parent.id &&
        (c.name === CHANNELS.guide || c.name === "┃tutorials")
    );
    if (guide && "position" in guide) {
      try {
        await channel.setPosition(guide.position);
      } catch {
        /* non-fatal */
      }
    }

    const text = findTextChannel(guild, CHANNELS.setup);
    if (!text?.isTextBased()) {
      console.error("Could not resolve setup text channel");
      process.exit(1);
    }

    const botId = client.user?.id;
    const recent = await text.messages.fetch({ limit: 10 }).catch(() => null);
    const already = recent?.some(
      (m) => m.author.id === botId && m.embeds.some((e) => e.title === "Setup")
    );

    if (!already) {
      const embed = new EmbedBuilder()
        .setColor(BRAND.colors.crimson)
        .setTitle("Setup")
        .setDescription(
          [
            "Setup guidance for verified customers.",
            "",
            `Install first via **#${CHANNELS.guide}**, then use this channel for configs and first-run setup.`,
          ].join("\n")
        )
        .setFooter(brandEmbed().footer);
      await text.send({ embeds: [embed] });
      console.log("Posted setup intro");
    }

    console.log(`Done → https://discord.com/channels/${guildId}/${text.id}`);
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  } finally {
    client.destroy();
  }
});

await client.login(token);

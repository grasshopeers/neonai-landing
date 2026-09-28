/**
 * Create/sync #┃guide (Customer-only) and post the install guide if empty.
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
import { TUTORIAL_INSTALL_URL } from "./site.js";

const token = process.env.DISCORD_BOT_TOKEN!;
const guildId = process.env.DISCORD_GUILD_ID!;

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("ready", async () => {
  try {
    const guild = await client.guilds.fetch(guildId);
    await guild.roles.fetch();
    await guild.channels.fetch();
    const roles = resolveRoleMap(guild);

    const neonaiCat = SERVER_LAYOUT.find((c) => c.name === CATEGORIES.neonai);
    const tutorialsDef = neonaiCat?.channels.find(
      (c) => c.name === CHANNELS.guide
    );
    if (!tutorialsDef) {
      console.error("tutorials channel missing from SERVER_LAYOUT");
      process.exit(1);
    }

    let parent = guild.channels.cache.find(
      (c) => c.type === ChannelType.GuildCategory && c.name === CATEGORIES.neonai
    );
    if (!parent) {
      parent = await guild.channels.create({
        name: CATEGORIES.neonai,
        type: ChannelType.GuildCategory,
        reason: "NeonAi tutorials sync",
      });
      console.log(`+ category ${CATEGORIES.neonai}`);
    }

    const overwrites = channelOverwrites(guild, roles, tutorialsDef);
    let channel = guild.channels.cache.find(
      (c) =>
        c.parentId === parent!.id &&
        c.name === CHANNELS.guide &&
        c.type === ChannelType.GuildText
    );

    if (!channel) {
      channel = await guild.channels.create({
        name: CHANNELS.guide,
        type: ChannelType.GuildText,
        parent: parent.id,
        topic: tutorialsDef.topic,
        permissionOverwrites: overwrites,
        reason: "NeonAi tutorials channel",
      });
      console.log(`+ #${CHANNELS.guide}`);
    } else {
      await channel.edit({
        topic: tutorialsDef.topic,
        permissionOverwrites: overwrites,
        reason: "NeonAi tutorials sync",
      });
      console.log(`↻ #${CHANNELS.guide}`);
    }

    // Place after changelogs if possible
    const changelogs = guild.channels.cache.find(
      (c) => c.parentId === parent!.id && c.name === CHANNELS.changelogs
    );
    if (changelogs && "position" in changelogs) {
      try {
        await channel.setPosition(changelogs.position + 1);
      } catch {
        /* non-fatal */
      }
    }

    const text = findTextChannel(guild, CHANNELS.guide);
    if (!text?.isTextBased()) {
      console.error("Could not resolve tutorials text channel");
      process.exit(1);
    }

    const botId = client.user?.id;
    const recent = await text.messages.fetch({ limit: 15 }).catch(() => null);
    const already = recent?.some(
      (m) =>
        m.author.id === botId &&
        m.embeds.some((e) => e.title?.includes("How to Install NeonAi"))
    );

    if (!already) {
      const embed = new EmbedBuilder()
        .setColor(BRAND.colors.crimson)
        .setTitle(`${BRAND.emoji.product} How to Install NeonAi`)
        .setDescription(
          [
            "Step-by-step install guide for customers.",
            "",
            `▶ [**Watch on YouTube**](${TUTORIAL_INSTALL_URL})`,
            "",
            "More setup / config tutorials will be posted here as they’re ready.",
          ].join("\n")
        )
        .setFooter(brandEmbed().footer);

      await text.send({ embeds: [embed] });
      console.log("Posted install guide");
    } else {
      console.log("Install guide already present");
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

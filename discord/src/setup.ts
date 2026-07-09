import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
} from "discord.js";
import { BRAND, brandEmbed } from "./brand.js";
import { relocateOpenTickets } from "./ticket-channels.js";
import { buildStaffOnboardingEmbeds } from "./staff-guide.js";
import {
  CHANNELS,
  DEFAULT_DISCORD_CATEGORIES,
  DEFAULT_DISCORD_CHANNELS,
  LEGACY_CATEGORIES,
  LEGACY_ROLE_NAMES,
  REMOVED_CHANNELS,
  ROLES,
  SERVER_LAYOUT,
  TICKET_OPTIONS,
  assignOwnerManagement,
  channelOverwrites,
  findTextChannel,
  resolveRoleMap,
} from "./layout.js";

const token = process.env.DISCORD_BOT_TOKEN;
const guildId = process.env.DISCORD_GUILD_ID;
const ownerId = process.env.DISCORD_OWNER_ID;

if (!token || !guildId || !ownerId) {
  console.error(
    "Missing env vars. Copy .env.example → .env and fill in token, guild ID, and owner ID."
  );
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

async function migrateLegacyRoles(guild: import("discord.js").Guild) {
  for (const [oldName, newName] of Object.entries(LEGACY_ROLE_NAMES)) {
    const legacy = guild.roles.cache.find((r) => r.name === oldName);
    const target = guild.roles.cache.find((r) => r.name === newName);
    if (legacy && !target) {
      await legacy.setName(newName, "NeonAi role migration");
      console.log(`  ↻ renamed role: ${oldName} → ${newName}`);
    }
  }
}

async function ensureRoles(guild: import("discord.js").Guild) {
  await migrateLegacyRoles(guild);
  const created: Record<string, import("discord.js").Role> = {};

  for (const roleDef of ROLES) {
    let role = guild.roles.cache.find((r) => r.name === roleDef.name);

    if (role) {
      await role.edit({
        colors: { primaryColor: roleDef.color },
        hoist: roleDef.hoist,
        mentionable: roleDef.mentionable,
        permissions: roleDef.permissions,
        reason: "NeonAi role sync",
      });
      created[roleDef.name] = role;
      console.log(`  ↻ synced role: ${roleDef.name}`);
      continue;
    }

    role = await guild.roles.create({
      name: roleDef.name,
      colors: { primaryColor: roleDef.color },
      hoist: roleDef.hoist,
      mentionable: roleDef.mentionable,
      permissions: roleDef.permissions,
      reason: "NeonAi server setup",
    });
    created[roleDef.name] = role;
    console.log(`  + created role: ${roleDef.name}`);
  }

  return created;
}

async function syncRoleHierarchy(guild: import("discord.js").Guild) {
  const ordered = ROLES.map((r) =>
    guild.roles.cache.find((role) => role.name === r.name)
  ).filter((r): r is import("discord.js").Role => !!r);

  const botRole = guild.members.me?.roles.highest;
  let position = (botRole?.position ?? ordered.length) - 1;

  for (const role of ordered) {
    if (position < 1) break;
    try {
      await role.setPosition(position, { reason: "NeonAi role hierarchy" });
      position -= 1;
    } catch {
      /* bot may lack position above this role yet */
    }
  }
  console.log("  ↻ role hierarchy synced (member list sidebar)");
}

async function removeDeprecatedChannels(guild: import("discord.js").Guild) {
  for (const name of REMOVED_CHANNELS) {
    const channel = guild.channels.cache.find((c) => c.name === name);
    if (!channel) continue;
    await channel.delete("NeonAi layout update");
    console.log(`  - removed deprecated #${name}`);
  }
}

async function setBotAvatar(client: Client) {
  const avatarPath = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "assets",
    "neonai-bot-avatar.png"
  );
  if (!existsSync(avatarPath)) {
    console.log("  ! bot avatar file missing — skip");
    return;
  }

  const buffer = readFileSync(avatarPath);
  await client.user?.setAvatar(buffer);
  console.log("  + updated bot avatar");
}

async function postWelcomeBanner(guild: import("discord.js").Guild) {
  const bannerPath = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "assets",
    "neonai-discord-banner.png"
  );
  const welcome = findTextChannel(guild, CHANNELS.welcome);
  if (!welcome || !existsSync(bannerPath)) return;

  const recent = await welcome.messages.fetch({ limit: 20 });
  for (const msg of recent.values()) {
    const hasBanner = msg.attachments.some((a) =>
      a.name?.includes("neonai-discord-banner")
    );
    if (hasBanner || msg.embeds[0]?.title === "Happy Aiming") {
      await msg.delete().catch(() => undefined);
    }
  }

  const buffer = readFileSync(bannerPath);
  const embed = new EmbedBuilder()
    .setColor(BRAND.colors.crimson)
    .setTitle("Happy Aiming")
    .setDescription(
      [
        `Welcome to **${BRAND.name}** — ${BRAND.tagline}.`,
        "",
        `• Read **#${CHANNELS.tos}**`,
        `• Check **#${CHANNELS.news}** for updates`,
        `• Need help? **#${CHANNELS.ticket}**`,
      ].join("\n")
    )
    .setImage("attachment://neonai-discord-banner.png")
    .setFooter(brandEmbed().footer);

  await welcome.send({
    embeds: [embed],
    files: [{ attachment: buffer, name: "neonai-discord-banner.png" }],
  });
  console.log("  + posted welcome banner");
}

async function cleanupDefaultDiscordChannels(
  guild: import("discord.js").Guild
) {
  for (const catName of DEFAULT_DISCORD_CATEGORIES) {
    const category = guild.channels.cache.find(
      (c) => c.type === ChannelType.GuildCategory && c.name === catName
    );
    if (!category) continue;

    const children = guild.channels.cache.filter(
      (c) => c.parentId === category.id
    );
    for (const child of children.values()) {
      await child.delete("Remove Discord default channel");
      console.log(`  - removed default #${child.name}`);
    }
    await category.delete("Remove Discord default category");
    console.log(`  - removed default category: ${catName}`);
  }

  for (const name of DEFAULT_DISCORD_CHANNELS) {
    const loose = guild.channels.cache.find(
      (c) => c.name === name && !c.parentId
    );
    if (loose) {
      await loose.delete("Remove Discord default channel");
      console.log(`  - removed loose channel: ${name}`);
    }
  }
}

async function reorderCategoryChannels(guild: import("discord.js").Guild) {
  for (const categoryDef of SERVER_LAYOUT) {
    const category = guild.channels.cache.find(
      (c) =>
        c.type === ChannelType.GuildCategory && c.name === categoryDef.name
    );
    if (!category) continue;

    for (let i = 0; i < categoryDef.channels.length; i++) {
      const chDef = categoryDef.channels[i];
      const channel = guild.channels.cache.find(
        (c) => c.parentId === category.id && c.name === chDef.name
      );
      if (!channel || channel.position === i) continue;
      try {
        await channel.setPosition(i);
      } catch {
        /* position race — non-fatal */
      }
    }
  }
  console.log("  ↻ channel order synced");
}

async function cleanupLegacyLayout(guild: import("discord.js").Guild) {
  for (const catName of LEGACY_CATEGORIES) {
    const category = guild.channels.cache.find(
      (c) => c.type === ChannelType.GuildCategory && c.name === catName
    );
    if (!category) continue;

    const children = guild.channels.cache.filter((c) => c.parentId === category.id);
    for (const child of children.values()) {
      await child.delete("NeonAi layout migration");
      console.log(`  - removed legacy #${child.name}`);
    }
    await category.delete("NeonAi layout migration");
    console.log(`  - removed legacy category: ${catName}`);
  }
}

async function provisionChannels(guild: import("discord.js").Guild) {
  const roles = resolveRoleMap(guild);

  for (const categoryDef of SERVER_LAYOUT) {
    let category = guild.channels.cache.find(
      (c) =>
        c.type === ChannelType.GuildCategory && c.name === categoryDef.name
    );

    if (!category) {
      category = await guild.channels.create({
        name: categoryDef.name,
        type: ChannelType.GuildCategory,
        reason: "NeonAi server setup",
      });
      console.log(`+ category: ${categoryDef.name}`);
    } else {
      console.log(`✓ category exists: ${categoryDef.name}`);
    }

    for (const channelDef of categoryDef.channels) {
      const overwrites = channelOverwrites(guild, roles, channelDef);
      const existing = guild.channels.cache.find(
        (c) =>
          c.parentId === category!.id &&
          c.name === channelDef.name &&
          c.type === channelDef.type
      );

      if (existing) {
        await existing.edit({
          ...(channelDef.topic && channelDef.type === ChannelType.GuildText
            ? { topic: channelDef.topic }
            : {}),
          permissionOverwrites: overwrites,
          reason: "NeonAi permission sync",
        });
        console.log(`  ↻ synced: #${channelDef.name}`);
        continue;
      }

      await guild.channels.create({
        name: channelDef.name,
        type: channelDef.type,
        parent: category.id,
        ...(channelDef.topic && channelDef.type === ChannelType.GuildText
          ? { topic: channelDef.topic }
          : {}),
        permissionOverwrites: overwrites,
        reason: "NeonAi server setup",
      });
      console.log(`  + channel: #${channelDef.name}`);
    }
  }
}

async function postIfEmpty(
  channel: import("discord.js").TextBasedChannel,
  payload: import("discord.js").MessageCreateOptions
) {
  if (!("messages" in channel)) return false;
  const recent = await channel.messages.fetch({ limit: 5 });
  if (recent.size > 0) return false;
  await channel.send(payload);
  return true;
}

async function postTicketPanel(
  channel: import("discord.js").TextChannel,
  titleSuffix: string
) {
  const embed = new EmbedBuilder()
    .setColor(BRAND.colors.crimson)
    .setTitle(`${BRAND.emoji.ticket} ${BRAND.name} Support`)
    .setDescription(
      [
        "Need help? Pick a category below.",
        "A private channel opens for you and our support team.",
        "",
        titleSuffix,
        "",
        "**Available 24/7**",
      ].join("\n")
    )
    .setFooter(brandEmbed().footer);

  const menu = new StringSelectMenuBuilder()
    .setCustomId("neonai_ticket_select")
    .setPlaceholder("Choose a support category…")
    .addOptions(
      TICKET_OPTIONS.map((opt) => ({
        label: opt.label,
        description: opt.description.slice(0, 100),
        value: opt.id,
        emoji: opt.emoji,
      }))
    );

  const row =
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);

  return postIfEmpty(channel, { embeds: [embed], components: [row] });
}

async function postStarterMessages(guild: import("discord.js").Guild) {
  const verify = findTextChannel(guild, CHANNELS.verify);
  if (verify?.isTextBased()) {
    const embed = new EmbedBuilder()
      .setColor(BRAND.colors.crimson)
      .setTitle(`${BRAND.emoji.verify} Server Verification`)
      .setDescription(
        [
          `Welcome to **${BRAND.name}** — ${BRAND.tagline}.`,
          "",
          "To keep the server clean and secure, every new member must verify.",
          "",
          "**Before you continue:**",
          `• Read **#${CHANNELS.welcome}** and **#${CHANNELS.tos}** after you're in`,
          "• No cracked builds, leaked keys, or harassment",
          "• External software is your own responsibility",
          "",
          "Click **Verify** to get the **Member** role and unlock info + tickets.",
          "Purchase a license to receive **Customer** — unlocks product channels, chat & voice.",
        ].join("\n")
      )
      .setFooter(brandEmbed().footer);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("neonai_verify")
        .setLabel("Verify")
        .setStyle(ButtonStyle.Danger)
        .setEmoji(BRAND.emoji.verify)
    );

    if (await postIfEmpty(verify, { embeds: [embed], components: [row] })) {
      console.log("  + posted verify panel");
    }
  }

  const tos = findTextChannel(guild, CHANNELS.tos);
  if (tos?.isTextBased()) {
    const embed = new EmbedBuilder()
      .setColor(BRAND.colors.crimson)
      .setTitle(`${BRAND.emoji.tos} Terms of Service`)
      .setDescription(
        [
          "**1.** Respect all members and staff.",
          "**2.** No sharing cracked builds, leaked keys, or pirated content.",
          "**3.** Keep support in tickets — don't DM staff without permission.",
          "**4.** External software carries risk — you are responsible for your setup.",
          "**5.** Digital activations are final; support covers compatibility issues.",
          "**6.** Staff decisions are final.",
        ].join("\n")
      )
      .setFooter(brandEmbed().footer);

    if (await postIfEmpty(tos, { embeds: [embed] })) {
      console.log("  + posted TOS embed");
    }
  }

  const news = findTextChannel(guild, CHANNELS.news);
  if (news?.isTextBased()) {
    const embed = new EmbedBuilder()
      .setColor(BRAND.colors.crimson)
      .setTitle(`${BRAND.emoji.news} Announcements`)
      .setDescription(
        "Major product news, maintenance windows, and release announcements will be posted here."
      )
      .setFooter(brandEmbed().footer);

    if (await postIfEmpty(news, { embeds: [embed] })) {
      console.log("  + posted news embed");
    }
  }

  const purchase = findTextChannel(guild, CHANNELS.purchase);
  if (purchase?.isTextBased()) {
    const embed = new EmbedBuilder()
      .setColor(BRAND.colors.crimson)
      .setTitle(`${BRAND.emoji.purchase} Purchase NeonAi`)
      .setDescription(
        [
          "Get instant access through our secure Stripe checkout.",
          "",
          "**After purchase:**",
          `1. Check your email for the license key`,
          `2. Head to **#${CHANNELS.redeem}** to activate`,
          `3. Open **#${CHANNELS.ticket}** if you need help`,
          "",
          "_Add your checkout URL in setup or post it here manually._",
        ].join("\n")
      )
      .setFooter(brandEmbed().footer);

    if (await postIfEmpty(purchase, { embeds: [embed] })) {
      console.log("  + posted purchase embed");
    }
  }

  const neonai = findTextChannel(guild, CHANNELS.neonai);
  if (neonai?.isTextBased()) {
    const embed = new EmbedBuilder()
      .setColor(BRAND.colors.crimson)
      .setTitle(`${BRAND.emoji.product} NeonAi Overview`)
      .setDescription(
        [
          "External AI aim assistant — screen capture + vector math.",
          "No game memory access. Built for isolation.",
          "",
          "See **#┃features-list** for the full breakdown.",
        ].join("\n")
      )
      .setFooter(brandEmbed().footer);

    if (await postIfEmpty(neonai, { embeds: [embed] })) {
      console.log("  + posted product overview");
    }
  }

  const features = findTextChannel(guild, CHANNELS.featuresList);
  if (features?.isTextBased()) {
    const embed = new EmbedBuilder()
      .setColor(BRAND.colors.crimson)
      .setTitle(`${BRAND.emoji.features} Features`)
      .setDescription(
        [
          "**Universal Support** — multi-title integration",
          "**Built for Isolation** — external vector math, private builds",
          "**Zero Input Delay** — multi-threaded engine loops",
          "**24/7 Live Support** — direct ticket integration",
        ].join("\n")
      )
      .setFooter(brandEmbed().footer);

    if (await postIfEmpty(features, { embeds: [embed] })) {
      console.log("  + posted features embed");
    }
  }

  const redeem = findTextChannel(guild, CHANNELS.redeem);
  if (redeem?.isTextBased()) {
    const embed = new EmbedBuilder()
      .setColor(BRAND.colors.crimson)
      .setTitle(`${BRAND.emoji.redeem} Redeem License`)
      .setDescription(
        [
          "After your key is delivered, you automatically receive the **Customer** role.",
          "",
          "1. Copy your license key from the delivery message",
          `2. Follow the activation steps in **#${CHANNELS.neonai}**`,
          `3. Need help? Open **#${CHANNELS.customerSupport}** → **Billing & License**`,
        ].join("\n")
      )
      .setFooter(brandEmbed().footer);

    if (await postIfEmpty(redeem, { embeds: [embed] })) {
      console.log("  + posted redeem embed");
    }
  }

  const ticketChannel = findTextChannel(guild, CHANNELS.ticket);
  if (ticketChannel?.isTextBased()) {
    if (
      await postTicketPanel(
        ticketChannel,
        "_Members only — staff handles your private ticket._"
      )
    ) {
      console.log("  + posted member ticket panel");
    }
  }

  const customerSupport = findTextChannel(guild, CHANNELS.customerSupport);
  if (customerSupport?.isTextBased()) {
    if (
      await postTicketPanel(
        customerSupport,
        "_Customers only — staff handles your private ticket._"
      )
    ) {
      console.log("  + posted customer support panel");
    }
  }
}

async function postStaffOnboarding(guild: import("discord.js").Guild) {
  const staffGuide = findTextChannel(guild, CHANNELS.staffGuide);
  if (!staffGuide?.isTextBased()) return;

  const embeds = buildStaffOnboardingEmbeds();
  if (await postIfEmpty(staffGuide, { embeds })) {
    console.log("  + posted staff onboarding (staff-only)");
  }
}

client.once("ready", async () => {
  try {
    const guild = await client.guilds.fetch(guildId);
    console.log(`\nSetting up **${guild.name}** for ${BRAND.name}…\n`);

    console.log("Cleanup:");
    await cleanupLegacyLayout(guild);
    await cleanupDefaultDiscordChannels(guild);
    await removeDeprecatedChannels(guild);

    console.log("\nBot:");
    await setBotAvatar(client);

    console.log("\nRoles:");
    const roleMap = await ensureRoles(guild);
    await syncRoleHierarchy(guild);
    await assignOwnerManagement(guild, ownerId, roleMap.Management ?? null);

    console.log("\nChannels:");
    await provisionChannels(guild);
    await relocateOpenTickets(guild);
    await reorderCategoryChannels(guild);

    console.log("\nStarter messages:");
    await postStarterMessages(guild);
    await postStaffOnboarding(guild);
    await postWelcomeBanner(guild);

    console.log("\n✅ Setup complete. Run `npm run bot` to keep tickets + verify live.\n");
  } catch (err) {
    console.error("Setup failed:", err);
    process.exitCode = 1;
  } finally {
    client.destroy();
  }
});

client.login(token);

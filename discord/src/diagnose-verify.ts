import "dotenv/config";
import { Client, GatewayIntentBits } from "discord.js";
import { CHANNELS, findTextChannel, resolveRoleMap } from "./layout.js";

const token = process.env.DISCORD_BOT_TOKEN;
const guildId = process.env.DISCORD_GUILD_ID;

if (!token || !guildId) {
  console.error("Missing DISCORD_BOT_TOKEN or DISCORD_GUILD_ID");
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

client.once("ready", async () => {
  try {
    const guild = await client.guilds.fetch(guildId);
    await guild.members.fetch(client.user!.id);
    const me = guild.members.me!;
    const roles = resolveRoleMap(guild);

    console.log(`\n=== Verify diagnostics (${guild.name}) ===\n`);
    console.log(`Bot: ${me.user.tag}`);
    console.log(`Manage Roles: ${me.permissions.has("ManageRoles")}`);
    console.log(`Highest role: ${me.roles.highest.name} (pos ${me.roles.highest.position})`);

    if (roles.member) {
      console.log(
        `Member role: ${roles.member.name} (pos ${roles.member.position}) — can assign: ${me.roles.highest.position > roles.member.position}`
      );
    } else {
      console.log("Member role: MISSING");
    }

    const verify = findTextChannel(guild, CHANNELS.verify);
    if (!verify) {
      console.log(`#${CHANNELS.verify}: MISSING`);
    } else {
      const perms = verify.permissionsFor(me);
      console.log(`#${CHANNELS.verify}:`);
      console.log(`  ViewChannel: ${perms?.has("ViewChannel")}`);
      console.log(`  SendMessages: ${perms?.has("SendMessages")}`);

      const messages = await verify.messages.fetch({ limit: 20 });
      const mainPanels = [...messages.values()].filter(
        (m) =>
          m.author.id === client.user!.id &&
          JSON.stringify(m.components).includes("neonai_verify")
      );
      console.log(`  NeonAi verify panels: ${mainPanels.length}`);
    }

    for (const url of [
      "https://neonai-bot.onrender.com/",
      "https://neonai-ticket-bot.onrender.com/",
    ]) {
      const health = await fetch(url).then((r) => r.text()).catch(() => "offline");
      console.log(`Render ${url}: ${health.trim().slice(0, 40)}`);
    }
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  } finally {
    client.destroy();
  }
});

client.login(token);

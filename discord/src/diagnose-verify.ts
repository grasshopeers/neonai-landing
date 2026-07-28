import "dotenv/config";
import { Client, GatewayIntentBits } from "discord.js";
import { CHANNELS, findTextChannel, resolveRoleMap } from "./layout.js";

const token = process.env.DISCORD_TICKET_BOT_TOKEN;
const guildId = process.env.DISCORD_GUILD_ID;

if (!token || !guildId) {
  console.error("Missing DISCORD_TICKET_BOT_TOKEN or DISCORD_GUILD_ID");
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
    console.log(`Bot: ${me.user.tag} (${me.id})`);
    console.log(`Manage Roles: ${me.permissions.has("ManageRoles")}`);
    console.log(`Highest role: ${me.roles.highest.name} (pos ${me.roles.highest.position})`);

    if (roles.member) {
      console.log(
        `Member role: ${roles.member.name} (pos ${roles.member.position}) — bot can assign: ${me.roles.highest.position > roles.member.position}`
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
      console.log(`  ReadMessageHistory: ${perms?.has("ReadMessageHistory")}`);

      const messages = await verify.messages.fetch({ limit: 20 });
      const panels = [...messages.values()].filter(
        (m) =>
          m.author.id === client.user!.id &&
          JSON.stringify(m.components).includes("neonai_verify")
      );
      console.log(`  Ticket-bot verify panels: ${panels.length}`);
      if (panels.length === 0) {
        const anyPanels = [...messages.values()].filter((m) =>
          JSON.stringify(m.components).includes("neonai_verify")
        );
        console.log(`  Other-bot verify panels: ${anyPanels.length}`);
        for (const p of anyPanels) {
          console.log(`    - author ${p.author.tag} msg ${p.id}`);
        }
      }
    }

    const health = await fetch("https://neonai-ticket-bot.onrender.com/").then(
      (r) => r.text()
    );
    console.log(`\nRender health: ${health.trim().slice(0, 80)}`);
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  } finally {
    client.destroy();
  }
});

client.login(token);

/**
 * Check Discord audit log for ticket-log deletions and harden #┃ticket-logs permissions.
 */
import "dotenv/config";
import {
  AuditLogEvent,
  Client,
  GatewayIntentBits,
  PermissionFlagsBits,
} from "discord.js";
import {
  CHANNELS,
  ROLES,
  SERVER_LAYOUT,
  channelOverwrites,
  findTextChannel,
  resolveRoleMap,
} from "./layout.js";
import { auditTicketLogDeletions } from "./ticket-log-guard.js";

const token = process.env.DISCORD_BOT_TOKEN!;
const guildId = process.env.DISCORD_GUILD_ID!;
const ownerId = process.env.DISCORD_OWNER_ID;

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildModeration],
});

client.once("ready", async () => {
  try {
    const guild = await client.guilds.fetch(guildId);
    await guild.roles.fetch();
    const roles = resolveRoleMap(guild);

    // Strip Administrator from Management so ticket-log overwrites apply
    if (roles.management) {
      const desired = ROLES.find((r) => r.name === "Management");
      if (desired && roles.management.permissions.has(PermissionFlagsBits.Administrator)) {
        await roles.management.setPermissions(
          [...desired.permissions],
          "Ticket logs: remove Administrator so channel overwrites apply"
        );
        console.log("Updated Management role: removed Administrator");
      }
    }

    const def = SERVER_LAYOUT.flatMap((c) => c.channels).find(
      (c) => c.name === CHANNELS.ticketLogs
    );
    const logs = findTextChannel(guild, CHANNELS.ticketLogs);
    if (def && logs) {
      await logs.edit({
        topic: def.topic,
        permissionOverwrites: channelOverwrites(guild, roles, def),
        reason: "Harden ticket-logs — staff view only",
      });
      console.log(`Hardened #${CHANNELS.ticketLogs} permissions`);
    } else {
      console.error("Missing ticket-logs channel or def");
    }

    // Explicit owner allow (optional — owner bypasses anyway)
    if (ownerId && logs) {
      await logs.permissionOverwrites
        .edit(ownerId, {
          ViewChannel: true,
          ReadMessageHistory: true,
          ManageMessages: true,
          SendMessages: true,
        })
        .catch(() => undefined);
      console.log("Owner overwrite set on ticket-logs");
    }

    console.log("\n--- Audit: MessageDelete (recent) touching ticket-logs ---");
    const result = await auditTicketLogDeletions(client, guildId);
    if (!result.ok) {
      console.log("Audit failed:", result.error);
    } else {
      console.log(`#┃ticket-logs id=${result.channelId}`);
      console.log(`Recent messages still present: ${result.recentLogCount}`);
      if (result.deletions.length === 0) {
        console.log(
          "No clear MessageDelete audit entries tied to ticket-logs in the last fetch window."
        );
        console.log(
          "(Discord audit logs are limited; deletions by users with Administrator may still appear.)"
        );
      } else {
        for (const hit of result.deletions) {
          console.log(`- ${hit.when} · ${hit.executor} · count=${hit.count}`);
        }
      }
    }

    // Broader scan: any MessageDelete by non-owner in last 50
    const raw = await guild.fetchAuditLogs({
      type: AuditLogEvent.MessageDelete,
      limit: 50,
    });
    console.log("\n--- Last 50 MessageDelete events (any channel) ---");
    let n = 0;
    for (const e of raw.entries.values()) {
      const ch = (e.extra as { channel?: { name?: string; id?: string } } | undefined)
        ?.channel;
      const name = ch?.name ?? "?";
      const who = e.executor ? `${e.executor.tag}` : "?";
      const isOwner = ownerId && e.executor?.id === ownerId;
      if (name.includes("ticket-log") || name.includes("ticket-logs")) {
        console.log(
          `* ${e.createdAt.toISOString()} #${name} by ${who}${isOwner ? " (owner)" : " ⚠ not owner"}`
        );
        n++;
      }
    }
    if (n === 0) console.log("None explicitly labeled ticket-logs in audit extras.");
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  } finally {
    client.destroy();
  }
});

client.login(token);

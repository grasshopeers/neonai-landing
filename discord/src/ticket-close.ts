import {
  ButtonInteraction,
  ChatInputCommandInteraction,
  type Client,
  type Guild,
  type TextChannel,
} from "discord.js";
import { CHANNELS, findTextChannel, isStaffMember, resolveRoleMap } from "./layout.js";
import {
  clearTicketStaffHandled,
} from "./ticket-handoff.js";
import {
  parseTicketOpenerId,
  recordTicketClosed,
} from "./ticket-guard.js";
import { isTicketChannel } from "./purchase-tickets.js";
import { deferEphemeral, resolveInteractionMember } from "./interaction-utils.js";
import { buildClosedTranscript, postTicketTranscript } from "./ticket-transcripts.js";
import { rememberTicketLogMessage } from "./ticket-log-guard.js";

/** Close ticket channels after 24 hours with no messages */
export const TICKET_INACTIVE_CLOSE_MS = 24 * 60 * 60 * 1000;

const AUTO_CLOSE_CHECK_MS = 60 * 60 * 1000;

export async function closeTicketChannel(
  guild: Guild,
  channel: TextChannel,
  closedBy: string
) {
  const openerId = parseTicketOpenerId(channel.topic);
  if (openerId) recordTicketClosed(openerId);
  clearTicketStaffHandled(channel.id);

  try {
    const record = await buildClosedTranscript(guild, channel, closedBy);
    const logMsg = await postTicketTranscript(guild, record);
    if (logMsg) rememberTicketLogMessage(logMsg);
  } catch (err) {
    console.error(`Failed to archive transcript for #${channel.name}:`, err);
    const logChannel = findTextChannel(guild, CHANNELS.ticketLogs);
    if (logChannel?.isTextBased()) {
      await logChannel
        .send({
          content: `⚠️ Ticket **#${channel.name}** closed by **${closedBy}**, but transcript archive failed.`,
        })
        .catch(() => undefined);
    }
  }

  await channel.delete("NeonAi ticket closed").catch((err) => {
    console.error(`Failed to delete ticket #${channel.name}:`, err);
    throw err;
  });
}

export async function closeTicketFromButton(
  interaction: ButtonInteraction,
  channelId: string
) {
  if (!(await deferEphemeral(interaction))) return;

  const guild = interaction.guild!;
  const channel = (await guild.channels.fetch(channelId).catch(() => null)) as
    | TextChannel
    | null;

  if (!channel?.isTextBased() || !isTicketChannel(channel)) {
    await interaction.editReply({ content: "Ticket channel not found." });
    return;
  }

  const roles = resolveRoleMap(guild);
  const member = await resolveInteractionMember(interaction);
  if (!member) {
    await interaction.editReply({ content: "Could not load your profile. Try again." });
    return;
  }

  const openerId = parseTicketOpenerId(channel.topic);
  const isStaff = isStaffMember(roles, member.roles);
  const isOpener = openerId === interaction.user.id;

  if (!isStaff && !isOpener) {
    await interaction.editReply({
      content: "Only the ticket opener or staff can close this ticket.",
    });
    return;
  }

  await interaction.editReply({ content: "Closing ticket…" });

  try {
    await closeTicketChannel(guild, channel, interaction.user.tag);
  } catch {
    await interaction.followUp({
      content:
        "Could not delete this channel — check the ticket bot has **Manage Channels**.",
      ephemeral: true,
    });
  }
}

export async function handleCloseTicketCommand(
  interaction: ChatInputCommandInteraction
) {
  await interaction.deferReply({ ephemeral: true });

  const guild = interaction.guild!;
  const channel = interaction.channel;
  if (!channel?.isTextBased() || !isTicketChannel(channel)) {
    await interaction.editReply({
      content: "Run `/close` inside an open ticket channel.",
    });
    return;
  }

  const roles = resolveRoleMap(guild);
  const member =
    interaction.member && "roles" in interaction.member
      ? interaction.member
      : await guild.members.fetch(interaction.user.id).catch(() => null);
  if (!member || !("roles" in member)) {
    await interaction.editReply({ content: "Could not load your profile." });
    return;
  }

  const openerId = parseTicketOpenerId(channel.topic);
  const isStaff = isStaffMember(roles, member.roles);
  const isOpener = openerId === interaction.user.id;

  if (!isStaff && !isOpener) {
    await interaction.editReply({
      content: "Only staff or the ticket opener can close this ticket.",
    });
    return;
  }

  await interaction.editReply({ content: "Closing ticket…" });

  try {
    await closeTicketChannel(guild, channel as TextChannel, interaction.user.tag);
  } catch {
    await interaction.followUp({
      content: "Could not delete this channel — check bot **Manage Channels** permission.",
      ephemeral: true,
    });
  }
}

async function sweepInactiveTickets(client: Client, guildId: string) {
  const guild = await client.guilds.fetch(guildId).catch(() => null);
  if (!guild) return;

  await guild.channels.fetch().catch(() => undefined);

  const now = Date.now();
  for (const channel of guild.channels.cache.values()) {
    if (!channel.isTextBased() || !isTicketChannel(channel)) continue;

    const ticketChannel = channel as TextChannel;
    const latest = await ticketChannel.messages.fetch({ limit: 25 }).catch(() => null);
    const lastHuman = latest
      ? [...latest.values()].find((m) => !m.author.bot)
      : undefined;
    const lastActivity = lastHuman?.createdAt ?? ticketChannel.createdAt;

    if (now - lastActivity.getTime() < TICKET_INACTIVE_CLOSE_MS) continue;

    try {
      await closeTicketChannel(
        guild,
        ticketChannel,
        "NeonAi (auto — 24h inactivity)"
      );
      console.log(`Auto-closed inactive ticket #${ticketChannel.name}`);
    } catch (err) {
      console.error(`Auto-close failed for #${ticketChannel.name}:`, err);
    }
  }
}

export function startTicketInactivitySweep(client: Client, guildId: string) {
  const run = () => sweepInactiveTickets(client, guildId).catch(console.error);

  client.once("ready", () => {
    run();
    setInterval(run, AUTO_CLOSE_CHECK_MS);
  });
}

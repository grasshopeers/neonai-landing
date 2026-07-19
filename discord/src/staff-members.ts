import {
  EmbedBuilder,
  type ChatInputCommandInteraction,
  type GuildMember,
} from "discord.js";
import { BRAND } from "./brand.js";
import { CHANNELS, isStaffMember, resolveRoleMap } from "./layout.js";

type MemberBucket = {
  label: string;
  members: GuildMember[];
};

function bucketMembers(
  members: GuildMember[],
  roles: ReturnType<typeof resolveRoleMap>
): MemberBucket[] {
  const buckets: MemberBucket[] = [
    { label: "Management", members: [] },
    { label: "Support", members: [] },
    { label: "Head Staff", members: [] },
    { label: "Staff", members: [] },
    { label: "Media", members: [] },
    { label: "Customer", members: [] },
    { label: "Member", members: [] },
    { label: "Unverified", members: [] },
  ];

  for (const member of members) {
    if (member.user.bot) continue;

    if (roles.management && member.roles.cache.has(roles.management.id)) {
      buckets[0].members.push(member);
    } else if (roles.support && member.roles.cache.has(roles.support.id)) {
      buckets[1].members.push(member);
    } else if (roles.headStaff && member.roles.cache.has(roles.headStaff.id)) {
      buckets[2].members.push(member);
    } else if (roles.staff && member.roles.cache.has(roles.staff.id)) {
      buckets[3].members.push(member);
    } else if (roles.media && member.roles.cache.has(roles.media.id)) {
      buckets[4].members.push(member);
    } else if (roles.customer && member.roles.cache.has(roles.customer.id)) {
      buckets[5].members.push(member);
    } else if (roles.member && member.roles.cache.has(roles.member.id)) {
      buckets[6].members.push(member);
    } else {
      buckets[7].members.push(member);
    }
  }

  return buckets.filter((b) => b.members.length > 0);
}

function formatMemberLine(member: GuildMember) {
  const status = member.presence?.status ?? "offline";
  const icon =
    status === "online"
      ? "🟢"
      : status === "idle"
        ? "🟡"
        : status === "dnd"
          ? "🔴"
          : "⚫";
  return `${icon} ${member.user.tag} (\`${member.id}\`)`;
}

function chunkLines(lines: string[], maxLen = 1000) {
  const chunks: string[] = [];
  let current = "";

  for (const line of lines) {
    const next = current ? `${current}\n${line}` : line;
    if (next.length > maxLen) {
      if (current) chunks.push(current);
      current = line;
    } else {
      current = next;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

export async function handleMembersCommand(
  interaction: ChatInputCommandInteraction
) {
  await interaction.deferReply({ ephemeral: true });

  const guild = interaction.guild!;
  const roles = resolveRoleMap(guild);
  const actor = interaction.member;

  if (
    !actor ||
    !("roles" in actor) ||
    !isStaffMember(
      roles,
      actor.roles as import("discord.js").GuildMemberRoleManager
    )
  ) {
    await interaction.editReply({ content: "Only staff can use `/members`." });
    return;
  }

  await guild.members.fetch();

  const humans = [...guild.members.cache.values()]
    .filter((m) => !m.user.bot)
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

  const buckets = bucketMembers(humans, roles);
  const embeds: EmbedBuilder[] = [];

  const summary = new EmbedBuilder()
    .setColor(BRAND.colors.crimson)
    .setTitle(`${BRAND.emoji.staff} Server Members`)
    .setDescription(
      [
        `**${humans.length}** members (excluding bots)`,
        "",
        `Open **#${CHANNELS.members}** to see the full sidebar list while moderating.`,
        `Check **#${CHANNELS.verify}** for unverified joins.`,
      ].join("\n")
    );

  for (const bucket of buckets) {
    summary.addFields({
      name: `${bucket.label} (${bucket.members.length})`,
      value: bucket.members
        .slice(0, 12)
        .map((m) => m.toString())
        .join(" "),
      inline: false,
    });
  }

  embeds.push(summary);

  for (const bucket of buckets) {
    const lines = bucket.members
      .sort((a, b) => a.displayName.localeCompare(b.displayName))
      .map(formatMemberLine);

    for (const [index, chunk] of chunkLines(lines).entries()) {
      embeds.push(
        new EmbedBuilder()
          .setColor(BRAND.colors.ruby)
          .setTitle(
            index === 0
              ? `${bucket.label} (${bucket.members.length})`
              : `${bucket.label} (cont.)`
          )
          .setDescription(chunk)
      );
    }
  }

  await interaction.editReply({
    embeds: embeds.slice(0, 10),
  });
}

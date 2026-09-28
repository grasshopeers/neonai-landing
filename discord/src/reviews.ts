import { createHash } from "node:crypto";
import {
  EmbedBuilder,
  type ChatInputCommandInteraction,
  type TextChannel,
} from "discord.js";
import { BRAND } from "./brand.js";
import {
  CHANNELS,
  findTextChannel,
  isStaffMember,
  resolveRoleMap,
} from "./layout.js";

/** Staff / public mention — blue clickable Discord mention */
export function staffMention(userId: string) {
  return `<@${userId}>`;
}

/**
 * Stable fake snowflake from a real user ID.
 * Looks unique per customer (like Nyron), but is not their real Discord ID —
 * so copy/paste resolves as @unknown-user and profiles can't open.
 */
export function privacyReviewerId(realUserId: string) {
  const hash = createHash("sha256")
    .update(`neonai-review-v1:${realUserId}`)
    .digest("hex");

  let digits = "";
  for (const c of hash) {
    if (digits.length >= 17) break;
    digits += String(parseInt(c, 16) % 10);
  }
  // 18-digit fake snowflake (won't match a real account)
  return `9${digits}`;
}

/** Nyron-style: code-wrapped <@id> — unique looking, not openable as their real profile */
export function privateReviewerTag(realUserId: string) {
  return `\`<@${privacyReviewerId(realUserId)}>\``;
}

export function scrubCustomerMentions(text: string, customerId: string) {
  const privateTag = privateReviewerTag(customerId);
  return text.replace(
    new RegExp(`\`?<@!?${customerId}>\`?`, "g"),
    privateTag
  );
}

export function buildReviewEmbed(options: {
  reviewText: string;
  reviewerId: string;
  stars?: number;
}) {
  const stars = "★".repeat(Math.min(5, Math.max(1, options.stars ?? 5)));

  return new EmbedBuilder()
    .setColor(0x22c55e)
    .setDescription(
      [
        stars,
        "",
        options.reviewText,
        "",
        "**Review by:**",
        privateReviewerTag(options.reviewerId),
      ].join("\n")
    )
    .setFooter({
      text: `${BRAND.name} · Customer Reviews`,
    });
}

export async function postReview(
  channel: TextChannel,
  options: {
    reviewText: string;
    reviewerId: string;
    stars?: number;
  }
) {
  const embed = buildReviewEmbed(options);
  return channel.send({
    embeds: [embed],
    allowedMentions: { parse: [], users: [] },
  });
}

export async function handleReviewCommand(
  interaction: ChatInputCommandInteraction
) {
  const roles = resolveRoleMap(interaction.guild!);
  const member = interaction.member;
  const isStaff =
    member &&
    "roles" in member &&
    isStaffMember(
      roles,
      member.roles as import("discord.js").GuildMemberRoleManager
    );

  if (!isStaff) {
    await interaction.reply({
      content: "Only staff can post reviews.",
      ephemeral: true,
    });
    return;
  }

  const reviewer = interaction.options.getUser("customer", true);
  const text = interaction.options.getString("text", true).trim();
  const stars = interaction.options.getInteger("stars") ?? 5;

  if (text.length < 8) {
    await interaction.reply({
      content: "Review text is too short.",
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const reviews =
    findTextChannel(interaction.guild!, CHANNELS.reviews) ??
    (interaction.channel?.isTextBased() ? interaction.channel : null);

  if (!reviews?.isTextBased()) {
    await interaction.editReply({
      content: `Could not find **#${CHANNELS.reviews}**.`,
    });
    return;
  }

  const msg = await postReview(reviews as TextChannel, {
    reviewText: scrubCustomerMentions(text, reviewer.id),
    reviewerId: reviewer.id,
    stars,
  });

  const log = findTextChannel(interaction.guild!, CHANNELS.ticketLogs);
  if (log?.isTextBased()) {
    await log
      .send({
        embeds: [
          new EmbedBuilder()
            .setColor(0x22c55e)
            .setTitle("Review posted")
            .setDescription(
              [
                `**Public:** ${msg.url}`,
                `**Customer (private):** <@${reviewer.id}> (\`${reviewer.id}\`)`,
                `**Public tag:** ${privateReviewerTag(reviewer.id)}`,
                `**Posted by:** ${interaction.user.tag}`,
              ].join("\n")
            )
            .setFooter({ text: `${BRAND.name} · Staff only` }),
        ],
        allowedMentions: { parse: [] },
      })
      .catch(() => undefined);
  }

  await interaction.editReply({
    content: `Posted review in **#${CHANNELS.reviews}**. Customer shown as unique private tag (not their real ID).`,
  });
}

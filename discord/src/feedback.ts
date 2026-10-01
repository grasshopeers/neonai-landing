import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
  type Interaction,
  type ModalSubmitInteraction,
  type TextChannel,
} from "discord.js";
import { BRAND, brandEmbed } from "./brand.js";
import {
  CHANNELS,
  findTextChannel,
  resolveRoleMap,
} from "./layout.js";
import { getCustomerKeyTag } from "./customer-keys.js";
import {
  deferEphemeral,
  resolveInteractionMember,
} from "./interaction-utils.js";

export const FEEDBACK_REVIEW_BTN = "neonai_feedback_review";
export const FEEDBACK_BUG_BTN = "neonai_feedback_bug";
export const FEEDBACK_BAN_BTN = "neonai_feedback_ban";

export const FEEDBACK_REVIEW_MODAL = "neonai_feedback_modal_review";
export const FEEDBACK_BUG_MODAL = "neonai_feedback_modal_bug";
export const FEEDBACK_BAN_MODAL = "neonai_feedback_modal_ban";

type FeedbackKind = "review" | "bug" | "ban";

const FEEDBACK: Record<
  FeedbackKind,
  {
    buttonId: string;
    modalId: string;
    panelChannel: string;
    staffChannel: string;
    buttonLabel: string;
    panelTitle: string;
    panelBody: string;
    modalTitle: string;
    detailLabel: string;
    detailPlaceholder: string;
    staffTitle: string;
  }
> = {
  review: {
    buttonId: FEEDBACK_REVIEW_BTN,
    modalId: FEEDBACK_REVIEW_MODAL,
    panelChannel: CHANNELS.reviewUs,
    staffChannel: CHANNELS.customerReviews,
    buttonLabel: "Leave Review",
    panelTitle: "Review Us",
    panelBody:
      "Click below to send a **private** review to staff. Other customers cannot see your submission.",
    modalTitle: "Review Us",
    detailLabel: "Your review",
    detailPlaceholder: "What did you like? Any feedback for NeonAi…",
    staffTitle: "Customer Review",
  },
  bug: {
    buttonId: FEEDBACK_BUG_BTN,
    modalId: FEEDBACK_BUG_MODAL,
    panelChannel: CHANNELS.reportBug,
    staffChannel: CHANNELS.bugReports,
    buttonLabel: "Report Bug",
    panelTitle: "Report a Bug",
    panelBody:
      "Click below to send a **private** bug report to staff. Include Windows version, GPU, and what went wrong.",
    modalTitle: "Report a Bug",
    detailLabel: "Bug details",
    detailPlaceholder: "What happened? Steps to reproduce, error text, GPU…",
    staffTitle: "Bug Report",
  },
  ban: {
    buttonId: FEEDBACK_BAN_BTN,
    modalId: FEEDBACK_BAN_MODAL,
    panelChannel: CHANNELS.reportBan,
    staffChannel: CHANNELS.banReports,
    buttonLabel: "Report Ban",
    panelTitle: "Report a Ban",
    panelBody:
      "Click below to send a **private** ban / false-flag report to staff. Other customers cannot see it.",
    modalTitle: "Report a Ban",
    detailLabel: "Ban report details",
    detailPlaceholder: "Game, approximate time, what happened…",
    staffTitle: "Ban Report",
  },
};

function kindFromButton(id: string): FeedbackKind | null {
  if (id === FEEDBACK_REVIEW_BTN) return "review";
  if (id === FEEDBACK_BUG_BTN) return "bug";
  if (id === FEEDBACK_BAN_BTN) return "ban";
  return null;
}

function kindFromModal(id: string): FeedbackKind | null {
  if (id === FEEDBACK_REVIEW_MODAL) return "review";
  if (id === FEEDBACK_BUG_MODAL) return "bug";
  if (id === FEEDBACK_BAN_MODAL) return "ban";
  return null;
}

export function buildFeedbackPanel(kind: FeedbackKind) {
  const cfg = FEEDBACK[kind];
  const embed = new EmbedBuilder()
    .setColor(BRAND.colors.crimson)
    .setTitle(`${BRAND.emoji.brand} ${cfg.panelTitle}`)
    .setDescription(cfg.panelBody)
    .setFooter(brandEmbed().footer);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(cfg.buttonId)
      .setLabel(cfg.buttonLabel)
      .setStyle(ButtonStyle.Primary)
  );

  return { embeds: [embed], components: [row] };
}

export async function postFeedbackPanels(guild: import("discord.js").Guild) {
  for (const kind of Object.keys(FEEDBACK) as FeedbackKind[]) {
    const cfg = FEEDBACK[kind];
    const ch = findTextChannel(guild, cfg.panelChannel);
    if (!ch?.isTextBased()) continue;
    const channel = ch as TextChannel;

    const recent = await channel.messages.fetch({ limit: 15 }).catch(() => null);
    const hasPanel = recent?.some((m) =>
      m.components.some((row) =>
        row.components.some(
          (c) => "customId" in c && (c as { customId?: string }).customId === cfg.buttonId
        )
      )
    );

    // Remove old free-chat intros without the button
    if (recent) {
      for (const msg of recent.values()) {
        if (msg.author.bot && !msg.components.length) {
          await msg.delete().catch(() => undefined);
        }
      }
    }

    if (!hasPanel) {
      await channel.send(buildFeedbackPanel(kind));
      console.log(`+ feedback panel in #${cfg.panelChannel}`);
    }
  }
}

export async function handleFeedbackButton(interaction: ButtonInteraction) {
  const kind = kindFromButton(interaction.customId);
  if (!kind) return;

  const cfg = FEEDBACK[kind];
  const roles = resolveRoleMap(interaction.guild!);
  const member = await resolveInteractionMember(interaction);

  if (!member || !roles.customer || !member.roles.cache.has(roles.customer.id)) {
    await interaction.reply({
      content: "This form is for **Customer** role only. Redeem a license first.",
      ephemeral: true,
    });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId(cfg.modalId)
    .setTitle(cfg.modalTitle);

  const details = new TextInputBuilder()
    .setCustomId("details")
    .setLabel(cfg.detailLabel)
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder(cfg.detailPlaceholder)
    .setRequired(true)
    .setMinLength(10)
    .setMaxLength(1500);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(details)
  );

  await interaction.showModal(modal);
}

export async function handleFeedbackModal(interaction: ModalSubmitInteraction) {
  const kind = kindFromModal(interaction.customId);
  if (!kind) return;

  const cfg = FEEDBACK[kind];
  const details = interaction.fields.getTextInputValue("details").trim();

  if (!(await deferEphemeral(interaction))) return;

  const tag = getCustomerKeyTag(interaction.user.id);
  if (!tag?.key) {
    await interaction.editReply({
      content: `We don’t have your verified key on file yet. Please verify again in **#${CHANNELS.redeem}**, then resubmit.`,
    });
    return;
  }

  const staff = findTextChannel(interaction.guild!, cfg.staffChannel);
  if (!staff?.isTextBased()) {
    await interaction.editReply({
      content: `Staff inbox **#${cfg.staffChannel}** is missing. Ping an admin.`,
    });
    return;
  }

  await staff.send({
    embeds: [
      new EmbedBuilder()
        .setColor(BRAND.colors.ruby)
        .setTitle(cfg.staffTitle)
        .setDescription(details.slice(0, 4000))
        .addFields(
          {
            name: "From",
            value: `<@${interaction.user.id}> (\`${interaction.user.id}\`)`,
            inline: false,
          },
          { name: "Verified key", value: `\`${tag.key}\``, inline: false },
          ...(kind === "review"
            ? [{ name: "Reward", value: "Add 24 hours to this customer's key.", inline: false }]
            : [])
        )
        .setFooter(brandEmbed().footer)
        .setTimestamp(),
    ],
  });

  await interaction.editReply({
    content: `✅ Sent privately to staff. Other customers **cannot** see this.`,
  });
}

export function isFeedbackInteraction(interaction: Interaction) {
  if (interaction.isButton()) {
    return Boolean(kindFromButton(interaction.customId));
  }
  if (interaction.isModalSubmit()) {
    return Boolean(kindFromModal(interaction.customId));
  }
  return false;
}

export async function handleFeedbackInteraction(interaction: Interaction) {
  if (interaction.isButton() && kindFromButton(interaction.customId)) {
    await handleFeedbackButton(interaction);
    return;
  }
  if (interaction.isModalSubmit() && kindFromModal(interaction.customId)) {
    await handleFeedbackModal(interaction);
  }
}

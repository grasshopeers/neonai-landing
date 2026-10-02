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
} from "discord.js";
import { BRAND, brandEmbed } from "./brand.js";
import {
  CHANNELS,
  canBypassTicketLimits,
  findTextChannel,
  resolveRoleMap,
  staffRoles,
} from "./layout.js";
import { resolveInteractionMember } from "./interaction-utils.js";

const OPEN_BTN = "neonai_hwid_open";
const MODAL = "neonai_hwid_modal";
const KEY_FIELD = "neonai_hwid_key";
const REASON_FIELD = "neonai_hwid_reason";
const ALLOW_PREFIX = "neonai_hwid_ok:";

export function buildHwidPanel() {
  const embed = new EmbedBuilder()
    .setColor(BRAND.colors.crimson)
    .setTitle("HWID Reset")
    .setDescription(
      [
        "Request a hardware ID reset.",
        "",
        "Enter your license key and the reason for the reset.",
      ].join("\n")
    )
    .setFooter(brandEmbed().footer);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(OPEN_BTN)
      .setLabel("Request HWID reset")
      .setStyle(ButtonStyle.Danger)
  );

  return { embeds: [embed], components: [row] };
}

export function isHwidInteraction(interaction: Interaction) {
  if (interaction.isModalSubmit() && interaction.customId === MODAL) return true;
  if (!interaction.isButton()) return false;
  const id = interaction.customId;
  return id === OPEN_BTN || id.startsWith(ALLOW_PREFIX);
}

export async function handleHwidInteraction(interaction: Interaction) {
  if (interaction.isButton() && interaction.customId === OPEN_BTN) {
    await showHwidModal(interaction);
    return;
  }
  if (interaction.isModalSubmit() && interaction.customId === MODAL) {
    await handleHwidModal(interaction);
    return;
  }
  if (interaction.isButton() && interaction.customId.startsWith(ALLOW_PREFIX)) {
    await handleHwidAllow(interaction);
  }
}

async function showHwidModal(interaction: ButtonInteraction) {
  const roles = resolveRoleMap(interaction.guild!);
  const member = await resolveInteractionMember(interaction);
  if (!member || !roles.customer || !member.roles.cache.has(roles.customer.id)) {
    await interaction.reply({
      content: "This form is for customers who have a license.",
      ephemeral: true,
    });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId(MODAL)
    .setTitle("HWID reset")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId(KEY_FIELD)
          .setLabel("License key")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(80)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId(REASON_FIELD)
          .setLabel("Reason for the reset")
          .setPlaceholder("New PC")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(500)
      )
    );

  await interaction.showModal(modal);
}

async function handleHwidModal(interaction: ModalSubmitInteraction) {
  const guild = interaction.guild;
  if (!guild) return;
  const roles = resolveRoleMap(guild);
  const member = await resolveInteractionMember(interaction);
  if (!member || !roles.customer || !member.roles.cache.has(roles.customer.id)) {
    await interaction.reply({
      content: "This form is for customers who have a license.",
      ephemeral: true,
    });
    return;
  }

  const key = interaction.fields.getTextInputValue(KEY_FIELD).trim();
  const reason = interaction.fields.getTextInputValue(REASON_FIELD).trim();
  if (!key || !reason) {
    await interaction.reply({
      content: "Enter your license key and the reason for the reset.",
      ephemeral: true,
    });
    return;
  }

  const staffChannel = findTextChannel(guild, CHANNELS.hwidRequests);
  if (!staffChannel?.isTextBased()) {
    await interaction.reply({
      content: "HWID requests are not available right now. Please try again later.",
      ephemeral: true,
    });
    return;
  }

  const ping = staffRoles(roles).map((role) => `<@&${role.id}>`).join(" ");
  await staffChannel.send({
    content: ping || undefined,
    embeds: [
      new EmbedBuilder()
        .setColor(BRAND.colors.crimson)
        .setTitle("HWID reset request")
        .setDescription(
          [
            `**Customer:** <@${interaction.user.id}>`,
            `**Key:** \`${key.replace(/`/g, "")}\``,
            `**Reason:** ${reason.slice(0, 1000)}`,
          ].join("\n")
        )
        .setFooter(brandEmbed().footer),
    ],
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`${ALLOW_PREFIX}${interaction.user.id}`)
          .setLabel("Allow")
          .setStyle(ButtonStyle.Success)
      ),
    ],
  });

  await interaction.reply({
    content:
      "Submitted. Staff will review your HWID reset request. You will be notified by DM if it is accepted.",
    ephemeral: true,
  });
}

async function handleHwidAllow(interaction: ButtonInteraction) {
  const guild = interaction.guild;
  if (!guild) return;
  const member = await resolveInteractionMember(interaction);
  if (!member || !canBypassTicketLimits(guild, member)) {
    await interaction.reply({
      content: "Only staff can allow an HWID reset.",
      ephemeral: true,
    });
    return;
  }

  const userId = interaction.customId.slice(ALLOW_PREFIX.length);
  if (!userId) {
    await interaction.reply({
      content: "This HWID request is missing the customer.",
      ephemeral: true,
    });
    return;
  }

  await interaction.deferUpdate();
  await disableAllowButton(interaction);

  const user = await interaction.client.users.fetch(userId).catch(() => null);
  try {
    if (!user) throw new Error("missing user");
    await user.send({
      embeds: [
        new EmbedBuilder()
          .setColor(BRAND.colors.crimson)
          .setTitle("HWID reset accepted")
          .setDescription(
            "Your HWID reset request has been accepted. It will be done in the next 5 minutes."
          )
          .setFooter(brandEmbed().footer),
      ],
    });
  } catch {
    await interaction.followUp({
      content: `<@${userId}> — could not DM them. Their DMs are closed. Tell them in the server that the reset was accepted.`,
    });
  }
}

async function disableAllowButton(interaction: ButtonInteraction) {
  const components = interaction.message.components.map((row) => {
    const json = row.toJSON() as {
      type: number;
      components?: Array<{ custom_id?: string; disabled?: boolean }>;
    };
    if (!json.components) return json;
    return {
      ...json,
      components: json.components.map((component) =>
        component.custom_id?.startsWith(ALLOW_PREFIX)
          ? { ...component, disabled: true }
          : component
      ),
    };
  });
  await interaction.message.edit({ components: components as never }).catch(() => undefined);
}

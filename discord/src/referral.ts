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
import {
  codeTaken,
  isReferralCode,
  normalizeReferralCode,
  saveReferralCode,
} from "./referral-store.js";

const CREATE_BTN = "neonai_ref_create";
const CREATE_MODAL = "neonai_ref_create_modal";
const CREATE_LICENSE = "neonai_ref_license";
const CREATE_KEY = "neonai_ref_key";
const CREATE_CODE = "neonai_ref_code";
const APPROVE_PREFIX = "neonai_ref_ok:";
const DENY_PREFIX = "neonai_ref_no:";

export function buildReferPanel() {
  const embed = new EmbedBuilder()
    .setColor(BRAND.colors.crimson)
    .setTitle("Referral code")
    .setDescription(
      [
        "Customers can request one referral code.",
        "",
        "Submit the license you own, your license key, and a code of **6 letters or numbers**.",
        "Staff confirm the license before the code can be used.",
      ].join("\n")
    )
    .setFooter(brandEmbed().footer);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(CREATE_BTN)
      .setLabel("Create referral code")
      .setStyle(ButtonStyle.Danger)
  );

  return { embeds: [embed], components: [row] };
}

export function isReferralInteraction(interaction: Interaction) {
  if (interaction.isModalSubmit() && interaction.customId === CREATE_MODAL) return true;
  if (!interaction.isButton()) return false;
  const id = interaction.customId;
  return id === CREATE_BTN || id.startsWith(APPROVE_PREFIX) || id.startsWith(DENY_PREFIX);
}

export async function handleReferralInteraction(interaction: Interaction) {
  if (interaction.isButton() && interaction.customId === CREATE_BTN) {
    await showCreateModal(interaction);
    return;
  }
  if (interaction.isModalSubmit() && interaction.customId === CREATE_MODAL) {
    await handleCreateModal(interaction);
    return;
  }
  if (interaction.isButton() && interaction.customId.startsWith(APPROVE_PREFIX)) {
    await handleCreateDecision(interaction, "approved");
    return;
  }
  if (interaction.isButton() && interaction.customId.startsWith(DENY_PREFIX)) {
    await handleCreateDecision(interaction, "denied");
  }
}

async function showCreateModal(interaction: ButtonInteraction) {
  const roles = resolveRoleMap(interaction.guild!);
  const member = await resolveInteractionMember(interaction);
  if (!member || !roles.customer || !member.roles.cache.has(roles.customer.id)) {
    await interaction.reply({
      content: "This form is for customers who have redeemed a license.",
      ephemeral: true,
    });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId(CREATE_MODAL)
    .setTitle("Referral code")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId(CREATE_LICENSE)
          .setLabel("License you own")
          .setPlaceholder("1 weekly")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(40)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId(CREATE_KEY)
          .setLabel("License key")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(80)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId(CREATE_CODE)
          .setLabel("Referral code")
          .setPlaceholder("6 letters or numbers")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMinLength(6)
          .setMaxLength(6)
      )
    );

  await interaction.showModal(modal);
}

async function handleCreateModal(interaction: ModalSubmitInteraction) {
  const guild = interaction.guild;
  if (!guild) return;
  const roles = resolveRoleMap(guild);
  const member = await resolveInteractionMember(interaction);
  if (!member || !roles.customer || !member.roles.cache.has(roles.customer.id)) {
    await interaction.reply({
      content: "This form is for customers who have redeemed a license.",
      ephemeral: true,
    });
    return;
  }

  const license = interaction.fields.getTextInputValue(CREATE_LICENSE).trim();
  const key = interaction.fields.getTextInputValue(CREATE_KEY).trim();
  const code = normalizeReferralCode(interaction.fields.getTextInputValue(CREATE_CODE));

  if (!license) {
    await interaction.reply({
      content: "Enter the license you own, such as 1 weekly.",
      ephemeral: true,
    });
    return;
  }
  if (!isReferralCode(code)) {
    await interaction.reply({
      content: "The referral code must be exactly 6 letters or numbers.",
      ephemeral: true,
    });
    return;
  }
  if (codeTaken(code)) {
    await interaction.reply({
      content: "That code is already in use. Choose another.",
      ephemeral: true,
    });
    return;
  }

  const staffChannel = findTextChannel(guild, CHANNELS.referRequests);
  if (!staffChannel?.isTextBased()) {
    await interaction.reply({
      content: "Referral requests are not available right now. Please try again later.",
      ephemeral: true,
    });
    return;
  }

  saveReferralCode({
    code,
    ownerId: interaction.user.id,
    license,
    key,
    status: "pending",
  });

  const ping = staffRoles(roles).map((role) => `<@&${role.id}>`).join(" ");
  await staffChannel.send({
    content: ping || undefined,
    embeds: [
      new EmbedBuilder()
        .setColor(BRAND.colors.crimson)
        .setTitle("Referral request")
        .setDescription(
          [
            `**Customer:** <@${interaction.user.id}>`,
            `**License:** ${license}`,
            `**Key:** \`${key}\``,
            `**Code:** \`${code}\``,
            "",
            "Confirm the license, then approve or deny this code.",
          ].join("\n")
        )
        .setFooter(brandEmbed().footer),
    ],
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`${APPROVE_PREFIX}${code}`)
          .setLabel("Approve")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`${DENY_PREFIX}${code}`)
          .setLabel("Deny")
          .setStyle(ButtonStyle.Danger)
      ),
    ],
  });

  await interaction.reply({
    content: "Submitted. Staff will review your license and you will be notified by DM.",
    ephemeral: true,
  });
}

async function handleCreateDecision(
  interaction: ButtonInteraction,
  status: "approved" | "denied"
) {
  const guild = interaction.guild;
  if (!guild) return;
  const member = await resolveInteractionMember(interaction);
  if (!member || !canBypassTicketLimits(guild, member)) {
    await interaction.reply({
      content: "Only staff can review referral codes.",
      ephemeral: true,
    });
    return;
  }

  const code = normalizeReferralCode(interaction.customId.split(":")[1] ?? "");
  const record = (await import("./referral-store.js")).findReferralCode(code);
  if (!record) {
    await interaction.reply({
      content: "This referral request could not be found.",
      ephemeral: true,
    });
    return;
  }

  await interaction.deferUpdate();
  await disableDecisionButtons(interaction);
  saveReferralCode({ ...record, status });

  const user = await interaction.client.users.fetch(record.ownerId).catch(() => null);
  if (status === "approved") {
    await user?.send({
      embeds: [
        new EmbedBuilder()
          .setColor(BRAND.colors.crimson)
          .setTitle("Referral code approved")
          .setDescription(
            [
              `Your referral code is **${record.code}**.`,
              "",
              "A buyer who enters it receives 10% off.",
            ].join("\n")
          )
          .setFooter(brandEmbed().footer),
      ],
    }).catch(() => undefined);
    return;
  }

  await user?.send({
    embeds: [
      new EmbedBuilder()
        .setColor(BRAND.colors.ruby)
        .setTitle("Referral code not approved")
        .setDescription("Your referral code request was not approved.")
        .setFooter(brandEmbed().footer),
    ],
  }).catch(() => undefined);
}

async function disableDecisionButtons(interaction: ButtonInteraction) {
  const ids = new Set([interaction.customId, `${APPROVE_PREFIX}${interaction.customId.split(":")[1]}`, `${DENY_PREFIX}${interaction.customId.split(":")[1]}`]);
  const components = interaction.message.components.map((row) => {
    const json = row.toJSON() as {
      type: number;
      components?: Array<{ custom_id?: string; disabled?: boolean }>;
    };
    if (!json.components) return json;
    return {
      ...json,
      components: json.components.map((component) =>
        component.custom_id && ids.has(component.custom_id)
          ? { ...component, disabled: true }
          : component
      ),
    };
  });
  await interaction.message.edit({ components: components as never }).catch(() => undefined);
}

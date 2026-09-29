import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
  type Interaction,
  type Message,
  type ModalSubmitInteraction,
  type TextChannel,
} from "discord.js";
import { BRAND, brandEmbed } from "./brand.js";
import {
  canBypassTicketLimits,
  resolveRoleMap,
  staffRoles,
} from "./layout.js";
import { resolveInteractionMember } from "./interaction-utils.js";
import { getBotRoleId, unlockCustomerInTicket } from "./ticket-channels.js";
import { parseTicketKind, parseTicketOpenerId } from "./ticket-guard.js";

const BILL_REPORT = "neonai_bill_report";
const BILL_MODAL = "neonai_bill_modal";
const BILL_ABOUT = "neonai_bill_about";
const BILL_DETAIL = "neonai_bill_detail";

const COMPAT_FORM = "neonai_compat_form";
const COMPAT_MODAL = "neonai_compat_modal";
const COMPAT_GPU = "neonai_compat_gpu";
const COMPAT_RAM = "neonai_compat_ram";
const COMPAT_GAME = "neonai_compat_game";
const COMPAT_QUESTION = "neonai_compat_question";
const COMPAT_APPROVE = "neonai_compat_approve";
const COMPAT_DENY = "neonai_compat_deny";

const SUPPORT_STAGE = {
  form: "form",
  review: "review",
  open: "open",
  denied: "denied",
} as const;

export function parseSupportStage(topic: string | null | undefined) {
  return topic?.match(/ · support:([^\s]+)/)?.[1] ?? null;
}

export function isSupportChatLocked(channel: unknown) {
  if (!channel || typeof channel !== "object") return false;
  const c = channel as { name?: string; topic?: string | null };
  if (parseTicketKind(c.topic, c.name) !== "compatibility") return false;
  const stage = parseSupportStage(c.topic);
  return stage === SUPPORT_STAGE.form || stage === SUPPORT_STAGE.review;
}

export function buildBillingWelcome(channelId: string) {
  const embed = new EmbedBuilder()
    .setColor(BRAND.colors.crimson)
    .setTitle("Billing & License")
    .setDescription(
      [
        "We accept the following payment methods:",
        "",
        "• **Ko-fi / card**",
        "• **Remitly**",
        "• **PayPal**",
        "",
        "Purchases are handled in a purchase ticket. Use this ticket if a payment or license needs to be looked at.",
      ].join("\n")
    )
    .setFooter(brandEmbed().footer);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(BILL_REPORT)
      .setLabel("Report a problem")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`neonai_close_ticket:${channelId}`)
      .setLabel("Close ticket")
      .setStyle(ButtonStyle.Danger)
  );

  return { embeds: [embed], components: [row] };
}

export function buildCompatibilityWelcome(channelId: string) {
  const embed = new EmbedBuilder()
    .setColor(BRAND.colors.crimson)
    .setTitle("Compatibility")
    .setDescription("Please submit your setup so staff can review it.")
    .setFooter(brandEmbed().footer);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(COMPAT_FORM)
      .setLabel("Submit details")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`neonai_close_ticket:${channelId}`)
      .setLabel("Close ticket")
      .setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [row] };
}

export function isSupportFlowInteraction(interaction: Interaction) {
  if (interaction.isModalSubmit()) {
    return (
      interaction.customId === BILL_MODAL || interaction.customId === COMPAT_MODAL
    );
  }
  if (!interaction.isButton()) return false;
  const id = interaction.customId;
  return (
    id === BILL_REPORT ||
    id === COMPAT_FORM ||
    id === COMPAT_APPROVE ||
    id === COMPAT_DENY
  );
}

export async function handleSupportFlowInteraction(interaction: Interaction) {
  if (interaction.isButton() && interaction.customId === BILL_REPORT) {
    await showBillingModal(interaction);
    return;
  }
  if (interaction.isModalSubmit() && interaction.customId === BILL_MODAL) {
    await handleBillingModal(interaction);
    return;
  }
  if (interaction.isButton() && interaction.customId === COMPAT_FORM) {
    await showCompatibilityModal(interaction);
    return;
  }
  if (interaction.isModalSubmit() && interaction.customId === COMPAT_MODAL) {
    await handleCompatibilityModal(interaction);
    return;
  }
  if (interaction.isButton() && interaction.customId === COMPAT_APPROVE) {
    await handleCompatibilityApprove(interaction);
    return;
  }
  if (interaction.isButton() && interaction.customId === COMPAT_DENY) {
    await handleCompatibilityDeny(interaction);
  }
}

function supportChannel(channel: Interaction["channel"]): TextChannel | null {
  if (!channel) return null;
  const parent =
    "isThread" in channel && channel.isThread() ? channel.parent : channel;
  if (!parent || !("name" in parent)) return null;
  if ("isThread" in parent && parent.isThread()) return null;
  if (!parent.isTextBased() || parent.isDMBased()) return null;
  const topic = "topic" in parent ? parent.topic : null;
  const kind = parseTicketKind(topic, parent.name);
  if (kind !== "billing" && kind !== "compatibility") return null;
  return parent as TextChannel;
}

async function setSupportStage(
  channel: TextChannel,
  openerId: string,
  label: string,
  stage: string
) {
  try {
    await channel.setTopic(
      `${BRAND.name} · ${label} · opened by <@${openerId}> · support:${stage}`
    );
  } catch (err) {
    console.error("Failed to set support ticket stage:", err);
  }
}

async function showBillingModal(interaction: ButtonInteraction) {
  const channel = supportChannel(interaction.channel);
  const openerId = parseTicketOpenerId(channel?.topic);
  if (!channel || parseTicketKind(channel.topic, channel.name) !== "billing") {
    await interaction.reply({
      content: "Use this button in your billing ticket.",
      ephemeral: true,
    });
    return;
  }
  if (!openerId || interaction.user.id !== openerId) {
    await interaction.reply({
      content: "Only the customer who opened this ticket can report a problem.",
      ephemeral: true,
    });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId(BILL_MODAL)
    .setTitle("Billing problem")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId(BILL_ABOUT)
          .setLabel("What is this about?")
          .setPlaceholder("Payment, license key, or refund")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(100)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId(BILL_DETAIL)
          .setLabel("Describe the problem")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(1000)
      )
    );

  await interaction.showModal(modal);
}

async function handleBillingModal(interaction: ModalSubmitInteraction) {
  const channel = supportChannel(interaction.channel);
  const openerId = parseTicketOpenerId(channel?.topic);
  if (!channel || !openerId || interaction.user.id !== openerId) {
    await interaction.reply({
      content: "Only the customer who opened this ticket can submit this form.",
      ephemeral: true,
    });
    return;
  }

  const about = interaction.fields.getTextInputValue(BILL_ABOUT).trim();
  const detail = interaction.fields.getTextInputValue(BILL_DETAIL).trim();
  await interaction.deferReply({ ephemeral: true });

  if (interaction.message) {
    await disableCustomIds(interaction.message, [BILL_REPORT]);
  }

  await channel.send({
    content: staffPing(channel.guild),
    embeds: [
      new EmbedBuilder()
        .setColor(BRAND.colors.crimson)
        .setTitle("Billing problem")
        .setDescription(
          [
            `<@${openerId}>`,
            "",
            "**What this is about**",
            about,
            "",
            "**Details**",
            detail,
          ].join("\n")
        )
        .setFooter(brandEmbed().footer),
    ],
  });

  await interaction.editReply({
    content: "Submitted. A staff member will follow up in this ticket.",
  });
}

async function showCompatibilityModal(interaction: ButtonInteraction) {
  const channel = supportChannel(interaction.channel);
  const openerId = parseTicketOpenerId(channel?.topic);
  if (!channel || parseTicketKind(channel.topic, channel.name) !== "compatibility") {
    await interaction.reply({
      content: "Use this button in your compatibility ticket.",
      ephemeral: true,
    });
    return;
  }
  if (!openerId || interaction.user.id !== openerId) {
    await interaction.reply({
      content: "Only the customer who opened this ticket can submit this form.",
      ephemeral: true,
    });
    return;
  }
  const stage = parseSupportStage(channel.topic);
  if (stage && stage !== SUPPORT_STAGE.form) {
    await interaction.reply({
      content: "These details were already submitted.",
      ephemeral: true,
    });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId(COMPAT_MODAL)
    .setTitle("Compatibility")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId(COMPAT_GPU)
          .setLabel("GPU")
          .setPlaceholder("e.g. RTX 4070")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(80)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId(COMPAT_RAM)
          .setLabel("RAM")
          .setPlaceholder("e.g. 16 GB")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(40)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId(COMPAT_GAME)
          .setLabel("Game")
          .setPlaceholder("e.g. Valorant")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(80)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId(COMPAT_QUESTION)
          .setLabel("What do you need checked?")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(1000)
      )
    );

  await interaction.showModal(modal);
}

async function handleCompatibilityModal(interaction: ModalSubmitInteraction) {
  const channel = supportChannel(interaction.channel);
  const openerId = parseTicketOpenerId(channel?.topic);
  if (!channel || !openerId || interaction.user.id !== openerId) {
    await interaction.reply({
      content: "Only the customer who opened this ticket can submit this form.",
      ephemeral: true,
    });
    return;
  }
  const stage = parseSupportStage(channel.topic);
  if (stage && stage !== SUPPORT_STAGE.form) {
    await interaction.reply({
      content: "These details were already submitted.",
      ephemeral: true,
    });
    return;
  }

  const gpu = interaction.fields.getTextInputValue(COMPAT_GPU).trim();
  const ram = interaction.fields.getTextInputValue(COMPAT_RAM).trim();
  const game = interaction.fields.getTextInputValue(COMPAT_GAME).trim();
  const question = interaction.fields.getTextInputValue(COMPAT_QUESTION).trim();

  await interaction.deferReply({ ephemeral: true });
  await setSupportStage(channel, openerId, "Compatibility", SUPPORT_STAGE.review);
  if (interaction.message) {
    await disableCustomIds(interaction.message, [COMPAT_FORM]);
  }

  await channel.send({
    embeds: [
      new EmbedBuilder()
        .setColor(BRAND.colors.crimson)
        .setTitle("Compatibility request received")
        .setDescription(
          [
            `<@${openerId}> — thank you.`,
            "",
            "A staff member will review your setup and follow up in this ticket.",
          ].join("\n")
        )
        .setFooter(brandEmbed().footer),
    ],
  });

  await postCompatibilityReview(channel, openerId, gpu, ram, game, question);
  await interaction.editReply({
    content: "Submitted. A staff member will review it shortly.",
  });
}

async function postCompatibilityReview(
  channel: TextChannel,
  openerId: string,
  gpu: string,
  ram: string,
  game: string,
  question: string
) {
  await ensureStaffThreadAccess(channel);
  const thread = await channel.threads.create({
    name: "Compatibility review",
    type: ChannelType.PrivateThread,
    invitable: false,
    autoArchiveDuration: 1440,
    reason: "Staff-only compatibility review",
  });

  const customer = await channel.client.users.fetch(openerId).catch(() => null);
  const customerName = customer?.username ?? "Customer";
  await addStaffToThread(channel, thread, openerId);
  await thread.send({
    content: staffPing(channel.guild),
    embeds: [
      new EmbedBuilder()
        .setColor(BRAND.colors.crimson)
        .setTitle("Compatibility review")
        .setDescription(
          [
            `**${customerName}** submitted a compatibility request.`,
            "",
            `**GPU:** ${gpu}`,
            `**RAM:** ${ram}`,
            `**Game:** ${game}`,
            `**Question:** ${question}`,
            "",
            "Approve to open the ticket. If you deny, reply in the ticket and explain why.",
            "Staff only — mentioning the customer adds them to this thread.",
          ].join("\n")
        )
        .setFooter(brandEmbed().footer),
    ],
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(COMPAT_APPROVE)
          .setLabel("Approve")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(COMPAT_DENY)
          .setLabel("Deny")
          .setStyle(ButtonStyle.Danger)
      ),
    ],
  });

  const recent = await channel.messages.fetch({ limit: 8 }).catch(() => null);
  if (!recent) return;
  for (const msg of recent.values()) {
    if (!msg.system) continue;
    if (Date.now() - msg.createdTimestamp > 20_000) continue;
    await msg.delete().catch(() => undefined);
  }
}

async function handleCompatibilityApprove(interaction: ButtonInteraction) {
  const channel = supportChannel(interaction.channel);
  if (!channel) {
    await interaction.reply({
      content: "This action only works in a compatibility ticket.",
      ephemeral: true,
    });
    return;
  }
  if (!(await requireStaff(interaction))) {
    await interaction.reply({
      content: "Only staff can approve this request.",
      ephemeral: true,
    });
    return;
  }
  const openerId = parseTicketOpenerId(channel.topic);
  if (!openerId) {
    await interaction.reply({
      content: "Could not find the customer for this ticket.",
      ephemeral: true,
    });
    return;
  }

  await interaction.deferUpdate();
  await disableCustomIds(interaction.message, [COMPAT_APPROVE, COMPAT_DENY]);
  await setSupportStage(channel, openerId, "Compatibility", SUPPORT_STAGE.open);
  await unlockCustomerInTicket(channel, openerId);
  await channel.send({
    content: `<@${openerId}>`,
    embeds: [
      new EmbedBuilder()
        .setColor(BRAND.colors.crimson)
        .setTitle("Compatibility approved")
        .setDescription(
          `<@${openerId}> — your request was approved. You can continue in this ticket.`
        )
        .setFooter(brandEmbed().footer),
    ],
  });
}

async function handleCompatibilityDeny(interaction: ButtonInteraction) {
  const channel = supportChannel(interaction.channel);
  if (!channel) {
    await interaction.reply({
      content: "This action only works in a compatibility ticket.",
      ephemeral: true,
    });
    return;
  }
  if (!(await requireStaff(interaction))) {
    await interaction.reply({
      content: "Only staff can deny this request.",
      ephemeral: true,
    });
    return;
  }
  const openerId = parseTicketOpenerId(channel.topic);
  if (!openerId) {
    await interaction.reply({
      content: "Could not find the customer for this ticket.",
      ephemeral: true,
    });
    return;
  }

  await interaction.deferUpdate();
  await disableCustomIds(interaction.message, [COMPAT_APPROVE, COMPAT_DENY]);
  await setSupportStage(channel, openerId, "Compatibility", SUPPORT_STAGE.denied);
  await unlockCustomerInTicket(channel, openerId);

  await channel.send({
    content: `<@${openerId}>`,
    embeds: [
      new EmbedBuilder()
        .setColor(BRAND.colors.ruby)
        .setTitle("Compatibility not approved")
        .setDescription(
          `<@${openerId}> — this request was not approved. A staff member will follow up in this ticket.`
        )
        .setFooter(brandEmbed().footer),
    ],
  });

  const thread =
    interaction.channel &&
    "isThread" in interaction.channel &&
    interaction.channel.isThread()
      ? interaction.channel
      : null;
  if (thread?.isTextBased()) {
    await thread.send({
      embeds: [
        new EmbedBuilder()
          .setColor(BRAND.colors.ruby)
          .setTitle("Denied")
          .setDescription(
            "The customer can type in the ticket now. Reply there and explain why this was not approved."
          )
          .setFooter(brandEmbed().footer),
      ],
    });
  }
}

function staffPing(guild: import("discord.js").Guild) {
  const ping = staffRoles(resolveRoleMap(guild))
    .map((role) => `<@&${role.id}>`)
    .join(" ");
  return ping || undefined;
}

async function requireStaff(interaction: Interaction) {
  if (!interaction.guild) return false;
  const member = await resolveInteractionMember(interaction as ButtonInteraction);
  return Boolean(member && canBypassTicketLimits(interaction.guild, member));
}

async function ensureStaffThreadAccess(channel: TextChannel) {
  const roles = resolveRoleMap(channel.guild);
  for (const role of staffRoles(roles)) {
    await channel.permissionOverwrites.edit(role.id, {
      ManageThreads: true,
      SendMessagesInThreads: true,
    });
  }
  const botRoleId = getBotRoleId(channel.guild);
  if (botRoleId) {
    await channel.permissionOverwrites.edit(botRoleId, {
      ManageThreads: true,
      CreatePrivateThreads: true,
      SendMessagesInThreads: true,
    });
  }
  const openerId = parseTicketOpenerId(channel.topic);
  if (openerId) {
    await channel.permissionOverwrites.edit(openerId, {
      ManageThreads: false,
      CreatePrivateThreads: false,
      SendMessagesInThreads: false,
    });
  }
}

async function addStaffToThread(
  channel: TextChannel,
  thread: { members: { add: (id: string) => Promise<unknown> } },
  openerId: string
) {
  const staffRoleIds = new Set(
    staffRoles(resolveRoleMap(channel.guild)).map((role) => role.id)
  );
  await channel.guild.members.fetch().catch(() => null);
  for (const member of channel.guild.members.cache.values()) {
    if (member.user.bot || member.id === openerId) continue;
    const onStaff = member.roles.cache.some((role) => staffRoleIds.has(role.id));
    const isOwner = member.id === channel.guild.ownerId;
    if (!onStaff && !isOwner) continue;
    await thread.members.add(member.id).catch(() => undefined);
  }
}

async function disableCustomIds(message: Message | null | undefined, customIds: string[]) {
  if (!message) return;
  const ids = new Set(customIds);
  const components = message.components.map((row) => {
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
  await message.edit({ components: components as never }).catch(() => undefined);
}

import type {
  ButtonInteraction,
  GuildMember,
  StringSelectMenuInteraction,
} from "discord.js";

type MemberInteraction = ButtonInteraction | StringSelectMenuInteraction;

export async function deferEphemeral(
  interaction: MemberInteraction
): Promise<boolean> {
  if (interaction.deferred || interaction.replied) return true;
  try {
    await interaction.deferReply({ ephemeral: true });
    return true;
  } catch {
    return false;
  }
}

export async function resolveInteractionMember(
  interaction: MemberInteraction
): Promise<GuildMember | null> {
  if (interaction.member && "roles" in interaction.member) {
    return interaction.member as GuildMember;
  }
  return interaction.guild!.members.fetch(interaction.user.id).catch(() => null);
}

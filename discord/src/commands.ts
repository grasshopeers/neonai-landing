import {
  PermissionFlagsBits,
  REST,
  Routes,
  SlashCommandBuilder,
} from "discord.js";
import { LICENSE_TIERS } from "./tiers.js";

export const PURCHASE_TICKET_BUTTON = "neonai_purchase_ticket";

const tierChoices = LICENSE_TIERS.map((t) => ({
  name: t.name,
  value: t.value,
}));

export const slashCommands = [
  new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Post the NeonAi purchase ticket panel in this channel")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),

  new SlashCommandBuilder()
    .setName("stripe")
    .setDescription("Send a secure Stripe checkout link to the customer in this ticket")
    .addStringOption((option) =>
      option
        .setName("tier")
        .setDescription("License tier for this checkout")
        .setRequired(true)
        .addChoices(...tierChoices)
    )
    .addStringOption((option) =>
      option
        .setName("link")
        .setDescription("Stripe checkout URL (checkout.stripe.com or buy.stripe.com)")
        .setRequired(true)
        .setMaxLength(512)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setDMPermission(false),

  new SlashCommandBuilder()
    .setName("kofi")
    .setDescription("Send the Ko-fi tip link with the amount for a license tier")
    .addStringOption((option) =>
      option
        .setName("tier")
        .setDescription("License tier the customer should tip for")
        .setRequired(true)
        .addChoices(...tierChoices)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setDMPermission(false),

  new SlashCommandBuilder()
    .setName("remitly")
    .setDescription("Send Remitly bank-deposit details with the amount for a license tier")
    .addStringOption((option) =>
      option
        .setName("tier")
        .setDescription("License tier the customer should send payment for")
        .setRequired(true)
        .addChoices(...tierChoices)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setDMPermission(false),

  new SlashCommandBuilder()
    .setName("paypal")
    .setDescription("Send the PayPal.me link with the amount for a license tier")
    .addStringOption((option) =>
      option
        .setName("tier")
        .setDescription("License tier the customer should pay for")
        .setRequired(true)
        .addChoices(...tierChoices)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setDMPermission(false),

  new SlashCommandBuilder()
    .setName("unmute")
    .setDescription("Restore the customer's ability to send messages in this ticket")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setDMPermission(false),

  new SlashCommandBuilder()
    .setName("deliver")
    .setDescription("Deliver a license key to the customer in this ticket")
    .addStringOption((option) =>
      option
        .setName("tier")
        .setDescription("License tier purchased")
        .setRequired(true)
        .addChoices(...tierChoices)
    )
    .addStringOption((option) =>
      option
        .setName("key")
        .setDescription("License key string to deliver")
        .setRequired(true)
        .setMaxLength(256)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setDMPermission(false),

  new SlashCommandBuilder()
    .setName("price")
    .setDescription("Post NeonAi license tiers and prices for the customer in this ticket")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setDMPermission(false),

  new SlashCommandBuilder()
    .setName("review")
    .setDescription("Post a customer review in #┃reviews (profiles stay private)")
    .addUserOption((option) =>
      option
        .setName("customer")
        .setDescription("Customer who left the review")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("text")
        .setDescription("Review text — staff <@mentions> stay clickable; customer is private")
        .setRequired(true)
        .setMaxLength(1500)
    )
    .addIntegerOption((option) =>
      option
        .setName("stars")
        .setDescription("Star rating 1–5 (default 5)")
        .setMinValue(1)
        .setMaxValue(5)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setDMPermission(false),

  new SlashCommandBuilder()
    .setName("close")
    .setDescription("Close the current ticket channel")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setDMPermission(false),

  new SlashCommandBuilder()
    .setName("members")
    .setDescription("List all server members (staff only)")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setDMPermission(false),
].map((cmd) => cmd.toJSON());

export async function registerSlashCommands(
  token: string,
  clientId: string,
  guildId: string
) {
  const rest = new REST({ version: "10" }).setToken(token);
  await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
    body: slashCommands,
  });
}

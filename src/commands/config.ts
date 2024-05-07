import type { APIEmbedField, ChatInputCommandInteraction } from 'discord.js'
import { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js'
import { configKeys, getConfig, guildDB } from '../dynamicConfig'

export const data = new SlashCommandBuilder()
  .setName('config')
  .setDescription('get current config state')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .setDMPermission(false)
  .addSubcommand(subcommand => subcommand
    .setName('get')
    .setDescription('get current config state'))
  .addSubcommand(subcommand => subcommand
    .setName('set')
    .setDescription('change option')
    .addStringOption(option => option
      .setName('option')
      .setDescription('option to set')
      .setRequired(true)
      .addChoices(...configKeys.map(key => ({ name: key, value: key }))))
    .addBooleanOption(option => option
      .setName('value')
      .setRequired(true)
      .setDescription('value of option you\'re setting')))

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild)
    return interaction.reply({ content: 'all functionality is enabled in dms', ephemeral: true })

  const guild = interaction.guild
  const guildConfig = getConfig(guild.id)

  const subCommand = interaction.options.getSubcommand()
  if (subCommand === 'set') {
    const key = interaction.options.getString('option', true) as typeof configKeys[number]
    guildConfig[key] = interaction.options.getBoolean('value', true)
    guildDB.setKey(guild.id, guildConfig)
  }

  const fields: APIEmbedField[] = []
  for (const key of Object.keys(guildConfig))
    fields.push({ name: key, value: guildConfig[key].toString(), inline: true })

  interaction.reply({ ephemeral: true, embeds: [new EmbedBuilder({ title: `${subCommand === 'set' ? 'New' : 'Current'} Config`, fields })] })
}

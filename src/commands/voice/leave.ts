import type { ChatInputCommandInteraction } from 'discord.js'
import { SlashCommandBuilder } from 'discord.js'
import { Player } from '../../voiceHandler'

export const data = new SlashCommandBuilder()
  .setName('leave')
  .setDescription('leave the current voice channel')

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guildId)
    return interaction.reply({ content: 'not in a server', ephemeral: true })
  Player.getPlayer(interaction.guildId)?.delete()
  interaction.reply({ content: 'bye', ephemeral: true })
}

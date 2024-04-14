import type { ChatInputCommandInteraction } from 'discord.js'
import { SlashCommandBuilder } from 'discord.js'

export const data = new SlashCommandBuilder()
  .setName('forget')
  .setDescription('forget everything that happened before this command')

export async function execute(interaction: ChatInputCommandInteraction) {
  interaction.reply({ content: ':brain: :hammer: - done!' })
}

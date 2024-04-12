import type { ChatInputCommandInteraction } from 'discord.js'
import { SlashCommandBuilder } from 'discord.js'
import { Player } from '../../voiceHandler'
import { assertVC } from './join'

export const data = new SlashCommandBuilder()
  .setName('skip')
  .setDescription('skip the current song')

export async function execute(interaction: ChatInputCommandInteraction) {
  const player = await assertVC(interaction)
  if (!(player instanceof Player))
    return
  player.skip()
  interaction.reply({ content: 'skipped' })
}

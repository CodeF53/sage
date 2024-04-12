import type { ChatInputCommandInteraction } from 'discord.js'
import { SlashCommandBuilder } from 'discord.js'
import { Player } from '../../voiceHandler'
import { assertVC } from './join'

export const data = new SlashCommandBuilder()
  .setName('clear')
  .setDescription('clear queue')

export async function execute(interaction: ChatInputCommandInteraction) {
  const player = await assertVC(interaction)
  if (!(player instanceof Player))
    return
  interaction.reply({ content: `cleared queue of ${player.queue.length} songs` })
  player.clear()
}

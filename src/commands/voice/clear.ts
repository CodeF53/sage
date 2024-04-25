import type { ChatInputCommandInteraction } from 'discord.js'
import { SlashCommandBuilder } from 'discord.js'
import { AudioPlayerStatus } from '@discordjs/voice'
import { Player } from '../../voiceHandler'
import { getVC } from './join'

export const data = new SlashCommandBuilder()
  .setName('clear')
  .setDescription('clear queue')

export async function execute(interaction: ChatInputCommandInteraction) {
  const player = await getVC(interaction)
  if (!(player instanceof Player)) return

  if (player.status() === AudioPlayerStatus.Idle)
    return interaction.reply({ content: 'no items in queue' })

  player.queue = []
  player.player.stop()

  interaction.reply({ content: 'cleared queue' })
}

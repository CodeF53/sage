import type { ChatInputCommandInteraction } from 'discord.js'
import { SlashCommandBuilder } from 'discord.js'
import { AudioPlayerStatus } from '@discordjs/voice'
import { Player } from '../../voiceHandler'
import { getVC } from './join'

export const data = new SlashCommandBuilder()
  .setName('clear')
  .setDescription('clear queue')
  .setDMPermission(false)

export async function execute(interaction: ChatInputCommandInteraction) {
  const player = await getVC(interaction)
  if (!(player instanceof Player)) return

  if (player.status() === AudioPlayerStatus.Idle)
    return interaction.reply({ content: 'no items in queue' })

  player.activePlayer().stop()
  if (player.ttsPlayer.state.status !== AudioPlayerStatus.Idle) {
    player.ttsQueue = []
    return interaction.reply({ content: 'cleared tts queue' })
  }

  player.queue = []
  return interaction.reply({ content: 'cleared music queue' })
}

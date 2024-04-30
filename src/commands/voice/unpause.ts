import type { ChatInputCommandInteraction } from 'discord.js'
import { SlashCommandBuilder } from 'discord.js'
import { AudioPlayerStatus } from '@discordjs/voice'
import { Player } from '../../voiceHandler'
import { getVC } from './join'

export const data = new SlashCommandBuilder()
  .setName('unpause')
  .setDescription('unpause paused audio')
  .setDMPermission(false)

export async function execute(interaction: ChatInputCommandInteraction) {
  const player = await getVC(interaction)
  if (!(player instanceof Player)) return

  if (player.status() !== AudioPlayerStatus.Paused)
    return interaction.reply({ content: 'not paused' })

  player.clearDisconnectTimeout()
  player.activePlayer().unpause()
  interaction.reply({ content: 'unpaused' })
}

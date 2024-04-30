import type { ChatInputCommandInteraction } from 'discord.js'
import { SlashCommandBuilder } from 'discord.js'
import { AudioPlayerStatus } from '@discordjs/voice'
import { Player } from '../../voiceHandler'
import { getVC } from './join'

export const data = new SlashCommandBuilder()
  .setName('pause')
  .setDescription('pause the current audio')
  .setDMPermission(false)

export async function execute(interaction: ChatInputCommandInteraction) {
  const player = await getVC(interaction)
  if (!(player instanceof Player)) return

  if (player.status() !== AudioPlayerStatus.Playing)
    return interaction.reply({ content: 'not playing audio' })

  player.createDisconnectTimeout()
  player.activePlayer().pause()
  interaction.reply({ content: 'paused' })
}

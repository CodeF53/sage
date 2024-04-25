import { Readable } from 'node:stream'
import type { ChatInputCommandInteraction } from 'discord.js'
import { SlashCommandBuilder } from 'discord.js'
import { AudioPlayerStatus, createAudioResource } from '@discordjs/voice'
import { tts } from 'edge-tts'
import mp3Duration from 'mp3-duration'
import { Player } from '../../voiceHandler'
import { getVC } from './join'

export const data = new SlashCommandBuilder()
  .setName('tts')
  .setDescription('start yappin')
  .addStringOption(option =>
    option.setName('text')
      .setDescription('words')
      .setMaxLength(1_000)
      .setRequired(true))

export async function execute(interaction: ChatInputCommandInteraction) {
  const player = await getVC(interaction, true)
  if (!(player instanceof Player)) return

  // validate url
  const text = interaction.options.getString('text')!

  // ensure bot won't leave while generating tts
  player.clearDisconnectTimeout()

  // get audio to yap
  const audio = await tts(text)
  const resource = createAudioResource(Readable.from(audio))
  resource.playbackDuration = (await mp3Duration(audio)) * 1_000

  // queue audio
  player.player.pause()
  player.ttsQueue.push(resource)
  if (player.ttsPlayer.state.status === AudioPlayerStatus.Idle)
    player.ttsPlay()

  return interaction.reply({ content: `yapping ${text}` })
}

import { Readable } from 'node:stream'
import type { ChatInputCommandInteraction } from 'discord.js'
import { SlashCommandBuilder } from 'discord.js'
import { AudioPlayerStatus, createAudioResource } from '@discordjs/voice'
import { tts } from 'edge-tts'
import decodeAudio from 'audio-decode'
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

  // validate yap
  const text = interaction.options.getString('text')!
  // queue yap
  await ttsQueue(player, text)

  return interaction.reply({ content: `yapping ${text}` })
}

export async function ttsQueue(player: Player, text: string) {
  // ensure bot won't leave while generating tts
  player.clearDisconnectTimeout()

  // get audio to yap
  const audio = await tts(text)
  const { duration } = await decodeAudio(audio)
  const resource = createAudioResource(Readable.from(audio))
  resource.playbackDuration = duration * 1_000

  // queue audio
  player.player.pause()
  player.ttsQueue.push(resource)
  if (player.ttsPlayer.state.status === AudioPlayerStatus.Idle)
    player.ttsPlay()

  return new Promise(r => setTimeout(r, duration * 1_000))
}

import type { ChatInputCommandInteraction } from 'discord.js'
import { SlashCommandBuilder } from 'discord.js'
import { AudioPlayerStatus, createAudioResource } from '@discordjs/voice'
import play from 'play-dl'
import ytdl from 'ytdl-core'
import { Player } from '../../voiceHandler'
import { getVC } from './join'

export const data = new SlashCommandBuilder()
  .setName('play')
  .setDescription('play a youtube video')
  .addStringOption(option =>
    option.setName('url')
      .setDescription('youtube url')
      .setMaxLength(255)
      .setRequired(true))

export async function execute(interaction: ChatInputCommandInteraction) {
  const player = await getVC(interaction, true)
  if (!(player instanceof Player)) return

  // validate url
  const url = interaction.options.getString('url')!
  if (!ytdl.validateURL(url))
    return interaction.reply({ content: 'invalid url' })

  // ensure bot won't leave while getting audio
  player.clearDisconnectTimeout()

  // get audio to stream
  const stream = await play.stream(url)
  const resource = createAudioResource(stream.stream, { inputType: stream.type })

  // add metadata
  const { videoDetails } = await ytdl.getBasicInfo(url)
  resource.playbackDuration = Number(videoDetails.lengthSeconds) * 1_000
  resource.metadata = videoDetails as any

  // queue audio
  player.queue.push(resource)
  if (player.status() === AudioPlayerStatus.Idle)
    player.play()

  interaction.reply({ content: `queued ${videoDetails.title}` })
}

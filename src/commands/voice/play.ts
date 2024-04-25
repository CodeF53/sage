import type { ChatInputCommandInteraction } from 'discord.js'
import { SlashCommandBuilder } from 'discord.js'
import { createAudioResource } from '@discordjs/voice'
import play from 'play-dl'
import ytdl from 'ytdl-core'
import { Player } from '../../voiceHandler'
import { assertVC } from './join'

export const data = new SlashCommandBuilder()
  .setName('play')
  .setDescription('play a youtube video')
  .addStringOption(option =>
    option.setName('url')
      .setDescription('youtube url')
      .setMaxLength(255)
      .setRequired(true))

export async function execute(interaction: ChatInputCommandInteraction) {
  const player = await assertVC(interaction)
  if (!(player instanceof Player))
    return

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
  player.add(resource)
  interaction.reply({ content: `queued ${videoDetails.title}` })
}

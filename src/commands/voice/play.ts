import type { ChatInputCommandInteraction } from 'discord.js'
import { SlashCommandBuilder } from 'discord.js'
import { createAudioResource } from '@discordjs/voice'
import play from 'play-dl'
import ytdl from 'ytdl-core'
import { joinVC, voiceChannels } from './join'

export const data = new SlashCommandBuilder()
  .setName('play')
  .setDescription('play a youtube video')
  .addStringOption(option =>
    option.setName('url')
      .setDescription('youtube url')
      .setMaxLength(69)
      .setRequired(true))

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guildId)
    return interaction.reply({ content: 'not in a server', ephemeral: true })
  let channel = voiceChannels[interaction.guildId]
  if (!channel) {
    const r = await joinVC(interaction)
    if (typeof r !== 'boolean')
      return
    channel = voiceChannels[interaction.guildId]
  }
  const url = interaction.options.getString('url')!

  if (!ytdl.validateURL(url))
    return interaction.reply({ content: 'invalid url' })

  const { videoDetails } = await ytdl.getBasicInfo(url)
  const stream = await play.stream(url)
  const resource = createAudioResource(stream.stream, { inputType: stream.type })
  resource.playbackDuration = Number(videoDetails.lengthSeconds) * 1_000
  resource.metadata = videoDetails as any
  channel.add(resource)

  interaction.reply({ content: `queued ${videoDetails.title}` })
}

import type { ChatInputCommandInteraction } from 'discord.js'
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, SlashCommandBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js'
import play from 'play-dl'
import { AudioPlayerStatus, createAudioResource } from '@discordjs/voice'
import { Player } from '../../voiceHandler'
import { getVC } from './join'

export const data = new SlashCommandBuilder()
  .setName('play')
  .setDescription('play a youtube video')
  .addStringOption(option =>
    option.setName('query')
      .setDescription('song name or Youtube/SoundCloud url')
      .setMaxLength(255)
      .setRequired(true))
  .setDMPermission(false)

export async function execute(interaction: ChatInputCommandInteraction) {
  const player = await getVC(interaction, true)
  if (!(player instanceof Player)) return

  player.clearDisconnectTimeout()

  const replyPromise = interaction.deferReply({ ephemeral: true })
  const query = interaction.options.getString('query')!
  const search = await play.search(query, { limit: 10, source: { youtube: 'video' } })

  const options = []
  for (let i = 0; i < search.length; i++) {
    const result = search[i]
    options.push(new StringSelectMenuOptionBuilder()
      .setLabel(`${result.channel}: ${result.title}`.slice(0, 100))
      .setDescription((result.description || 'no description found').slice(0, 100))
      .setValue(i.toString()))
  }
  const optionsDropdown = new StringSelectMenuBuilder().setCustomId('song').addOptions(...options)
  const row = new ActionRowBuilder().addComponents(optionsDropdown)

  const reply = await replyPromise
  const response = await reply.edit({ components: [row] })

  const collector = response.createMessageComponentCollector({ componentType: ComponentType.StringSelect, time: 60_000 })
  collector.on('collect', async (resp) => {
    const songIndex = Number(resp.values[0])
    if (songIndex >= search.length) throw new Error('queue selection is out of range')
    const songMeta = search[songIndex]

    reply.edit({ content: `Getting audio for ${songMeta.title}`, components: [] })

    const stream = await play.stream(songMeta.url)
    const resource = createAudioResource(stream.stream, { inputType: stream.type })
    resource.playbackDuration = Number(songMeta.durationInSec) * 1_000
    resource.metadata = songMeta as any

    player.queue.push(resource)
    if (player.status() === AudioPlayerStatus.Idle) player.play()
    else reply.edit({ content: `Queued ${songMeta.title} (${songMeta.durationRaw})` })
    return interaction.deleteReply()
  })
  collector.on('end', () => interaction.deleteReply())
}

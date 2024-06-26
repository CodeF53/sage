import type { ChatInputCommandInteraction } from 'discord.js'
import { ActionRowBuilder, ComponentType, SlashCommandBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js'
import type { YouTubeVideo } from 'play-dl'
import play from 'play-dl'
import { AudioPlayerStatus, createAudioResource } from '@discordjs/voice'
import { Player } from '../../voiceHandler'
import { getVC } from './join'

export const data = new SlashCommandBuilder()
  .setName('play')
  .setDescription('play a youtube video')
  .addStringOption(option =>
    option.setName('query')
      .setDescription('Song\'s name or Youtube url')
      .setMaxLength(255)
      .setRequired(true))
  .setDMPermission(false)

export async function execute(interaction: ChatInputCommandInteraction) {
  const player = await getVC(interaction, true)
  if (!(player instanceof Player)) return

  const replyPromise = interaction.deferReply({ ephemeral: true })
  const yeetTimeout = setTimeout(() => { interaction.deleteReply() }, 60_000)

  player.createDisconnectTimeout()
  const query = interaction.options.getString('query')!
  let search: YouTubeVideo[] = []
  if (query.startsWith('https://youtu'))
    search.push((await play.video_basic_info(query)).video_details)
  else
    search.push(...await play.search(query, { limit: 5, source: { youtube: 'video' } }))
  search = search.filter(hasNeededData)

  if (search.length === 0)
    return interaction.editReply({ content: `Could not find song for ${query}` })
  if (search.length === 1)
    return playSong(search[0], player, interaction, yeetTimeout)

  // give user options to pick from if more than one search result
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
  interaction.editReply({ components: [row] })

  const reply = await replyPromise
  const collector = reply.createMessageComponentCollector({ componentType: ComponentType.StringSelect, time: 60_000 })
  collector.once('collect', async (resp) => { playSong(search[Number(resp.values[0])], player, interaction, yeetTimeout) })
}

async function playSong(song: YouTubeVideo, player: Player, interaction: ChatInputCommandInteraction, yeetTimeout: Timer) {
  interaction.editReply({ content: `Getting audio for ${song.title}`, components: [] })

  player.clearDisconnectTimeout()
  const stream = await play.stream(song.url)
  const resource = createAudioResource(stream.stream, { inputType: stream.type })
  resource.playbackDuration = song.durationInSec * 1_000
  resource.metadata = song as any

  clearTimeout(yeetTimeout)
  player.queue.push(resource)
  if (player.status() === AudioPlayerStatus.Idle) {
    player.play()
    interaction.deleteReply()
  }
  else {
    player.updateEmbed()
    interaction.editReply({ content: `Queued ${song.title} (${song.durationRaw})` })
    setTimeout(() => { interaction.deleteReply() }, 5_000)
  }
}

function hasNeededData(song: YouTubeVideo): boolean {
  for (const key of ['durationInSec', 'title', 'channel', 'thumbnails'] as (keyof YouTubeVideo)[])
    if (!song[key]) return false
  if (!song.thumbnails[0])
    return false
  return true
}

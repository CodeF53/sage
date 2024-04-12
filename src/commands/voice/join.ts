import type { ChatInputCommandInteraction, TextBasedChannel, VoiceBasedChannel } from 'discord.js'
import { SlashCommandBuilder } from 'discord.js'
import type { AudioResource, VoiceConnection } from '@discordjs/voice'
import { VoiceConnectionStatus, createAudioPlayer, joinVoiceChannel } from '@discordjs/voice'

export const data = new SlashCommandBuilder()
  .setName('join')
  .setDescription('join your current voice channel')

export function execute(interaction: ChatInputCommandInteraction) {
  return joinVC(interaction, true)
}

interface QueueFuncs {
  add: (audio: AudioResource) => void
  clear: () => void
  skip: () => void
}
export const voiceChannels: { [key: string]: { vc: VoiceConnection } & QueueFuncs } = {}

function createDisconnectTimer(vc: VoiceConnection, guildId: string) {
  let timeoutId: Timer | null = null
  return (extraTime = 0) => {
    if (timeoutId)
      clearTimeout(timeoutId)
    timeoutId = setTimeout(() => {
      if (!voiceChannels[guildId])
        return
      vc.destroy()
      delete voiceChannels[guildId]
    }, 5_000 + extraTime)
  }
}

function createPlayerQueue(vc: VoiceConnection, channel: TextBasedChannel, resetDisconnectTimer: ReturnType<typeof createDisconnectTimer>): QueueFuncs {
  const player = createAudioPlayer()
  vc.subscribe(player)
  const queue: AudioResource[] = []
  let playing = false
  let queueTimeout: Timer | null = null

  function play() {
    const audio = queue.shift()
    if (!audio) {
      playing = false
      return
    }
    playing = true
    player.play(audio)
    channel.send({ content: `Now playing ${audio.metadata.title} (${audio.metadata.lengthSeconds} seconds)` })
    resetDisconnectTimer(audio.playbackDuration + 500)
    queueTimeout = setTimeout(play, audio.playbackDuration)
  }
  function add(audio: AudioResource) {
    queue.push(audio)
    if (!playing)
      play()
  }
  function clear() {
    queue.splice(0, queue.length)
    player.stop()
    playing = false
    if (queueTimeout)
      clearTimeout(queueTimeout)
  }
  function skip() {
    player.stop()
    playing = false
    if (queueTimeout)
      clearTimeout(queueTimeout)
    play()
  }
  return { add, clear, skip }
}

export async function joinVC(interaction: ChatInputCommandInteraction, explicit = false) {
  if (!interaction.member || !interaction.guild)
    return interaction.reply({ content: 'not in a server', ephemeral: true })

  // get vc user is in
  let channel: VoiceBasedChannel | null
  if (interaction.inCachedGuild())
    channel = interaction.member.voice.channel
  else
    channel = (await interaction.guild.members.fetch({ user: interaction.user.id })).voice.channel
  if (!channel)
    return interaction.reply({ content: 'you aren\'t in a voice channel', ephemeral: true })

  const channelId = channel.id
  const guildId = channel.guild.id

  if (voiceChannels[guildId])
    return interaction.reply({ content: 'already in that vc', ephemeral: true })

  // join
  const vc = await joinVoiceChannel({ channelId, guildId, adapterCreator: channel.guild.voiceAdapterCreator })
  if (!vc)
    return interaction.reply({ content: 'failed to join', ephemeral: true })

  // only reply if explicitly entered /join
  if (explicit)
    interaction.reply({ content: 'in!', ephemeral: true })

  // start auto disconnect timer
  const resetDisconnectTimer = createDisconnectTimer(vc, guildId)
  resetDisconnectTimer()

  // create audio queue
  voiceChannels[guildId] = { vc, ...createPlayerQueue(vc, interaction.channel, resetDisconnectTimer) }

  // clear cache when kicked
  vc.on(VoiceConnectionStatus.Disconnected, () => delete voiceChannels[guildId])

  return true
}

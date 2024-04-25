import type { AudioResource, VoiceConnection } from '@discordjs/voice'
import { AudioPlayerStatus, VoiceConnectionStatus, createAudioPlayer } from '@discordjs/voice'
import type { TextBasedChannel } from 'discord.js'
import type { MoreVideoDetails } from 'ytdl-core'

const IDLE_TIMEOUT = 300_000
export class Player {
  static voiceChannels: Record<string, Player> = {}
  static getPlayer(guildId: string): Player | undefined {
    return Player.voiceChannels[guildId]
  }

  player = createAudioPlayer()
  queue: AudioResource[] = []
  ttsPlayer = createAudioPlayer()
  ttsQueue: AudioResource[] = []

  constructor(public vc: VoiceConnection, public channel: TextBasedChannel, public guildId: string, public vcId: string) {
    vc.subscribe(this.player)
    vc.on(VoiceConnectionStatus.Disconnected, () => this.delete())

    // play next song when player goes idle
    this.player.on('stateChange', (_, { status }) => {
      if (status === AudioPlayerStatus.Idle) this.play()
    })
    this.ttsPlayer.on('stateChange', (_, { status }) => {
      if (status === AudioPlayerStatus.Idle) this.ttsPlay()
    })

    Player.voiceChannels[guildId] = this
  }

  play() {
    const audio = this.queue.shift()
    if (!audio) return this.createDisconnectTimeout()

    this.player.play(audio)
    const metadata = audio.metadata as MoreVideoDetails
    this.channel.send({ content: `Now playing ${metadata.title} (${metadata.lengthSeconds} seconds)` })
  }

  ttsPlay() {
    const audio = this.ttsQueue.shift()
    if (!audio) {
      this.vc.subscribe(this.player)
      if (this.activePlayer().state.status === AudioPlayerStatus.Paused)
        return this.player.unpause()
      return this.play()
    }

    this.player.pause()
    this.vc.subscribe(this.ttsPlayer)
    this.ttsPlayer.play(audio)
  }

  activePlayer() {
    if (this.ttsPlayer.state.status !== AudioPlayerStatus.Idle)
      return this.ttsPlayer
    return this.player
  }

  status() { return this.activePlayer().state.status }

  private disconnectTimeout: Timer = this.createDisconnectTimeout()
  createDisconnectTimeout() {
    this.clearDisconnectTimeout()
    this.disconnectTimeout = setTimeout(() => {
      this.channel.send({ content: 'inactive for 5 minutes, leaving vc' })
      this.delete()
    }, IDLE_TIMEOUT)
    return this.disconnectTimeout
  }

  clearDisconnectTimeout() {
    clearTimeout(this.disconnectTimeout)
  }

  delete() {
    this.clearDisconnectTimeout()
    this.vc.destroy()
    if (Player.voiceChannels[this.guildId])
      delete Player.voiceChannels[this.guildId]
  }
}

import type { AudioResource, VoiceConnection } from '@discordjs/voice'
import { VoiceConnectionStatus, createAudioPlayer } from '@discordjs/voice'
import type { TextBasedChannel } from 'discord.js'
import type { MoreVideoDetails } from 'ytdl-core'

export class Player {
  static voiceChannels: Record<string, Player> = {}
  static getPlayer(guildId: string): Player | undefined {
    return Player.voiceChannels[guildId]
  }

  player = createAudioPlayer()
  queue: AudioResource[] = []
  queueTimeout: Timer | null = null
  playing: boolean = false

  constructor(public vc: VoiceConnection, public channel: TextBasedChannel, public guildId: string, public vcId: string) {
    this.resetDisconnectTimer()
    vc.subscribe(this.player)
    vc.on(VoiceConnectionStatus.Disconnected, this.delete)

    Player.voiceChannels[guildId] = this
  }

  play() {
    const audio = this.queue.shift()
    if (!audio) {
      this.playing = false
      return
    }
    this.playing = true
    this.player.play(audio)
    const metadata = audio.metadata as MoreVideoDetails
    this.channel.send({ content: `Now playing ${metadata.title} (${metadata.lengthSeconds} seconds)` })
    this.resetDisconnectTimer(audio.playbackDuration)
    this.queueTimeout = setTimeout(this.play, audio.playbackDuration)
  }

  add(audio: AudioResource) {
    this.queue.push(audio)
    if (!this.playing)
      this.play()
  }

  clear() {
    this.queue.splice(0, this.queue.length)
    this.skip()
  }

  skip() {
    this.player.stop()
    this.playing = false
    this.resetDisconnectTimer()
    if (this.queueTimeout)
      clearTimeout(this.queueTimeout)
    this.play()
  }

  private disconnectTimeout: Timer | null = null
  resetDisconnectTimer(extraTime = 0) {
    if (this.disconnectTimeout)
      clearTimeout(this.disconnectTimeout)
    this.disconnectTimeout = setTimeout(() => {
      this.channel.send({ content: 'inactive for 5 minutes, leaving vc' })
      this.delete()
    }, 300_000 + extraTime)
  }

  delete() {
    this.vc.destroy()
    if (Player.voiceChannels[this.guildId])
      delete Player.voiceChannels[this.guildId]
  }
}

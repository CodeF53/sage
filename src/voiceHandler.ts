import type { AudioResource, VoiceConnection } from '@discordjs/voice'
import { AudioPlayerStatus, VoiceConnectionStatus, createAudioPlayer } from '@discordjs/voice'
import { EmbedBuilder, type Message, type TextBasedChannel } from 'discord.js'
import type { YouTubeVideo } from 'play-dl'
import { ttsQueue } from './commands/voice/tts'

const IDLE_TIMEOUT = 300_000
const LEAVE_MESSAGES = ['y\'all boring as fuck, I\'m out', 'I am gonna go crank my hog', 'brb gotta go beat my wife', 'I gotta shid']
export class Player {
  static voiceChannels: Record<string, Player> = {}
  static getPlayer(guildId: string): Player | undefined {
    return Player.voiceChannels[guildId]
  }

  player = createAudioPlayer()
  nowPlaying: YouTubeVideo | undefined
  queue: AudioResource[] = []
  ttsPlayer = createAudioPlayer()
  ttsQueue: AudioResource[] = []
  musicStatusMessage: Message | undefined

  constructor(public vc: VoiceConnection, public channel: TextBasedChannel, public guildId: string, public vcId: string) {
    vc.subscribe(this.player)
    vc.on(VoiceConnectionStatus.Disconnected, () => this.delete())

    // play next song when player goes idle
    this.player.on('stateChange', (_, { status }) => {
      this.updateEmbed()
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
    this.nowPlaying = audio.metadata as YouTubeVideo
    this.updateEmbed()
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
    if ((audio.metadata as any).sendInChat)
      this.channel.send({ content: `yappin: ${(audio.metadata as any).text}` })
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
    this.disconnectTimeout = setTimeout(async () => {
      const leaveMessage = LEAVE_MESSAGES[Math.floor(Math.random() * LEAVE_MESSAGES.length)]
      await ttsQueue(this, leaveMessage)

      this.channel.send({ content: leaveMessage })
      this.delete()
    }, IDLE_TIMEOUT)
    return this.disconnectTimeout
  }

  clearDisconnectTimeout() {
    clearTimeout(this.disconnectTimeout)
  }

  delete() {
    if (this.musicStatusMessage)
      this.musicStatusMessage.delete()
    this.clearDisconnectTimeout()
    this.vc.destroy()
    if (Player.voiceChannels[this.guildId])
      delete Player.voiceChannels[this.guildId]
  }

  async updateEmbed() {
    if (this.musicStatusMessage && this.player.state.status !== AudioPlayerStatus.Playing) {
      this.nowPlaying = undefined
      this.musicStatusMessage.delete()
      this.musicStatusMessage = undefined
    }
    const song = this.nowPlaying
    if (!song) return

    const embed = new EmbedBuilder()
      .setColor(0xFF9900)
      .setTitle(song.title!.toString())
      .setThumbnail(song.thumbnails[0].url)
    if (song.channel) embed.setAuthor({ name: song.channel.name!, iconURL: song.channel.icons![0].url })
    if (song.description) embed.setDescription(song.description)

    // TODO: add progressbar
    // TODO: add skip button
    // TODO: add queue preview

    this.musicStatusMessage = await this.channel.send({ embeds: [embed] })
  }
}

export function exitAllVCs() {
  for (const player of Object.values(Player.voiceChannels))
    player.delete()
}

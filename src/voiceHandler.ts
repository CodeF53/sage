import type { AudioResource, VoiceConnection } from '@discordjs/voice'
import { AudioPlayerStatus, VoiceConnectionStatus, createAudioPlayer } from '@discordjs/voice'
import { EmbedBuilder, type Message, type TextBasedChannel } from 'discord.js'
import type { YouTubeVideo } from 'play-dl'
import { ttsQueue } from './commands/voice/tts'
import { debounce, formatTime } from './util'

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
  musicStatusMessage: Promise<Message> | undefined

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

  updateEmbed = debounce(async () => {
    if (this.player.state.status === AudioPlayerStatus.Idle)
      this.nowPlaying = undefined
    if (this.musicStatusMessage) {
      const message = await this.musicStatusMessage
      if (this.channel.lastMessageId !== message.id) {
        this.musicStatusMessage = undefined
        await message.delete()
      }
    }
    const song = this.nowPlaying
    if (!song) {
      (await this.musicStatusMessage)?.delete()
      this.musicStatusMessage = undefined
      return
    }

    const embed = new EmbedBuilder()
      .setColor(0xFF9900)
      .setTitle(`${song.title!.toString()}`)
      .setThumbnail(song.thumbnails[0].url)
      .setAuthor({ name: song.channel!.name!, iconURL: song.channel!.iconURL() })

    const description = []
    // progressbar
    const playDuration = Number(this.player._state.playbackDuration) / 1000
    if (this.player._state.playbackDuration) {
      const percent = playDuration / song.durationInSec
      const leftLen = Math.floor(40 * percent)
      const rightLen = Math.ceil(40 * (1 - percent))
      const progressTime = `${formatTime(Math.round(playDuration))} / ${song.durationRaw}`
      const progressBar = `${'━'.repeat(leftLen)}●${'─'.repeat(rightLen)}`
      description.push(`\`(${progressTime}) ${progressBar}\``)
    }

    // queue
    if (this.queue.length > 0) {
      const queue = this.queue.map(a => a.metadata as YouTubeVideo)
      const queueList = queue.map((meta, i) => {
        const { title, durationRaw } = meta
        return `${i + 1}. ${title} (${durationRaw})`
      }).join('\n')
      const lengthSeconds = queue.reduce((a, c) => a + c.durationInSec, 0)
      description.push(`**Queue** (${formatTime(lengthSeconds)}):\n${queueList}`)
    }

    // TODO: add [pause/unpause, skip, back/forward 30 seconds] buttons

    if (description.length > 0)
      embed.setDescription(description.join('\n\n'))
    if (!this.musicStatusMessage)
      return this.musicStatusMessage = this.channel.send({ embeds: [embed] })
    const message = await this.musicStatusMessage
    message.edit({ embeds: [embed] })
  }, 250)

  private updateInterval = setInterval(() => {
    this.updateEmbed()
  }, 5000)

  async delete() {
    this.clearDisconnectTimeout()
    clearInterval(this.updateInterval)
    try {
      if (this.musicStatusMessage)
        await (await this.musicStatusMessage).delete()
      this.musicStatusMessage = undefined
    }
    catch {}
    this.vc.destroy()
    if (Player.voiceChannels[this.guildId])
      delete Player.voiceChannels[this.guildId]
  }
}

export async function exitAllVCs() {
  await Promise.all(Object.values(Player.voiceChannels).map(player => player.delete()))
}

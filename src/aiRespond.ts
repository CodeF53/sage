import type { Message, TextChannel } from 'discord.js'
import { ChannelType, MessageType } from 'discord.js'
import { client } from './start'
import { generate } from './ollama'
import { Player } from './voiceHandler'
import { ttsQueue } from './commands/voice/tts'
import { getMessageContext, replySplitMessage } from './util'
import { getConfig } from './dynamicConfig'
import { formatMessage } from './formatMessage'

export async function handleMessage(message: Message) {
  // ephemeral messages sometimes trigger this and we don't really care
  try { await message.fetch() }
  catch { return }

  // prevent talking where disabled
  if (message.guild && !getConfig(message.guild.id).llm)
    return

  // ignore dumb messages
  if (!message.author.id || message.author.id === client!.user!.id
    || typeof message.content !== 'string' || message.content.length === 0
    || ![MessageType.Reply, MessageType.Default].includes(message.type))
    return

  return aiRespond(message)
}

// convert channel mentions and pings to proper <@280411966126948353> syntax
function formatResponse(response: string, message: Message) {
  return response
    .replace(/@([\w\-]{3,})/g, (_, username) => {
      if (!username)
        return '@unknown'
      if (username === message.author.username)
        return `<@${message.author.id}>`
      if (message.guild) {
        const member = message.guild.members.cache.find(({ user }) => user.username === username)
        if (!member)
          return username
        return `<@${member.user.id}>`
      }
    })
    .replace(/#([\w\-]+)/g, (_, channelName: string) => {
      if ([ChannelType.DM, ChannelType.GroupDM].includes(message.channel.type))
        return `#${channelName}`
      if (channelName === (message.channel as TextChannel).name || !message.guild)
        return `<#${message.channelId}>`
      const channel = message.guild.channels.cache.find(a => a.name === channelName)
      if (!channel)
        return `#${channelName}`
      return `<#${channel.id}>`
    })
}

export async function aiRespond(message: Message) {
  let typingInterval: Timer | null = null

  try {
    const myMention = new RegExp(`<@${client.user!.id}>`, 'g')

    // only reply to:
    // - dms
    let shouldReply = !message.guild
    // - replies to my messages
    if (message.type === MessageType.Reply) {
      const reply = await message.fetchReference()
      if (reply.author.id === client.user!.id)
        shouldReply = true
    }
    // - pings
    if (message.content.match(myMention))
      shouldReply = true
    // - randomly when I am in a server that allows that
    if (message.guild && getConfig(message.guild.id).randomMessages && Math.random() < 0.01)
      shouldReply = true
    if (!shouldReply)
      return

    // get members/channels so we can fill those in later
    if (message.guild) {
      await message.guild.channels.fetch()
      await message.guild.members.fetch()
    }

    // start typing
    message.channel.sendTyping()
    typingInterval = setInterval(async () => {
      try { await message.channel.sendTyping() }
      catch (error) {
        if (typingInterval)
          clearInterval(typingInterval)
        typingInterval = null
      }
    }, 7000)

    // develop chat context (up to 15 messages from the last 15 minutes)
    const messages = (await getMessageContext(message, 15, 15)).map(formatMessage)
    messages.unshift({ role: 'system', content: `discord chat in ${message.guild ? `#${(message.channel as TextChannel).name}` : 'DMs'}` })

    // generate response
    const { response } = (await generate(messages, client.user!.username))

    // stop typing
    if (typingInterval)
      clearInterval(typingInterval)
    typingInterval = null

    // reply
    if (response.length !== 0)
      replySplitMessage(message, formatResponse(response, message))

    // auto tts if in vc with user
    const guild = message.guild
    if (!guild) return
    const userVC = (await guild.members.fetch({ user: message.author.id })).voice.channel
    if (!userVC) return
    const existingPlayer = Player.getPlayer(guild.id)
    if (!existingPlayer || userVC.id !== existingPlayer.vcId) return
    ttsQueue(existingPlayer, response)
  }
  catch (error) {
    if (typingInterval)
      message.reply({ content: 'Error, please tell <@280411966126948353> to check the console' })
    console.error(error)
  }
  finally {
    if (typingInterval) clearInterval(typingInterval)
  }
}

import { ChannelType, type Message } from 'discord.js'
import { MessageType } from 'discord.js'
import { client } from './start'
import type { LLMMessage } from './ollama'
import { generate } from './ollama'
import { Player } from './voiceHandler'
import { ttsQueue } from './commands/voice/tts'
import { getMessageContext, replySplitMessage } from './util'
import { guildDB } from './dynamicConfig'

export async function handleMessage(message: Message) {
  // ephemeral messages sometimes trigger this and we don't really care
  try { await message.fetch() }
  catch { return }

  // prevent talking where disabled
  if (message.guild && !guildDB.getKey(message.guild.id).llm)
    return

  // ignore dumb messages
  if (!message.author.id || message.author.id === client!.user!.id
    || typeof message.content !== 'string' || message.content.length === 0
    || ![MessageType.Reply, MessageType.Default].includes(message.type))
    return

  return aiRespond(message)
}

function formatMessage(message: Message): LLMMessage {
  const text = message.content
    // replace #channel mentions with strings (normally its like <#1082142594567516160>)
    .replace(/<#([0-9]+)>/g, (_, id) => {
      if (message.guild) {
        const chn = message.guild.channels.cache.get(id)
        if (chn)
          return `#${chn.name}`
      }
      return '#unknown-channel'
    })
    // replace @user mentions with strings (normally its like <@280411966126948353>)
    .replace(/<@!?([0-9]+)>/g, (_, id) => {
      if (id === message.author.id)
        return message.author.username
      if (message.guild) {
        const mem = message.guild.members.cache.get(id)
        if (mem)
          return `@${mem.user.username}`
      }
      return '@unknown-user'
    })
    // replace emoji with strings (you get it)
    .replace(/<:([a-zA-Z0-9_]+):([0-9]+)>/g, (_, name) => { return `emoji:${name}:` })
    .trim()
  const content = `@${message.author.username}:${text}`

  let role = 'user'
  if (message.author.id === client.user!.id)
    role = 'assistant'

  return { role, content }
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
      if (channelName === message.channel.name || !message.guild)
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
    if (message.guild && guildDB.getKey(message.guild.id).randomMessages && Math.random() < 0.01)
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
    messages.unshift({ role: 'system', content: `discord chat in ${message.guild ? `#${message.channel.name}` : 'DMs'}` })

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
    const guild = message.guild!
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

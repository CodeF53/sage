import type { Message } from 'discord.js'
import { ChannelType, MessageType } from 'discord.js'
import { client } from './bot'
import { logError, replySplitMessage } from './misc'
import type { LLMMessage } from './ollama'
import { generate } from './ollama'

const randomMessageGuilds = process.env.RANDOM_MESSAGE_GUILDS!.split(',')

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
    if (randomMessageGuilds.includes(message.guild!.id) && Math.random() < 0.01)
      shouldReply = true
    if (!shouldReply)
      return

    // get members/channels so we can fill those in later
    if (message.guild) {
      await message.guild.channels.fetch()
      await message.guild.members.fetch()
    }
    // develop chat context
    const messages = [message, ...(await message.channel.messages.fetch({ limit: 4, before: message.id })).values()]
      .reverse().map(formatMessage)!
    messages.unshift({ role: 'system', content: `discord chat in ${message.guild ? `#${message.channel.name}` : 'DMs'}` })

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

    // generate response
    const { response } = (await generate(messages, client.user!.username))

    // stop typing
    if (typingInterval)
      clearInterval(typingInterval)
    typingInterval = null

    // reply
    if (response.length !== 0)
      replySplitMessage(message, formatResponse(response, message))
  }
  catch (error) {
    if (typingInterval) {
      clearInterval(typingInterval)
      typingInterval = null
      try { message.reply({ content: 'Error, please tell <@280411966126948353> to check the console' }) }
      catch {}
    }
    logError(error)
  }
}

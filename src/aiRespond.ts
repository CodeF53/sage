import type { Message } from 'discord.js'
import { ChannelType, MessageType } from 'discord.js'
import { client } from './bot'
import { logError, replySplitMessage } from './misc'
import { generate } from './ollama'

const randomMessageGuilds = process.env.RANDOM_MESSAGE_GUILDS!.split(',')

function messageToStr(message: Message) {
  const cleanedContent = message.content
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

  return `@${message.author.username}:${cleanedContent}`
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

export const messages = {}

export async function aiRespond(message: Message, channelID: string) {
  let typing = false

  try {
    // get context for replies
    let context = null
    if (message.type === MessageType.Reply) {
      const reply = await message.fetchReference()
      if (!reply)
        return
      if (reply.author.id !== client.user!.id)
        return
      if (!messages[channelID])
        return
      context = messages[channelID][reply.id]
      if (!context)
        return
    }

    const botRole = message.guild?.members?.me?.roles?.botRole
    const myMention = new RegExp(`<@((!?${client.user!.id}${botRole ? `)|(&${botRole.id}` : ''}))>`, 'g')

    // only reply to:
    // - replies & dms
    let shouldReply = message.type === MessageType.Reply || !message.guild
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
    const chatMessages = [message, ...(await message.channel.messages.fetch({ limit: 4, before: message.id })).values()]
      .reverse().map(messageToStr).join('</s>\n')
    const channelName = message.guild ? `#${message.channel.name}` : 'DMs'
    const chat = `discord chat in ${channelName}\n\n${chatMessages}</s>\n@${client.user!.username}:`
    console.debug(chat)

    // create conversation
    if (messages[channelID] == null)
      messages[channelID] = { amount: 0, last: null }

    // start typing
    typing = true
    await message.channel.sendTyping()
    let typingInterval: Timer | null = setInterval(async () => {
      try { await message.channel.sendTyping() }
      catch (error) {
        if (typingInterval != null)
          clearInterval(typingInterval)
        typingInterval = null
      }
    }, 7000)

    let response
    try {
      // context if the message is not a reply
      if (context == null)
        context = messages[channelID].last

      // make request to model
      response = (await generate(`${chat}`, context))
    }
    catch (error) {
      if (typingInterval != null)
        clearInterval(typingInterval)

      typingInterval = null
      throw error
    }

    if (typingInterval != null)
      clearInterval(typingInterval)

    typingInterval = null

    let responseText = response.response
    if (response.length === 0)
      responseText = '(No response)'
    console.debug(`${responseText}`)

    // convert channel mentions and pings to proper <@280411966126948353> syntax
    responseText = formatResponse(responseText, message)

    // reply (will automatically stop typing)
    const replyMessageIDs = (await replySplitMessage(message, responseText)).map((msg: Message) => msg.id)

    // add response to conversation
    context = response.context
    for (let i = 0; i < replyMessageIDs.length; ++i)
      messages[channelID][replyMessageIDs[i]] = context

    messages[channelID].last = context
    ++messages[channelID].amount
  }
  catch (error) {
    if (typing) {
      try { message.reply({ content: 'Error, please tell <@280411966126948353> to check the console' }) }
      catch {}
    }
    logError(error)
  }
}

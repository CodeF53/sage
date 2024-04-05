import type { Message } from 'discord.js'
import { MessageType } from 'discord.js'
import { client, messages } from './bot'
import { getBoolean, logError, replySplitMessage } from './misc'
import { generate } from './ollama'

const randomMessageGuilds = process.env.RANDOM_MESSAGE_GUILDS!.split(',')
const requiresMention = getBoolean(process.env.REQUIRES_MENTION!)

function cleanUserInput(message: Message) {
  return message.content
    .replace(/<#([0-9]+)>/g, (_, id) => {
      if (message.guild) {
        const chn = message.guild.channels.cache.get(id)
        if (chn)
          return `#${chn.name}`
      }
      return '#unknown-channel'
    })
    .replace(/<@!?([0-9]+)>/g, (_, id) => {
      if (id == message.author.id)
        return message.author.username
      if (message.guild) {
        const mem = message.guild.members.cache.get(id)
        if (mem)
          return `@${mem.user.username}`
      }
      return '@unknown-user'
    })
    .replace(/<:([a-zA-Z0-9_]+):([0-9]+)>/g, (_, name) => {
      return `emoji:${name}:`
    })
    .trim()
}

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
    const myMention = new RegExp(`<@((!?${client.user!.id}${botRole ? `)|(&${botRole.id}` : ''}))>`, 'g') // RegExp to match a mention for the bot

    // only reply to message when:
    // - dms/replies
    // - messages where I am pinged
    // - randomly when I am in a server that allows that
    if (message.type === MessageType.Default && (requiresMention && message.guild && !message.content.match(myMention))
      && !(randomMessageGuilds.includes(message.guild.id) && Math.random() < 0.05))
      return

    if (message.guild) {
      await message.guild.channels.fetch()
      await message.guild.members.fetch()
    }

    const userInput = cleanUserInput(message)
    if (userInput.length === 0)
      return

    // create conversation
    if (messages[channelID] == null)
      messages[channelID] = { amount: 0, last: null }

    // log user's message
    console.debug(`${message.guild ? `#${message.channel.name}` : 'DMs'} - ${message.author.username}: ${userInput}`)

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
      response = (await generate(userInput, context))
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
    console.debug(`Response: ${responseText}`)

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
      try { await message.reply({ content: 'Error, please tell @f53 to check the console' }) }
      catch {}
    }
    logError(error)
  }
}

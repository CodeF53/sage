import type { Message } from 'discord.js'
import { client } from './start'
import type { LLMMessage } from './ollama'

export function formatMessage(message: Message): LLMMessage {
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

  let role: 'user' | 'assistant' = 'user'
  if (message.author.id === client.user!.id)
    role = 'assistant'

  return { role, content }
}

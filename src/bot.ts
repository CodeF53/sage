import { Client, Events, GatewayIntentBits, MessageType, Partials } from 'discord.js'
import { handleDotCommand } from './dotCommands'
import { aiRespond } from './aiRespond'
import { logError } from './misc'

export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
  ],
  allowedMentions: { users: [], roles: [], repliedUser: false },
  partials: [
    Partials.Channel,
  ],
})

client.once(Events.ClientReady, async () => {
  await client.guilds.fetch()
  client.user.setPresence({ activities: [], status: 'online' })
})

export const messages = {}

client.on(Events.MessageCreate, async (message) => {
  try {
    await message.fetch()
    const channelID = message.channel.id
    // ignore dumb messages
    if (!message.author.id || message.author.id === client.user.id
      || typeof message.content !== 'string' || message.content.length === 0
      || ![MessageType.Reply, MessageType.Default].includes(message.type))
      return

    // handle dot commands
    if (message.content.startsWith('.'))
      return handleDotCommand(message, channelID)

    return aiRespond(message, channelID)
  }
  catch (error) { logError(error) }
})

client.login(process.env.TOKEN)

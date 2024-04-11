import './commands/deployCommands' // register commands with discord
import { Client, Events, GatewayIntentBits, MessageType, Partials } from 'discord.js'
import { aiRespond } from './aiRespond'
import { logError } from './misc'
import { initCommands } from './commands/commandHandler'

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

initCommands(client)

client.once(Events.ClientReady, async () => {
  await client.guilds.fetch()
  client.user!.setPresence({ activities: [], status: 'online' })
})

client.on(Events.MessageCreate, async (message) => {
  try {
    await message.fetch()
    // ignore dumb messages
    if (!message.author.id || message.author.id === client!.user!.id
      || typeof message.content !== 'string' || message.content.length === 0
      || ![MessageType.Reply, MessageType.Default].includes(message.type))
      return

    return aiRespond(message)
  }
  catch (error) { logError(error) }
})

client.login(process.env.TOKEN)

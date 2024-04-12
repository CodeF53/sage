import 'dotenv/config' // ! - nodejs compat
import './commands/deployCommands' // register commands with discord
import { Client, Events, GatewayIntentBits, MessageType, Partials } from 'discord.js'
import setupCommands from './setupCommands'
import { aiRespond } from './aiRespond'
import { logError } from './misc'
import { Player } from './voiceHandler'

export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
  allowedMentions: { users: [], roles: [], repliedUser: false },
  partials: [
    Partials.Channel,
  ],
})

setupCommands(client)

client.once(Events.ClientReady, async () => {
  await client.guilds.fetch()
  client.user!.setPresence({ activities: [], status: 'online' })
})

client.on(Events.MessageCreate, async (message) => {
  // ephemeral messages sometimes trigger this and we don't really care
  try { await message.fetch() }
  catch { }

  try {
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

// leave vc before dying
function leaveAllVCsThenExit() {
  for (const player of Object.values(Player.voiceChannels))
    player.delete()
  setTimeout(() => process.exit(0), 0)
}
process.on('exit', leaveAllVCsThenExit)
process.on('SIGTERM', leaveAllVCsThenExit)
process.on('SIGINT', leaveAllVCsThenExit)

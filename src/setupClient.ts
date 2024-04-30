import { Client, Events, GatewayIntentBits, Partials } from 'discord.js'

const client = new Client({
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

export function getClient(): Promise<Client<true>> {
  client.login(process.env.TOKEN)

  return new Promise(res => {
    client.once(Events.ClientReady, async (readyClient) => {
      await client.guilds.fetch()
      client.user!.setPresence({ activities: [], status: 'online' })
      res(readyClient);
    })
  })
}

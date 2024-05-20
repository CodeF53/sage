import flatCache from 'flat-cache'
import { type Client, Events } from 'discord.js'

export const guildDB: flatCache.Cache = flatCache.load(`${process.env.BOT_NAME}guildDB`)

export const configKeys = ['vc', 'generate', 'llm', 'randomMessages']
type ConfigKey = typeof configKeys[number]
const defaultConfig: Record<ConfigKey, boolean> = {
  vc: true,
  generate: true,
  llm: true,
  randomMessages: false,
}
export type GuildConfig = Record<ConfigKey, boolean>

export function getConfig(guildId: string) {
  const config = { ...defaultConfig, ...guildDB.getKey(guildId) }
  return Object.fromEntries(configKeys.map(key => [key, config[key]]))
}

export function initDB(client: Client<true>) {
  // ensure guilds we're in have a config
  const guildIDs = client.guilds.cache.map(guild => guild.id)

  // yeet config for guilds we're no longer in
  for (const guildId of guildDB.keys())
    if (!guildIDs.includes(guildId)) guildDB.removeKey(guildId)
  client.addListener(Events.GuildDelete, guild => guildDB.removeKey(guild.id))
}

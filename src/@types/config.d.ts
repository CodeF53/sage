import type { GuildConfig } from '../dynamicConfig'

/* eslint-disable ts/method-signature-style */
export { load, createFromFile, create, clearCacheById, clearAll } from 'flat-cache'
declare module 'flat-cache' {
  export interface Cache {
    setKey(guildId: str, guildConfig: GuildConfig): void
    getKey(guildId: str): GuildConfig
  }
}

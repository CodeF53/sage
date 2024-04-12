import type { Collection } from 'discord.js'

// https://stackoverflow.com/a/69534031
declare module 'discord.js' {
  export interface Client {
    commands: Collection<any, any>
  }
}

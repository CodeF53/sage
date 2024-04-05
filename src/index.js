import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Events, ShardingManager } from 'discord.js'
import { LogLevel, Logger } from 'meklog'

const production = process.env.NODE_ENV === 'prod' || process.env.NODE_ENV === 'production'
const log = new Logger(production, 'Shard Manager')

log(LogLevel.Info, 'Loading')

const filePath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'bot.js')
const manager = new ShardingManager(filePath, { token: process.env.TOKEN })

manager.on('shardCreate', async (shard) => {
  const shardLog = new Logger(production, `Shard #${shard.id}`)

  shardLog(LogLevel.Info, 'Created shard')

  shard.once(Events.ClientReady, async () => {
    shard.send({ shardID: shard.id, logger: shardLog.data })

    shardLog(LogLevel.Info, 'Shard ready')
  })
})

manager.spawn()

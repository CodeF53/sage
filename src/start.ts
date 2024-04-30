import './config.ts'
import { Events } from 'discord.js'
import setupCommands from './setupCommands'
import { getClient } from './setupClient'
import { exitAllVCs } from './voiceHandler'
import { handleMessage } from './aiRespond'
import { guildDB, initDB } from './dynamicConfig.ts'

export const client = await getClient()
initDB(client)
client.on(Events.MessageCreate, handleMessage)
setupCommands(client)

// ignore most errors
process.on('uncaughtException', console.error)
// handle closing
async function handleExit() {
  exitAllVCs()
  await client.destroy()
  guildDB.save()
  setTimeout(() => process.exit(0), 0)
}
process.on('exit', handleExit)
process.on('SIGTERM', handleExit)
process.on('SIGINT', handleExit)

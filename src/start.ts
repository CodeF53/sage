import './config.ts'
import { Events } from 'discord.js'
import setupCommands from './setupCommands'
import { getClient } from './setupClient'
import { exitAllVCs } from './voiceHandler'
import { handleMessage } from './aiRespond'

// ! Temp until /config (enable/disable) [feature]
export const DUMB_GUILDS = process.env.DUMB_GUILDS!.split(',')

export const client = await getClient()
client.on(Events.MessageCreate, handleMessage)
setupCommands(client)

// ignore most errors
process.on('uncaughtException', console.error)
// handle closing
async function handleExit() {
  exitAllVCs()
  await client.destroy()
  setTimeout(() => process.exit(0), 0)
}
process.on('exit', handleExit)
process.on('SIGTERM', handleExit)
process.on('SIGINT', handleExit)

import { type Message, MessageType } from 'discord.js'
import { messages } from './bot'

// TODO: migrate to slash commands in the future
export async function handleDotCommand(message: Message, userInput: string, channelID) {
  if (message.type === MessageType.Reply)
    return

  const args = userInput.substring(1).split(/\s+/g)
  const cmd = args.shift()
  switch (cmd) {
    case 'reset':
    case 'clear': return clearHistory(message, channelID)

    case 'ping': return ping(message)

    case 'help':
    case '?':
    case 'h': return await message.reply({ content: 'Commands:\n- `.reset` `.clear`\n- `.help` `.?` `.h`\n- `.ping`' })

    default:
  }
}

async function clearHistory(message: Message, channelID) {
  if (!messages[channelID])
    return await message.reply({ content: 'No messages to clear' })

  const cleared = messages[channelID].amount
  delete messages[channelID]
  if (cleared > 0)
    await message.reply({ content: `Cleared conversation of ${cleared} messages` })
}

async function ping(message: Message) {
  const beforeTime = Date.now()
  const reply = await message.reply({ content: 'Ping' })
  const afterTime = Date.now()
  const difference = afterTime - beforeTime
  await reply.edit({ content: `Ping: ${difference}ms` })
}

import type { ChatInputCommandInteraction } from 'discord.js'
import { SlashCommandBuilder } from 'discord.js'
import { messages } from '../../aiRespond'

export const data = new SlashCommandBuilder()
  .setName('clear')
  .setDescription('Make Sage forget what happened in this channel')

export async function execute(interaction: ChatInputCommandInteraction) {
  const channelID = interaction.channel!.id

  if (!messages[channelID])
    return interaction.reply({ content: 'No messages to clear' })

  const cleared = messages[channelID].amount
  delete messages[channelID]
  if (cleared > 0)
    return interaction.reply({ content: `Cleared conversation of ${cleared} messages` })
  interaction.reply({ content: 'No messages to clear' })
}

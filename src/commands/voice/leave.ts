import type { ChatInputCommandInteraction } from 'discord.js'
import { SlashCommandBuilder } from 'discord.js'
import { voiceChannels } from './join'

export const data = new SlashCommandBuilder()
  .setName('leave')
  .setDescription('leave the current voice channel')

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guildId)
    return interaction.reply({ content: 'not in a server', ephemeral: true  })
  const channel = voiceChannels[interaction.guildId]
  if (!channel)
    return interaction.reply({ content: 'I\'m not in a vc', ephemeral: true  })

  channel.vc.destroy()
  delete voiceChannels[interaction.guildId]
  interaction.reply({ content: 'bye', ephemeral: true  })
}

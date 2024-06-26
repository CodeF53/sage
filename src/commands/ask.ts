import type { ChatInputCommandInteraction } from 'discord.js'
import { SlashCommandBuilder } from 'discord.js'
import { generate } from '../ollama'

export const data = new SlashCommandBuilder()
  .setName('ask')
  .setDescription('ask a dumb llm')
  .addStringOption(option =>
    option.setName('prompt')
      .setDescription('what you want')
      .setMaxLength(5_000)
      .setRequired(true))
export const globalCommand = true

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply()
  const text = interaction.options.getString('prompt', true)

  const { response } = await generate([ { content: text, role: 'user' } ], interaction.user.username)
  interaction.editReply({ content: `${response}\n<:blobcatcozy:1026533070955872337> [USERBOT TEST DON'T TAKE SERIOUSLY]` })
}

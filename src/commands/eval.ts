import type { ChatInputCommandInteraction } from 'discord.js'
import { SlashCommandBuilder } from 'discord.js'

export const data = new SlashCommandBuilder()
  .setName('eval')
  .setDescription('eval')
  .addStringOption(option => option
    .setName('js')
    .setDescription('js to run')
    .setRequired(true))

export async function execute(interaction: ChatInputCommandInteraction) {
  if (interaction.user.id !== '280411966126948353')
    return interaction.reply({ content: 'no', ephemeral: true })

  console.log('eval called!', interaction.options.getString('js', true))
  await interaction.deferReply({ ephemeral: true })

  const js = interaction.options.getString('js', true)
  let out = eval(`(async () => ${js})()`)
  if (!out)
    return interaction.editReply({ content: 'no response' })
  if (out.constructor.name === 'Promise')
    out = await out
  if (typeof out === 'string')
    return interaction.editReply({ content: `${out}` })
  if (typeof out === 'function')
    return interaction.editReply({ content: `\`\`\`js\n${out}\n\`\`\`` })

  try {
    const json = JSON.stringify(out, null, '  ').slice(0, 1900)
    interaction.editReply({ content: `\`\`\`json\n${json}\n\`\`\`` })
  } catch (error) {
    interaction.editReply({ content: `\`${out}\`` })
  }
}

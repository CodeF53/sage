import type { ChatInputCommandInteraction } from 'discord.js'
import { SlashCommandBuilder } from 'discord.js'

const sdURL = process.env.SD_URL!
const defaultPrompt = process.env.SD_PROMPT!

export const data = new SlashCommandBuilder()
  .setName('generate')
  .setDescription('Make beautiful art')
  .addStringOption(option =>
    option.setName('prompt')
      .setDescription('what you want')
      .setMaxLength(5_000)
      .setRequired(true))
  .addStringOption(option =>
    option.setName('negative_prompt')
      .setDescription('what you don\'t want')
      .setMaxLength(5_000))

export async function execute(interaction: ChatInputCommandInteraction) {
  const prompt = interaction.options.getString('prompt')!
  const negative_prompt = interaction.options.getString('negative prompt') ?? ''

  const reply = interaction.reply({ content: 'generating...' })

  const resp = await fetch(`${sdURL}/sdapi/v1/txt2img`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: `${defaultPrompt}, ${prompt}`,
      negative_prompt,
      steps: 8,
      cfg_scale: 3,
      width: 1024,
      height: 1024,
      sampler_index: 'Euler A SGMUniform',
      send_images: true,
      save_images: false,
    }),
  })
  const { images } = await resp.json();

  (await reply).edit({ content: prompt, files: [{ attachment: new Buffer.from(images[0], 'base64') }] })
}

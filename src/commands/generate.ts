import { Buffer } from 'node:buffer'
import type { ChatInputCommandInteraction } from 'discord.js'
import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js'
import { guildDB } from '../dynamicConfig'

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
  .addNumberOption(option =>
    option.setName('width')
      .setDescription('width of image to generate (default 1024)')
      .setMinValue(512)
      .setMaxValue(2048))
  .addNumberOption(option =>
    option.setName('height')
      .setDescription('height of image to generate (default 1024)')
      .setMinValue(512)
      .setMaxValue(2048))
  .addNumberOption(option =>
    option.setName('quantity')
      .setDescription('number of images to generate')
      .setMinValue(1)
      .setMaxValue(4))
  .addNumberOption(option =>
    option.setName('seed')
      .setDescription('seed for RNG')
      .setMinValue(1)
      .setMaxValue(Number.MAX_SAFE_INTEGER))

function formatImages(images: string[]) {
  const out = []
  for (const image of images)
    out.push({ attachment: Buffer.from(image, 'base64') })
  return out
}

export async function execute(interaction: ChatInputCommandInteraction) {
  if (interaction.guild && !guildDB.getKey(interaction.guild.id).generate) {
    const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)
    return interaction.reply({ content: `image generation is disabled in this server, try ${isAdmin ? '`/config set generate true`' : 'contacting an admin'}`, ephemeral: true })
  }

  const prompt = interaction.options.getString('prompt')!
  let negative_prompt = interaction.options.getString('negative_prompt') ?? ''

  // prevent generating nsfw unless explicitly requested
  if (!/\bnsfw\b/i.test(prompt))
    negative_prompt = `nsfw, nude, fully nude, partial nudity, explicit, ${negative_prompt}`

  const replyPromise = interaction.reply({ content: 'generating...' })

  const resp = await fetch(`${sdURL}/sdapi/v1/txt2img`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: `${defaultPrompt}, ${prompt}`,
      negative_prompt: `${negative_prompt}, loli, child, young`,
      steps: 8,
      cfg_scale: 3,
      seed: interaction.options.getNumber('seed') ?? -1,
      width: interaction.options.getNumber('width') ?? 1024,
      height: interaction.options.getNumber('height') ?? 1024,
      batch_size: interaction.options.getNumber('quantity') ?? 1,
      sampler_index: 'Euler A SGMUniform',
      send_images: true,
      save_images: false,
    }),
  })
  const data: any = await resp.json()
  const { images } = data
  const info = JSON.parse(data.info)

  let content = `\`${prompt}\`\nseed(s): [${info.all_seeds}]`
  if ((interaction.options.getString('negative_prompt') ?? '').length > 0)
    content += `\n\nnegative: \`${negative_prompt}\``

  const reply = await replyPromise
  reply.edit({ content, files: formatImages(images) })
}

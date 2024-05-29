import { Buffer } from 'node:buffer'
import type { ChatInputCommandInteraction, InteractionResponse, Message } from 'discord.js'
import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js'
import { getConfig } from '../dynamicConfig'

const SD_URL = process.env.SD_URL!
const SD_PROMPT = process.env.SD_PROMPT!
const SD_BLACKLIST = process.env.SD_BLACKLIST!
const SD_BADLIST = process.env.SD_BADLIST!.split(',')
const SD_CONFIG = JSON.parse(process.env.SD_CONFIG!) as { sampler_index: string, steps: number, cfg_scale: number, width: number, height: number }

export const data = new SlashCommandBuilder()
  .setName('generate')
  .setNSFW(true)
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
export const globalCommand = true

function formatImages(images: string[], shouldSpoiler: boolean) {
  const out: { attachment: Buffer; name: string }[] = []
  images.forEach((image, i) => {
    out.push({ attachment: Buffer.from(image, 'base64'), name: `${shouldSpoiler ? 'SPOILER_' : ''}${i}.png` })
  })
  return out
}

export async function execute(interaction: ChatInputCommandInteraction) {
  const isGuild = !!interaction.guild
  if (isGuild && getConfig(interaction.guild.id).generate) {
    const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)
    return interaction.reply({ content: `image generation is disabled in this server, try ${isAdmin ? '`/config set generate true`' : 'contacting an admin'}`, ephemeral: true })
  }
  let userPrompt = interaction.options.getString('prompt', true)!.toLowerCase()
  const userNegativePrompt = interaction.options.getString('negative_prompt') ?? ''

  // prevent horrible stuff from ever being generated
  for (const tag of SD_BADLIST)
    userPrompt = userPrompt.replaceAll(tag, '')

  // join prompts with all additives
  const promptArr = [SD_PROMPT, userPrompt]
  const negativePromptArr = [SD_BLACKLIST, userNegativePrompt]
  const prompt = promptArr.join(',')
  const negativePrompt = negativePromptArr.join(',')

  const replyPromise = interaction.deferReply()
  const resp = await generate(prompt, negativePrompt, interaction.options)
  const reply: InteractionResponse | Message<false> = await replyPromise
  if (!resp) return reply.edit({ content: 'Generation error, server may be down' })
  const { images, info } = resp

  let content = `\`${userPrompt}\`\nseed(s): [${info.all_seeds}]`
  if ((interaction.options.getString('negative_prompt') ?? '').length > 0)
    content += `\n\nnegative: \`${userNegativePrompt}\``

  // spoiler nsfw generations in dms
  let shouldSpoiler = false
  if (!isGuild && (prompt.includes('nsfw') || prompt.includes('explicit')))
    shouldSpoiler = true

  reply.edit({ content, files: formatImages(images, shouldSpoiler) })
}

async function generate(prompt: string, negative_prompt: string, options: ChatInputCommandInteraction['options']): Promise<false | { images: string[], info: any }> {
  try {
    const resp = await fetch(`${SD_URL}/sdapi/v1/txt2img`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...SD_CONFIG,
        width: options.getNumber('width') ?? SD_CONFIG.width,
        height: options.getNumber('height') ?? SD_CONFIG.height,
        seed: options.getNumber('seed') ?? -1,
        batch_size: options.getNumber('quantity') ?? 1,
        prompt,
        negative_prompt,
        send_images: true,
        save_images: false,
      }),
    })
    const data: any = await resp.json()
    const images = data.images as string[]
    const info = JSON.parse(data.info)
    return { images, info }
  }
  catch (error) {
    console.error(error)
    return false
  }
}

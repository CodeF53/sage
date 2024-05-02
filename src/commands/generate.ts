import { Buffer } from 'node:buffer'
import type { ChatInputCommandInteraction, CommandInteraction, Interaction, InteractionResponse, Message } from 'discord.js'
import { ChannelType, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js'
import nsfwjs from 'nsfwjs'
import * as tf from '@tensorflow/tfjs-node'
import { type GuildConfig, getConfig } from '../dynamicConfig'

const SD_URL = process.env.SD_URL!
const SD_PROMPT = process.env.SD_PROMPT!
const SD_BLACKLIST = process.env.SD_BLACKLIST!
const SD_NSFW_TOLERANCE = Number(process.env.SD_NSFW_TOLERANCE!)
const SD_NSFW_TAGS = process.env.SD_NSFW_TAGS!.split(',')
const SD_SFW_TAGS = process.env.SD_SFW_TAGS!.split(',')
const SD_BADLIST = process.env.SD_BADLIST!.split(',')
const SD_CONFIG = JSON.parse(process.env.SD_CONFIG!) as { sampler_index: string, steps: number, cfg_scale: number, width: number, height: number }

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
  const guildConfig = interaction.guild && getConfig(interaction.guild.id) as GuildConfig
  if (interaction.guild && !guildConfig!.generate) {
    const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)
    return interaction.reply({ content: `image generation is disabled in this server, try ${isAdmin ? '`/config set generate true`' : 'contacting an admin'}`, ephemeral: true })
  }
  let userPrompt = interaction.options.getString('prompt', true)!.toLowerCase()
  const userNegativePrompt = interaction.options.getString('negative_prompt') ?? ''

  // prevent NSFW where it isn't wanted
  const isDM = interaction.channel?.type === ChannelType.DM
  const generateNSFW = isDM || (guildConfig!.generateNSFW && interaction.channel && !interaction.channel.isThread() && interaction.channel.nsfw)
  if (!generateNSFW) {
    let nsfwWarn = 'NSFW isn\'t allowed here, try DMing me'
    if (guildConfig!.generateNSFW) nsfwWarn += ' or using an NSFW channel'
    for (const tag of SD_NSFW_TAGS)
      if (userPrompt.includes(tag)) return interaction.reply({ content: nsfwWarn, ephemeral: true })
    for (const tag of SD_SFW_TAGS)
      if (userNegativePrompt.includes(tag)) return interaction.reply({ content: nsfwWarn, ephemeral: true })
  }
  // prevent horrible stuff from ever being generated
  for (const tag of SD_BADLIST)
    userPrompt = userPrompt.replaceAll(tag, '')

  // join prompts with all additives
  const promptArr = [SD_PROMPT, userPrompt]
  const negativePromptArr = [SD_BLACKLIST, userNegativePrompt]
  if (!generateNSFW) {
    promptArr.push(...SD_SFW_TAGS)
    negativePromptArr.push(...SD_NSFW_TAGS)
  }
  const prompt = promptArr.join(',')
  const negativePrompt = negativePromptArr.join(',')

  const replyPromise = interaction.deferReply()
  const resp = await generate(prompt, negativePrompt, interaction.options)
  let reply: InteractionResponse | Message<false> = await replyPromise
  if (!resp) return reply.edit({ content: 'Generation error, server may be down' })
  const { images, info } = resp

  // DM user response we somehow manged to generate NSFW in SFW context
  if (!generateNSFW) {
    reply.edit({ content: 'ensuring content safety...' })
    if (await checkNSFW(images)) {
      reply.edit({ content: 'I can\'t send that here, check your dms' })
        .then(() => setTimeout(() => interaction.deleteReply(), 3000))
      const dmReply = await interaction.user.send({ content: 'loading' })
      if (dmReply) reply = dmReply
    }
  }

  let content = `\`${userPrompt}\`\nseed(s): [${info.all_seeds}]`
  if ((interaction.options.getString('negative_prompt') ?? '').length > 0)
    content += `\n\nnegative: \`${userNegativePrompt}\``
  reply.edit({ content, files: formatImages(images) })
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

tf.enableProdMode()
const nsfwClassifier = await nsfwjs.load('MobileNetV2')
// true if classifier is confident its porn/hentai
async function checkNSFW(images: string[]): Promise<boolean> {
  for (const image of images) {
    const tensors = tf.node.decodeImage(Buffer.from(image, 'base64'))
    const classification = await nsfwClassifier.classify(tensors)
    for (const category of classification) {
      const { className, probability } = category
      if (!['Hentai', 'Porn'].includes(className))
        continue
      if (probability > SD_NSFW_TOLERANCE)
        return true
    }
  }
  return false
}

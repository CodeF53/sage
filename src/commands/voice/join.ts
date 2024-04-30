import type { ChatInputCommandInteraction, InteractionResponse, VoiceBasedChannel } from 'discord.js'
import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js'
import { joinVoiceChannel } from '@discordjs/voice'
import { Player } from '../../voiceHandler'
import { getConfig } from '../../dynamicConfig'

export const data = new SlashCommandBuilder()
  .setName('join')
  .setDescription('join your current voice channel')
  .setDMPermission(false)

export async function execute(interaction: ChatInputCommandInteraction) {
  const player = await getVC(interaction, true)
  if (!(player instanceof Player)) return

  interaction.reply({ content: 'in!', ephemeral: true })
}

// given interaction gets a Player or replies about issues regarding getting one
// setting assert to true will make it attempt to join VC if not in one
export async function getVC(interaction: ChatInputCommandInteraction, assert = false): Promise<Player | InteractionResponse> {
  if (!interaction.guild)
    return interaction.reply({ content: 'not in a server', ephemeral: true })
  const guild = interaction.guild
  if (!getConfig(guild.id).vc) {
    const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)
    return interaction.reply({ content: `VC is disabled in this server, try ${isAdmin ? '`/config set vc true`' : 'contacting an admin'}`, ephemeral: true })
  }

  const existingPlayer = Player.getPlayer(guild.id)

  if (!assert) {
    if (existingPlayer) return existingPlayer
    return interaction.reply({ content: 'not in a VC', ephemeral: true })
  }

  // get user's channel
  const voiceChannel: VoiceBasedChannel | null = (await guild.members.fetch({ user: interaction.user.id })).voice.channel
  if (!voiceChannel) { // handle user not being in a VC
    if (existingPlayer) return existingPlayer
    return interaction.reply({ content: 'you aren\'t in a voice channel', ephemeral: true })
  }

  // give player if bot is already in vc with user
  if (existingPlayer?.vcId === voiceChannel.id)
    return existingPlayer
  // delete existing player so we can move it to the user's current channel
  if (existingPlayer)
    existingPlayer.delete()

  // join
  const vc = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: guild.id,
    adapterCreator: guild.voiceAdapterCreator,
  })
  if (!vc)
    return interaction.reply({ content: 'failed to join', ephemeral: true })
  return new Player(vc, interaction.channel!, guild.id, voiceChannel.id)
}

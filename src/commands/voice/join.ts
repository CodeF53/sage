import type { ChatInputCommandInteraction, InteractionResponse, VoiceBasedChannel } from 'discord.js'
import { SlashCommandBuilder } from 'discord.js'
import { joinVoiceChannel } from '@discordjs/voice'
import { Player } from '../../voiceHandler'

export const data = new SlashCommandBuilder()
  .setName('join')
  .setDescription('join your current voice channel')

export async function execute(interaction: ChatInputCommandInteraction) {
  const player = await assertVC(interaction)
  if (player instanceof Player)
    interaction.reply({ content: 'in!', ephemeral: true })
}

export async function assertVC(interaction: ChatInputCommandInteraction): Promise<Player | InteractionResponse> {
  if (!interaction.guild)
    return interaction.reply({ content: 'not in a server', ephemeral: true })
  const guild = interaction.guild

  const existingPlayer = Player.getPlayer(guild.id)
  // get user's channel, give player if user isn't in VC & bot is
  const voiceChannel: VoiceBasedChannel | null = (await guild.members.fetch({ user: interaction.user.id })).voice.channel
  if (!voiceChannel) {
    if (existingPlayer)
      return existingPlayer
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

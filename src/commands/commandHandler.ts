import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url' // ! - nodejs compat
import { type Client, Collection, Events } from 'discord.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url)) // ! - nodejs compat

export async function initCommands(client: Client) {
  // not even gonna pretend to understand this
  // https://discordjs.guide/creating-your-bot/command-handling.html#loading-command-files
  client.commands = new Collection()
  const commandFolders = fs.readdirSync(__dirname)
  for (const folder of commandFolders) {
    if (folder.endsWith('.ts'))
      continue
    if (folder === 'voice' && /\bbun\b/i.test(process.release.sourceUrl!))
      continue
    const commandsPath = path.join(__dirname, folder)
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.ts'))
    for (const file of commandFiles) {
      const filePath = path.join(commandsPath, file)
      const command = await import(filePath)
      if ('data' in command && 'execute' in command)
        client.commands.set(command.data.name, command)
      else
        console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`)
    }
  }

  // https://discordjs.guide/creating-your-bot/command-handling.html#executing-commands
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand())
      return

    const command = interaction.client.commands.get(interaction.commandName)

    if (!command)
      return

    try {
      await command.execute(interaction)
    }
    catch (error) {
      console.error(error)
      if (interaction.replied || interaction.deferred)
        await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true })
      else
        await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true })
    }
  })
}

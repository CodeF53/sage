import path from 'node:path'
import { fileURLToPath } from 'node:url' // ! - nodejs compat
import type { ChatInputCommandInteraction, Client, SlashCommandBuilder } from 'discord.js'
import { Collection, Events, REST, Routes } from 'discord.js'
import readRecursive from 'recursive-readdir'

const __dirname = path.dirname(fileURLToPath(import.meta.url)) // ! - nodejs compat
const commandsDir = path.join(__dirname, 'commands')

interface CommandFile {
  data: SlashCommandBuilder
  execute: (interaction: ChatInputCommandInteraction) => any
  globalCommand?: true
}
function getCommandFiles(): Promise<CommandFile[]> {
  return new Promise((resolve) => {
    readRecursive(commandsDir, [], (error, files) => {
      if (error) throw error
      // bun can't do voice stuff
      if (/\bbun\b/i.test(process.release.sourceUrl!))
        files = files.filter(f => !f.includes('voice'))
      // import files
      resolve(Promise.all(files.map(f => import(f))))
    })
  })
}

// sends discord the commands for autofill service
// https://discordjs.guide/creating-your-bot/command-deployment.html
async function registerCommands(commandFiles: CommandFile[]) {
  const commands = commandFiles.map(c => {
    let data = c.data.toJSON()
    if (c.globalCommand) data = { ...data, integration_types: [0, 1], contexts: [0, 1, 2] }
    return data
  })
  try {
    console.log('Registering Commands...')
    const rest = new REST().setToken(process.env.TOKEN!)
    const registerRoute = Routes.applicationCommands(process.env.APP_ID!)
    await rest.put(registerRoute, { body: commands })
    console.log('\tSuccess!')
  }
  catch (error) {
    console.log('\tFailure')
    console.error(error)
    process.exit(1)
  }
}

// registers command interaction listener that executes commands when run
// https://discordjs.guide/creating-your-bot/command-handling.html#executing-commands
async function registerInteractions(client: Client, commandFiles: CommandFile[]) {
  client.commands = new Collection()
  commandFiles.forEach(command => client.commands.set(command.data.name, command))

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return
    const command = interaction.client.commands.get(interaction.commandName)
    if (!command) return

    try { await command.execute(interaction) }
    catch (error) {
      console.error(error)
      if (interaction.replied || interaction.deferred)
        await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true })
      else
        await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true })
    }
  })
}

export default async function setupCommands(client: Client) {
  const commandFiles = await getCommandFiles()

  await Promise.all([
    registerCommands(commandFiles),
    registerInteractions(client, commandFiles),
  ])
}

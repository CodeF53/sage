// https://discordjs.guide/creating-your-bot/command-deployment.html#command-registration
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url' // ! - nodejs compat
import { REST, Routes } from 'discord.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url)) // ! - nodejs compat
const commands = []
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
      commands.push(command.data.toJSON())
    else
      console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`)
  }
}

// Construct and prepare an instance of the REST module
const rest = new REST().setToken(process.env.TOKEN!);

// and deploy your commands!
(async () => {
  try {
    console.log(`Started refreshing ${commands.length} application (/) commands.`)

    // The put method is used to fully refresh all commands in the guild with the current set
    const data = await rest.put(
      Routes.applicationCommands(process.env.APP_ID!),
      { body: commands },
    )

    console.log(`Successfully reloaded ${data.length} application (/) commands.`)
  }
  catch (error) {
    // And of course, make sure you catch and log any errors!
    console.error(error)
  }
})()

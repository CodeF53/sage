import dotenv from 'dotenv'

const botName = process.argv.at(-1)

dotenv.config({ path: '.env' })
dotenv.config({ path: `./configs/${botName}.env` })
dotenv.config({ path: `./configs/${botName}.private.env` })

// prefix logs with name for debugging
const { log, error } = console
console.log = (...args) => log(botName, ...args)
console.error = (...args) => error(botName, ...args)

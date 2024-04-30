import { readdir } from 'node:fs/promises'
import { $ } from 'bun'

const files = await readdir('./configs')
const botNames = files.filter(v => !v.includes('.private')).map(v => v.split('.')[0])

$.throws(false);
await Promise.all(botNames.map(async (botName) => {
  const { exitCode, stderr } = await $`npx tsx src/start.ts ${botName} 2>&1`
  console.log(`${botName} exited with code`, exitCode)
  if (stderr)
    console.error(stderr)
}))

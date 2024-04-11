import { logError, parseEnvString } from './misc'

const ollamaURL = process.env.OLLAMA_URL!
const temperature = Number(process.env.OLLAMA_TEMP!)
const system = parseEnvString(process.env.SYSTEM!)
const model = process.env.MODEL!

export async function generate(prompt, context) {
  try {
    const resp = await fetch(`${ollamaURL}/api/generate`, {
      method: 'post',
      body: JSON.stringify({
        model,
        prompt,
        context,
        system,
        stream: false,
        options: { temperature }
      }),
      headers: { "Content-Type": "application/json" },
    })
    return await resp.json()
  }
  catch (error) {
    logError(error)
    throw error
  }
}

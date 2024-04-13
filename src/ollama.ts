const ollamaURL = process.env.OLLAMA_URL!
const system = process.env.SYSTEM!
const model = process.env.OLLAMA_MODEL!

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

const sys = `<|im_start|>system \n${system}<|im_end|>`

export async function generate(messages: LLMMessage[], username: string) {
  const context = messages.map(({ role, content }) => `<|im_start|>${role} \n${content}<|im_end|>`).join('\n{{ end }}')
  const ass = `<|im_start|>assistant \n@${username}:`

  const prompt = [sys, context, ass].join('\n{{ end }}')

  const resp = await fetch(`${ollamaURL}/api/generate`, {
    method: 'post',
    body: JSON.stringify({
      model,
      raw: true,
      prompt,
      stream: false,
    }),
    headers: { 'Content-Type': 'application/json' },
  })
  const data = (await resp.json()) as any
  if ((data.response as string).includes('{{ end }}'))
    return generate(messages, username)
  console.log(`${messages.map(m => m.content).join('\n\n')}\n\n@${username}:${data.response}`)
  return data
}

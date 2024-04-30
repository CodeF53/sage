const { LLM_URL, LLM_MODEL, LLM_START_TAG, LLM_END_TAG, LLM_SYSTEM } = process.env as Record<string, string>

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

const sys = `${LLM_START_TAG}system \n${LLM_SYSTEM}${LLM_END_TAG}`

export async function generate(messages: LLMMessage[], username: string) {
  const context = messages.map(({ role, content }) => `${LLM_START_TAG}${role} \n${content}${LLM_END_TAG}`).join('\n{{ end }}')
  const ass = `${LLM_START_TAG}assistant \n@${username}:`

  const prompt = [sys, context, ass].join('\n{{ end }}')

  const resp = await fetch(`${LLM_URL}/api/generate`, {
    method: 'post',
    body: JSON.stringify({
      model: LLM_MODEL,
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

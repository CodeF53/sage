import axios from 'axios'
import { logError } from './misc'

const servers = process.env.OLLAMA!.split(',').map(url => ({ url: new URL(url), available: true }))

if (servers.length === 0)
  throw new Error('No servers available')

export async function makeRequest(path, method, data) {
  while (servers.filter(server => server.available).length === 0) {
    // wait until a server is available
    await new Promise(res => setTimeout(res, 1000))
  }

  let error = null
  const order = Array.from({ length: servers.length }).map((_, i) => i)
  for (const j in order) {
    if (!order.hasOwnProperty!(j))
      continue
    const i = order[j]
    // try one until it succeeds
    try {
      // make a request to ollama
      if (!servers[i].available)
        continue
      const url = new URL(servers[i].url) // don't modify the original URL

      servers[i].available = false

      if (path.startsWith('/'))
        path = path.substring(1)
      if (!url.pathname.endsWith('/'))
        url.pathname += '/' // safety
      url.pathname += path
      console.debug(`Making request to ${url}`)
      const result = await axios({
        method,
        url,
        data,
        responseType: 'text',
      })
      servers[i].available = true
      return result.data
    }
    catch (err) {
      servers[i].available = true
      error = err
      logError(error)
    }
  }
  if (!error)
    throw new Error('No servers available')

  throw error
}

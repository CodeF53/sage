import type { Message } from 'discord.js'

export function logError(error: any) {
  if (error.response) {
    let str = `Error ${error.response.status} ${error.response.statusText}: ${error.request.method} ${error.request.path}`
    if (error.response.data?.error)
      str += `: ${error.response.data.error}`
    error = str
  }
  console.error(error)
}

// split text so it fits in a Discord message
export function splitText(str: string, length: number) {
  // trim matches different characters to \s
  str = str
    .replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    .replace(/^\s+|\s+$/g, '')
  const segments = []
  let segment = ''
  let word, suffix
  function appendSegment() {
    segment = segment.replace(/^\s+|\s+$/g, '')
    if (segment.length > 0) {
      segments.push(segment)
      segment = ''
    }
  }
  // match a word
  while ((word = str.match(/^[^\s]*(?:\s+|$)/)) != null) {
    suffix = ''
    word = word[0]
    if (word.length === 0)
      break
    if (segment.length + word.length > length) {
      // prioritize splitting by newlines over other whitespace
      if (segment.includes('\n')) {
        // append up all but last paragraph
        const beforeParagraph = segment.match(/^.*\n/s)
        if (beforeParagraph != null) {
          const lastParagraph = segment.substring(beforeParagraph[0].length, segment.length)
          segment = beforeParagraph[0]
          appendSegment()
          segment = lastParagraph
          continue
        }
      }
      appendSegment()
      // if word is larger than the split length
      if (word.length > length) {
        word = word.substring(0, length)
        if (length > 1 && word.match(/^[^\s]+$/)) {
          // try to hyphenate word
          word = word.substring(0, word.length - 1)
          suffix = '-'
        }
      }
    }
    str = str.substring(word.length, str.length)
    segment += word + suffix
  }
  appendSegment()
  return segments
}

// reply to message and split it if its too long
export async function replySplitMessage(replyMessage: Message, content) {
  const responseMessages = splitText(content, 2000).map(content => ({ content }))

  const replyMessages: Message[] = []
  for (let i = 0; i < responseMessages.length; ++i) {
    if (i === 0)
      replyMessages.push(await replyMessage.reply(responseMessages[i]))
		 else
      replyMessages.push(await replyMessage.channel.send(responseMessages[i]))
  }
  return replyMessages
}

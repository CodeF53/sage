import { type Message, MessageType } from 'discord.js'

// returns up to `count` messages sent up to `timeWindow` minutes before `message`
export async function getMessageContext(message: Message, count: number, minutes: number): Promise<Message[]> {
  const contextWindowEnd = message.createdAt.getTime() - (minutes * 60 * 1000)
  const context = [message]
  const messageManager = message.channel.messages
  let lastMessage: Message | undefined = message
  while (true) {
    if (context.length >= count)
      break

    lastMessage = (await messageManager.fetch({ before: lastMessage.id, limit: 1 })).first()
    // stop searching once no more messages can be found or outside context window
    if (!lastMessage || lastMessage.createdAt.getTime() < contextWindowEnd)
      break

    // only add actual messages to the context
    if ([MessageType.Default, MessageType.Reply].includes(lastMessage.type))
      context.unshift(lastMessage)
    // stop reading when lobotomized
    else if (MessageType.ChatInputCommand === lastMessage.type && lastMessage.content === ':brain: :hammer: - done!')
      break
  }

  return context
}

// split text so it fits in a Discord message
function splitText(str: string, length: number) {
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
export async function replySplitMessage(replyMessage: Message, content: string) {
  const responseMessages = splitText(content, 2000).map(content => ({ content }))

  const replyMessages: Message[] = []
  replyMessages.push(await replyMessage.reply(responseMessages[0]))
  for (let i = 1; i < responseMessages.length; ++i)
    replyMessages.push(await replyMessage.channel.send(responseMessages[i]))
  return replyMessages
}

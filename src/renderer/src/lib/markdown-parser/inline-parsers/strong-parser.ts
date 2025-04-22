import { MarkdownToken, StrongNode, ParsedNode } from '../types'
import { parseTextToken } from './text-parser'

export function parseStrongToken(
  tokens: MarkdownToken[],
  startIndex: number
): { node: StrongNode; nextIndex: number } {
  const children: ParsedNode[] = []
  let strongText = ''
  let i = startIndex + 1

  // Process tokens between strong_open and strong_close
  while (i < tokens.length && tokens[i].type !== 'strong_close') {
    console.log('tokens[i]', tokens[i])
    if (tokens[i].type === 'text') {
      strongText += tokens[i].content || ''
      children.push(parseTextToken(tokens[i]))
    }
    i++
  }

  const node: StrongNode = {
    type: 'strong',
    children,
    raw: `**${strongText}**`
  }

  // Skip to after strong_close
  const nextIndex = i < tokens.length ? i + 1 : tokens.length

  return { node, nextIndex }
}

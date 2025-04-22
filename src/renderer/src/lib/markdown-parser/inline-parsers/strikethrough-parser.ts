import { MarkdownToken, StrikethroughNode, ParsedNode } from '../types'
import { parseTextToken } from './text-parser'

export function parseStrikethroughToken(
  tokens: MarkdownToken[],
  startIndex: number
): { node: StrikethroughNode; nextIndex: number } {
  const children: ParsedNode[] = []
  let sText = ''
  let i = startIndex + 1

  // Process tokens between s_open and s_close
  while (i < tokens.length && tokens[i].type !== 's_close') {
    if (tokens[i].type === 'text') {
      sText += tokens[i].content || ''
      children.push(parseTextToken(tokens[i]))
    }
    i++
  }

  const node: StrikethroughNode = {
    type: 'strikethrough',
    children,
    raw: `~~${sText}~~`
  }

  // Skip to after s_close
  const nextIndex = i < tokens.length ? i + 1 : tokens.length

  return { node, nextIndex }
}

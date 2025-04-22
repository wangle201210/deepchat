import { MarkdownToken, EmphasisNode, ParsedNode } from '../types'
import { parseTextToken } from './text-parser'

export function parseEmphasisToken(
  tokens: MarkdownToken[],
  startIndex: number
): { node: EmphasisNode; nextIndex: number } {
  const children: ParsedNode[] = []
  let emText = ''
  let i = startIndex + 1

  // Process tokens between em_open and em_close
  while (i < tokens.length && tokens[i].type !== 'em_close') {
    if (tokens[i].type === 'text') {
      emText += tokens[i].content || ''
      children.push(parseTextToken(tokens[i]))
    }
    i++
  }

  const node: EmphasisNode = {
    type: 'emphasis',
    children,
    raw: `*${emText}*`
  }

  // Skip to after em_close
  const nextIndex = i < tokens.length ? i + 1 : tokens.length

  return { node, nextIndex }
}

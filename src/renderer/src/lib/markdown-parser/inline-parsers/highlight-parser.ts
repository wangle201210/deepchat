import { MarkdownToken, HighlightNode, ParsedNode } from '../types'
import { parseTextToken } from './text-parser'

export function parseHighlightToken(
  tokens: MarkdownToken[],
  startIndex: number
): { node: HighlightNode; nextIndex: number } {
  const children: ParsedNode[] = []
  let markText = ''
  let i = startIndex + 1

  // Process tokens between mark_open and mark_close
  while (i < tokens.length && tokens[i].type !== 'mark_close') {
    if (tokens[i].type === 'text') {
      markText += tokens[i].content || ''
      children.push(parseTextToken(tokens[i]))
    }
    i++
  }

  const node: HighlightNode = {
    type: 'highlight',
    children,
    raw: `==${markText}==`
  }

  // Skip to after mark_close
  const nextIndex = i < tokens.length ? i + 1 : tokens.length

  return { node, nextIndex }
}

import { MarkdownToken, InsertNode, ParsedNode } from '../types'
import { parseTextToken } from './text-parser'

export function parseInsertToken(
  tokens: MarkdownToken[],
  startIndex: number
): { node: InsertNode; nextIndex: number } {
  const children: ParsedNode[] = []
  let insText = ''
  let i = startIndex + 1

  // Process tokens between ins_open and ins_close
  while (i < tokens.length && tokens[i].type !== 'ins_close') {
    if (tokens[i].type === 'text') {
      insText += tokens[i].content || ''
      children.push(parseTextToken(tokens[i]))
    }
    i++
  }

  const node: InsertNode = {
    type: 'insert',
    children,
    raw: `++${insText}++`
  }

  // Skip to after ins_close
  const nextIndex = i < tokens.length ? i + 1 : tokens.length

  return { node, nextIndex }
}

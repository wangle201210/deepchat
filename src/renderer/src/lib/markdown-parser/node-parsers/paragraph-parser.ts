import { ParagraphNode, MarkdownToken, ParsedNode } from '../types'
import { parseInlineTokens } from '../inline-parsers'
import { parseMathBlock } from './math-block-parser'

export function parseParagraph(tokens: MarkdownToken[], index: number): ParagraphNode {
  const paragraphContentToken = tokens[index + 1]
  const paragraphContent = paragraphContentToken.content || ''
  const children: ParsedNode[] = []

  // Check if the next token is a math block
  if (paragraphContentToken.type === 'math_block') {
    children.push(parseMathBlock(paragraphContentToken))
  } else {
    children.push(...parseInlineTokens(paragraphContentToken.children || []))
  }

  return {
    type: 'paragraph',
    children,
    raw: paragraphContent
  }
}

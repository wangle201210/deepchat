import { ParsedNode, MarkdownToken } from '../types'
import { parseTextToken } from './text-parser'
import { parseInlineCodeToken } from './inline-code-parser'
import { parseLinkToken } from './link-parser'
import { parseImageToken } from './image-parser'
import { parseStrongToken } from './strong-parser'
import { parseEmphasisToken } from './emphasis-parser'
import { parseStrikethroughToken } from './strikethrough-parser'
import { parseHighlightToken } from './highlight-parser'
import { parseInsertToken } from './insert-parser'
import { parseSubscriptToken } from './subscript-parser'
import { parseSuperscriptToken } from './superscript-parser'
import { parseEmojiToken } from './emoji-parser'
import { parseCheckboxToken } from './checkbox-parser'
import { parseFootnoteRefToken } from './footnote-ref-parser'
import { parseHardbreakToken } from './hardbreak-parser'
import { parseFenceToken } from './fence-parser'
import { parseMathInlineToken } from './math-inline-parser'
import { parseReferenceToken } from './reference-parser'

// Process inline tokens (for text inside paragraphs, headings, etc.)
export function parseInlineTokens(tokens: MarkdownToken[]): ParsedNode[] {
  if (!tokens || tokens.length === 0) return []

  const result: ParsedNode[] = []
  let i = 0

  while (i < tokens.length) {
    const token = tokens[i]

    switch (token.type) {
      case 'text':
        result.push(parseTextToken(token))
        i++
        break

      case 'code_inline':
        result.push(parseInlineCodeToken(token))
        i++
        break

      case 'link_open': {
        const { node, nextIndex } = parseLinkToken(tokens, i)
        result.push(node)
        i = nextIndex
        break
      }

      case 'image':
        result.push(parseImageToken(token))
        i++
        break

      case 'strong_open': {
        const { node, nextIndex } = parseStrongToken(tokens, i)
        result.push(node)
        i = nextIndex
        break
      }

      case 'em_open': {
        const { node, nextIndex } = parseEmphasisToken(tokens, i)
        result.push(node)
        i = nextIndex
        break
      }

      case 's_open': {
        const { node, nextIndex } = parseStrikethroughToken(tokens, i)
        result.push(node)
        i = nextIndex
        break
      }

      case 'mark_open': {
        const { node, nextIndex } = parseHighlightToken(tokens, i)
        result.push(node)
        i = nextIndex
        break
      }

      case 'ins_open': {
        const { node, nextIndex } = parseInsertToken(tokens, i)
        result.push(node)
        i = nextIndex
        break
      }

      case 'sub_open': {
        const { node, nextIndex } = parseSubscriptToken(tokens, i)
        result.push(node)
        i = nextIndex
        break
      }

      case 'sup_open': {
        const { node, nextIndex } = parseSuperscriptToken(tokens, i)
        result.push(node)
        i = nextIndex
        break
      }

      case 'sub':
        result.push({
          type: 'subscript',
          children: [{ type: 'text', content: token.content || '', raw: token.content || '' }],
          raw: `~${token.content || ''}~`
        })
        i++
        break

      case 'sup':
        result.push({
          type: 'superscript',
          children: [{ type: 'text', content: token.content || '', raw: token.content || '' }],
          raw: `^${token.content || ''}^`
        })
        i++
        break

      case 'emoji':
        result.push(parseEmojiToken(token))
        i++
        break

      case 'checkbox':
        result.push(parseCheckboxToken(token))
        i++
        break

      case 'footnote_ref':
        result.push(parseFootnoteRefToken(token))
        i++
        break

      case 'hardbreak':
        result.push(parseHardbreakToken())
        i++
        break

      case 'fence': {
        // Handle fenced code blocks with language specifications
        result.push(parseFenceToken(tokens[i]))
        i++
        break
      }

      case 'math_inline': {
        result.push(parseMathInlineToken(token))
        i++
        break
      }

      case 'reference': {
        result.push(parseReferenceToken(token))
        i++
        break
      }

      default:
        // Skip unknown token types
        i++
        break
    }
  }

  return result
}

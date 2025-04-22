import { MarkdownToken, SuperscriptNode } from '../types'

export function parseSuperscriptToken(token: MarkdownToken): SuperscriptNode {
  return {
    type: 'superscript',
    children: [{ type: 'text', content: token.content || '', raw: token.content || '' }],
    raw: `^${token.content || ''}^`
  }
}

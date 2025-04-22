import { MarkdownToken, SubscriptNode } from '../types'

export function parseSubscriptToken(token: MarkdownToken): SubscriptNode {
  return {
    type: 'subscript',
    children: [{ type: 'text', content: token.content || '', raw: token.content || '' }],
    raw: `~${token.content || ''}~`
  }
}

import { MarkdownToken, LinkNode, ParsedNode } from '../types'
import { parseTextToken } from './text-parser'

export function parseLinkToken(
  tokens: MarkdownToken[],
  startIndex: number
): { node: LinkNode; nextIndex: number } {
  const openToken = tokens[startIndex]
  const href = openToken.attrs?.find((attr) => attr[0] === 'href')?.[1] || ''
  const title = openToken.attrs?.find((attr) => attr[0] === 'title')?.[1] || null

  const children: ParsedNode[] = []
  let linkText = ''
  let i = startIndex + 1

  // Process tokens between link_open and link_close
  while (i < tokens.length && tokens[i].type !== 'link_close') {
    if (tokens[i].type === 'text') {
      linkText += tokens[i].content || ''
      children.push(parseTextToken(tokens[i]))
    }
    i++
  }

  const node: LinkNode = {
    type: 'link',
    href,
    title,
    text: linkText,
    children,
    raw: `[${linkText}](${href}${title ? ` "${title}"` : ''})`
  }

  // Skip to after link_close
  const nextIndex = i < tokens.length ? i + 1 : tokens.length

  return { node, nextIndex }
}

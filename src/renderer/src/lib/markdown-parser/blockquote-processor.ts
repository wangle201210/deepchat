import { MarkdownToken, ParsedNode } from './types'

export function processNestedBlocks(
  tokens: MarkdownToken[],
  startIndex: number
): [ParsedNode | null, number] {
  // This is a simplified version to break circular dependencies
  // It will be replaced by proper list processing in actual implementation
  let i = startIndex
  let depth = 1

  while (i < tokens.length && depth > 0) {
    if (tokens[i].type === 'bullet_list_open' || tokens[i].type === 'ordered_list_open') {
      depth++
    } else if (tokens[i].type === 'bullet_list_close' || tokens[i].type === 'ordered_list_close') {
      depth--
    }
    i++
  }

  return [null, i]
}

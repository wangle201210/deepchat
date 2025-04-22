/* eslint-disable @typescript-eslint/no-explicit-any */
import MarkdownIt from 'markdown-it'
import mathjax3 from 'markdown-it-mathjax3'
import markdownItSub from 'markdown-it-sub'
import markdownItSup from 'markdown-it-sup'
import markdownItMark from 'markdown-it-mark'
import { full as markdownItEmoji } from 'markdown-it-emoji'
import markdownItIns from 'markdown-it-ins'
import markdownItCheckbox from 'markdown-it-task-checkbox'
import markdownItFootnote from 'markdown-it-footnote'
import markdownItContainer from 'markdown-it-container'

// Re-export the node types for backward compatibility
export * from './markdown-parser/types'

// Import the parser functions
import { parseMarkdownToStructure, processTokens, parseInlineTokens } from './markdown-parser'

// Re-export the parser functions
export { parseMarkdownToStructure, processTokens, parseInlineTokens }

export const getMarkdown = (msgId: string) => {
  // import footnote from 'markdown-it-footnote'
  // Create markdown-it instance with configuration
  console.log('getmarkdown', msgId)
  const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
    breaks: false
  })

  // Apply additional plugins
  md.use(markdownItSub) // H~2~O -> subscript
  md.use(markdownItSup) // 2^10 -> superscript
  md.use(markdownItMark) // ==marked== -> highlighted text
  md.use(markdownItEmoji) // :smile: -> emoji
  md.use(markdownItCheckbox) // [ ] and [x] -> checkboxes
  md.use(markdownItIns) // ++inserted++ -> inserted text
  md.use(markdownItFootnote) // 添加脚注支持

  // 添加警告块支持
  const containers = ['note', 'tip', 'warning', 'danger', 'info', 'caution']
  containers.forEach((name) => {
    md.use(markdownItContainer, name)
  })

  // Custom math inline rule
  const mathInline = (state: any, silent: boolean) => {
    const delimiters: [string, string, boolean][] = [
      ['\\(', '\\)', true],
      ['\\[', '\\]', false],
      ['$$', '$$', true]
    ]

    for (const [open, close, isInline] of delimiters) {
      const start = state.pos
      if (state.src.slice(start, start + open.length) !== open) continue

      const end = state.src.indexOf(close, start + open.length)
      if (end === -1) continue

      if (!silent) {
        const token = state.push(isInline ? 'math_inline' : 'math_block', 'math', 0)
        token.content = state.src.slice(start + open.length, end)
        token.markup = isInline ? '\\(\\)' : open === '$$' ? '$$' : '\\[\\]'
      }

      state.pos = end + close.length
      return true
    }
    return false
  }

  // Register custom rules
  md.inline.ruler.before('escape', 'math', mathInline)

  // Add rendering rules
  md.renderer.rules.math_inline = (tokens, idx) => tokens[idx].content
  md.renderer.rules.math_block = (tokens, idx) => tokens[idx].content
  md.renderer.rules.code_block = (tokens, idx) => tokens[idx].content

  // Configure MathJax
  md.use(mathjax3, {
    tex: {
      inlineMath: [['\\(', '\\)']],
      displayMath: [
        ['$$', '$$'],
        ['\\[', '\\]']
      ],
      processEscapes: true,
      processEnvironments: true,
      processRefs: true,
      digits: /^(?:[0-9]+(?:\{,\}[0-9]{3})*(?:\.[0-9]*)?|\.[0-9]+)/
    }
  })

  // Disable default code highlighting
  md.options.highlight = null

  // Custom code block rendering
  // md.renderer.rules.fence = (tokens, idx) => {
  //   const token = tokens[idx]
  //   const info = token.info ? token.info.trim() : ''
  //   const str = token.content
  //   const encodedCode = btoa(unescape(encodeURIComponent(str)))
  //   const language = info || 'text'
  //   const uniqueId = `editor-${msgId}-${idx}-${language}`

  //   return `<div class="code-block" data-code="${encodedCode}" data-lang="${language}" id="${uniqueId}">
  //     <div class="code-header">
  //       <span class="code-lang">${language.toUpperCase()}</span>
  //       <button class="copy-button" data-code="${encodedCode}">${t('common.copyCode')}</button>
  //     </div>
  //     <div class="code-editor"></div>
  //   </div>`
  // }

  // // Custom image rendering
  // // const defaultImageRenderer = md.renderer.rules.image; // Keep the default renderer if needed later
  // md.renderer.rules.image = (tokens, idx /*, options, env, self */) => {
  //   const token = tokens[idx]
  //   const src = token.attrGet('src')
  //   const alt = token.content
  //   const title = token.attrGet('title')

  //   // Add the max-width style
  //   let attrs = token.attrs ? token.attrs.map(([key, value]) => `${key}="${value}"`).join(' ') : ''
  //   // Prepend the style attribute
  //   attrs = `style="max-width: 400px;" ${attrs}`.trim()

  //   return `<img src="${src || ''}" alt="${alt}" ${title ? `title="${title}"` : ''} ${attrs} />`
  // }

  // Custom reference inline rule
  const referenceInline = (state: any, silent: boolean) => {
    if (state.src[state.pos] !== '[') return false

    const match = /^\[(\d+)\]/.exec(state.src.slice(state.pos))
    if (!match) return false

    if (!silent) {
      const id = match[1]
      const token = state.push('reference', 'span', 0)
      token.content = id
      token.markup = match[0]
    }

    state.pos += match[0].length
    return true
  }

  // Add rendering rule for references
  md.renderer.rules.reference = (tokens, idx) => {
    const id = tokens[idx].content
    return `<span class="reference-link"
    data-reference-id="${id}"
    role="button"
    tabindex="0"
    title="Click to view reference">${id}</span>`
  }

  // Register custom rule
  md.inline.ruler.before('escape', 'reference', referenceInline)
  return md
}

export const getCommonMarkdown = () => {
  const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
    breaks: false
  })

  // Apply additional plugins
  md.use(markdownItSub)
  md.use(markdownItSup)
  md.use(markdownItMark)
  md.use(markdownItEmoji)
  md.use(markdownItCheckbox)
  md.use(markdownItIns)

  return md
}

export const renderMarkdown = (md: MarkdownIt, content: string) => md.render(content)

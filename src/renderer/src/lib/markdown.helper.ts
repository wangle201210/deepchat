/* eslint-disable @typescript-eslint/no-explicit-any */
import MarkdownIt from 'markdown-it'
import mathjax3 from 'markdown-it-mathjax3'
// export const initReference = ({
//   onClick,
//   onHover
// }: {
//   msgId: string;
//   onClick: (id: string, rect: DOMRect) => void;
//   onHover: (id: string, isHover: boolean, rect: DOMRect) => void;
//   }) => {
//   if (!(window as any).handleReferenceClick) {
//         (window as any).handleReferenceClick = (id: string, event: MouseEvent) => {
//           const rect = (event.target as HTMLElement).getBoundingClientRect();
//           onClick(id, rect);
//         };
//   }
//   if (!(window as any).handleReferenceHover) {
//   (window as any).handleReferenceHover = (
//     id: string,
//     isHover: boolean,
//     event: MouseEvent
//   ) => {
//     const rect = (event.target as HTMLElement).getBoundingClientRect();
//       onHover(id, isHover, rect);
//     };
//   }
// };

export const getMarkdown = (msgId: string, t: (key: string) => string) => {
  // import footnote from 'markdown-it-footnote'
  // Create markdown-it instance with configuration
  console.log('getmarkdown', msgId)
  const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
    breaks: false
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
  md.renderer.rules.fence = (tokens, idx) => {
    const token = tokens[idx]
    const info = token.info ? token.info.trim() : ''
    const str = token.content
    const encodedCode = btoa(unescape(encodeURIComponent(str)))
    const language = info || 'text'
    const uniqueId = `editor-${msgId}-${idx}-${language}`

    return `<div class="code-block" data-code="${encodedCode}" data-lang="${language}" id="${uniqueId}">
      <div class="code-header">
        <span class="code-lang">${language.toUpperCase()}</span>
        <button class="copy-button" data-code="${encodedCode}">${t('common.copyCode')}</button>
      </div>
      <div class="code-editor"></div>
    </div>`
  }

  // Custom image rendering
  // const defaultImageRenderer = md.renderer.rules.image; // Keep the default renderer if needed later
  md.renderer.rules.image = (tokens, idx /*, options, env, self */) => {
    const token = tokens[idx]
    const src = token.attrGet('src')
    const alt = token.content
    const title = token.attrGet('title')

    // Add the max-width style
    let attrs = token.attrs ? token.attrs.map(([key, value]) => `${key}="${value}"`).join(' ') : ''
    // Prepend the style attribute
    attrs = `style="max-width: 400px;" ${attrs}`.trim()

    return `<img src="${src || ''}" alt="${alt}" ${title ? `title="${title}"` : ''} ${attrs} />`
  }

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
  return md
}

export const renderMarkdown = (md: MarkdownIt, content: string) => md.render(content)

import { renderMermaidDiagram } from '@/lib/mermaid.helper'
import { EditorView, basicSetup } from 'codemirror'
import { javascript } from '@codemirror/lang-javascript'
import { python } from '@codemirror/lang-python'
import { html } from '@codemirror/lang-html'
import { css } from '@codemirror/lang-css'
import { json } from '@codemirror/lang-json'
import { java } from '@codemirror/lang-java'
import { go } from '@codemirror/lang-go'
import { markdown } from '@codemirror/lang-markdown'
import { sql } from '@codemirror/lang-sql'
import { xml } from '@codemirror/lang-xml'
import { cpp } from '@codemirror/lang-cpp'
import { rust } from '@codemirror/lang-rust'
import { shell } from '@codemirror/legacy-modes/mode/shell'
import { swift } from '@codemirror/legacy-modes/mode/swift'
import { ruby } from '@codemirror/legacy-modes/mode/ruby'
import { perl } from '@codemirror/legacy-modes/mode/perl'
import { lua } from '@codemirror/legacy-modes/mode/lua'
import { haskell } from '@codemirror/legacy-modes/mode/haskell'
import { erlang } from '@codemirror/legacy-modes/mode/erlang'
import { clojure } from '@codemirror/legacy-modes/mode/clojure'
import { StreamLanguage } from '@codemirror/language'
import { php } from '@codemirror/lang-php'
import { yaml } from '@codemirror/lang-yaml'
import { EditorState, Extension } from '@codemirror/state'
import { anysphereTheme } from '@/lib/code.theme'

export const editorInstances: Map<string, EditorView> = new Map()
// 存储代码内容和语言信息的映射，保持稳定性
const codeCache: Map<string, { code: string; lang: string }> = new Map()

// 获取语言扩展
const getLanguageExtension = (lang: string): Extension => {
  switch (lang.toLowerCase()) {
    case 'javascript':
    case 'js':
    case 'ts':
    case 'typescript':
      return javascript()
    case 'react':
    case 'vue':
    case 'html':
      return html()
    case 'css':
      return css()
    case 'json':
      return json()
    case 'python':
    case 'py':
      return python()
    case 'kotlin':
    case 'kt':
    case 'java':
      return java()
    case 'go':
    case 'golang':
      return go()
    case 'markdown':
    case 'md':
      return markdown()
    case 'sql':
      return sql()
    case 'xml':
      return xml()
    case 'cpp':
    case 'c++':
    case 'c':
      return cpp()
    case 'rust':
    case 'rs':
      return rust()
    case 'bash':
    case 'sh':
    case 'shell':
    case 'zsh':
      return StreamLanguage.define(shell)
    case 'php':
      return php()
    case 'yaml':
    case 'yml':
      return yaml()
    case 'swift':
      return StreamLanguage.define(swift)
    case 'ruby':
      return StreamLanguage.define(ruby)
    case 'perl':
      return StreamLanguage.define(perl)
    case 'lua':
      return StreamLanguage.define(lua)
    case 'haskell':
      return StreamLanguage.define(haskell)
    case 'erlang':
      return StreamLanguage.define(erlang)
    case 'clojure':
      return StreamLanguage.define(clojure)
    default:
      return markdown() // 默认使用markdown作为fallback
  }
}

export const useCodeEditor = (id: string) => {
  const initCodeEditors = (status?: 'loading' | 'success' | 'error') => {
    const codeBlocks = document.querySelectorAll(`#${id} .code-block`)

    // 收集当前可见的编辑器ID
    const currentEditorIds = new Set<string>()

    codeBlocks.forEach((block) => {
      const editorId = block.getAttribute('id')
      const editorContainer = block.querySelector('.code-editor')
      const code = block.getAttribute('data-code')
      const lang = block.getAttribute('data-lang')

      if (!editorId || !editorContainer || !code || !lang) {
        return
      }

      // 记录当前ID
      currentEditorIds.add(editorId)

      const decodedCode = decodeURIComponent(escape(atob(code)))

      // 如果是 mermaid 代码块，渲染图表
      if (lang.toLowerCase() === 'mermaid' && status === 'success') {
        renderMermaidDiagram(editorContainer as HTMLElement, decodedCode, editorId)
        return
      }

      // 检查是否内容与缓存相同
      const cachedInfo = codeCache.get(editorId)
      const isSameContent =
        cachedInfo && cachedInfo.code === decodedCode && cachedInfo.lang === lang

      // 更新缓存
      codeCache.set(editorId, { code: decodedCode, lang })

      // 关键检查：DOM元素是否包含CodeMirror编辑器
      // 即使ID相同，但如果DOM被替换了，我们需要创建新的编辑器
      const existingEditor = editorInstances.get(editorId)
      const domContainsEditor =
        existingEditor &&
        editorContainer instanceof HTMLElement &&
        editorContainer.contains(existingEditor.dom)

      // 如果内容相同且DOM元素包含编辑器实例，不需要重新创建
      if (isSameContent && domContainsEditor) {
        return
      }

      // 如果有旧的编辑器实例，先销毁
      if (existingEditor) {
        existingEditor.destroy()
      }

      // 创建基础扩展
      const extensions = [
        basicSetup,
        anysphereTheme,
        EditorView.lineWrapping,
        EditorState.tabSize.of(2),
        getLanguageExtension(lang),
        EditorState.readOnly.of(true)
      ]

      try {
        if (editorContainer instanceof HTMLElement) {
          const editorView = new EditorView({
            state: EditorState.create({
              doc: decodedCode,
              extensions
            }),
            parent: editorContainer
          })
          editorInstances.set(editorId, editorView)
        }
      } catch (error) {
        console.error('Failed to initialize editor:', error)
        // Fallback方法：使用简单的pre标签
        if (editorContainer instanceof HTMLElement) {
          const escapedCode = decodedCode
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;')
          editorContainer.innerHTML = `<pre style="white-space: pre-wrap; color: #ffffff; margin: 0;">${escapedCode}</pre>`
        }
      }
    })

    // 清理不再显示的编辑器实例
    editorInstances.forEach((editor, editorId) => {
      if (!currentEditorIds.has(editorId)) {
        editor.destroy()
        editorInstances.delete(editorId)
        codeCache.delete(editorId)
      }
    })
  }

  const cleanupEditors = () => {
    editorInstances.forEach((editor) => {
      editor.destroy()
    })
    editorInstances.clear()
    codeCache.clear()
  }

  return {
    initCodeEditors,
    cleanupEditors
  }
}

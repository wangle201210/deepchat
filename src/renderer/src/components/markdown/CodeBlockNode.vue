<template>
  <MermaidBlockNode v-if="isMermaid" :node="node" />
  <div v-else class="my-4 rounded-lg border border-border overflow-hidden shadow-sm">
    <div class="flex justify-between items-center p-2 bg-gray-100 dark:bg-zinc-800 text-xs">
      <span class="text-gray-600 dark:text-gray-400 font-mono font-bold">{{
        displayLanguage
      }}</span>
      <div v-if="isPreviewable" class="flex items-center space-x-2">
        <button
          class="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
          @click="copyCode"
        >
          {{ copyText }}
        </button>
        <button
          class="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
          @click="previewCode"
        >
          {{ t('artifacts.preview') }}
        </button>
      </div>
      <button
        v-else
        class="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
        @click="copyCode"
      >
        {{ copyText }}
      </button>
    </div>
    <div
      ref="codeEditor"
      class="min-h-[30px] max-h-[500px] text-xs overflow-auto bg-gray-50 dark:bg-zinc-900 font-mono leading-relaxed"
      :data-language="node.language"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDark } from '@vueuse/core'
import { EditorView, basicSetup } from 'codemirror'
import { EditorState, Extension } from '@codemirror/state'
import { StreamLanguage } from '@codemirror/language'
import MermaidBlockNode from './MermaidBlockNode.vue'

// Language imports
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
import { php } from '@codemirror/lang-php'
import { yaml } from '@codemirror/lang-yaml'
import { anysphereThemeDark, anysphereThemeLight } from '@/lib/code.theme'

// Optional: Import artifact store if needed
import { useArtifactStore } from '@/stores/artifact'
import { nanoid } from 'nanoid'

const props = defineProps<{
  node: {
    type: 'code_block'
    language: string
    code: string
    raw: string
  }
  messageId?: string
  threadId?: string
}>()

const { t } = useI18n()
const isDark = useDark()
const artifactStore = useArtifactStore()
const codeEditor = ref<HTMLElement | null>(null)
const copyText = ref(t('common.copy'))
const editorInstance = ref<EditorView | null>(null)

// Check if the language is previewable (HTML or SVG)
const isPreviewable = computed(() => {
  const lang = props.node.language.trim().toLowerCase()
  return lang === 'html' || lang === 'svg'
})

// Check if the code block is a Mermaid diagram
const isMermaid = computed(() => props.node.language.toLowerCase() === 'mermaid')

// 计算用于显示的语言名称
const displayLanguage = computed(() => {
  const lang = props.node.language.trim().toLowerCase()

  // 映射一些常见语言的显示名称
  const languageMap = {
    js: 'JavaScript',
    ts: 'TypeScript',
    jsx: 'JSX',
    tsx: 'TSX',
    html: 'HTML',
    css: 'CSS',
    scss: 'SCSS',
    json: 'JSON',
    py: 'Python',
    python: 'Python',
    rb: 'Ruby',
    go: 'Go',
    java: 'Java',
    c: 'C',
    cpp: 'C++',
    cs: 'C#',
    php: 'PHP',
    sh: 'Shell',
    bash: 'Bash',
    sql: 'SQL',
    yaml: 'YAML',
    md: 'Markdown',
    '': 'Plain Text'
  }

  return languageMap[lang] || lang.charAt(0).toUpperCase() + lang.slice(1)
})

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

// 复制代码
const copyCode = async () => {
  try {
    await navigator.clipboard.writeText(props.node.code)
    copyText.value = t('common.copySuccess')
    setTimeout(() => {
      copyText.value = t('common.copy')
    }, 2000)
  } catch (err) {
    console.error('复制失败:', err)
  }
}

// 预览HTML/SVG代码
const previewCode = () => {
  if (!isPreviewable.value || !props.messageId || !props.threadId) return

  const lowerLang = props.node.language.toLowerCase()
  const artifactType = lowerLang === 'html' ? 'text/html' : 'image/svg+xml'
  const artifactTitle =
    lowerLang === 'html'
      ? t('artifacts.htmlPreviewTitle') || 'HTML Preview'
      : t('artifacts.svgPreviewTitle') || 'SVG Preview'

  artifactStore.showArtifact(
    {
      id: `temp-${lowerLang}-${nanoid()}`,
      type: artifactType,
      title: artifactTitle,
      content: props.node.code,
      status: 'loaded'
    },
    props.messageId,
    props.threadId
  )
}

// 创建编辑器实例
const createEditor = () => {
  if (!codeEditor.value) return

  // Clean up existing editor if it exists
  if (editorInstance.value) {
    editorInstance.value.destroy()
    editorInstance.value = null
  }

  // Set up CodeMirror extensions
  const extensions = [
    basicSetup,
    isDark.value ? anysphereThemeDark : anysphereThemeLight,
    EditorView.lineWrapping,
    EditorState.tabSize.of(2),
    getLanguageExtension(props.node.language),
    EditorState.readOnly.of(true)
  ]

  try {
    const editorView = new EditorView({
      state: EditorState.create({
        doc: props.node.code,
        extensions
      }),
      parent: codeEditor.value
    })
    editorInstance.value = editorView
  } catch (error) {
    console.error('Failed to initialize editor:', error)
    // Fallback: use a simple pre tag
    const escapedCode = props.node.code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
    codeEditor.value.innerHTML = `<pre class="whitespace-pre-wrap text-gray-800 dark:text-gray-200 m-0">${escapedCode}</pre>`
  }
}

// 监听主题变化
watch(isDark, () => {
  createEditor()
})

// 监听代码变化
watch(
  () => props.node.code,
  (newCode) => {
    if (!newCode) return

    // If it's a mermaid diagram, re-render it
    if (props.node.language.toLowerCase() === 'mermaid' && codeEditor.value) {
      return
    }

    // For normal code blocks, update the editor content
    if (editorInstance.value) {
      const state = editorInstance.value.state

      editorInstance.value.dispatch({
        changes: { from: 0, to: state.doc.length, insert: newCode }
      })
    } else {
      // If editor not yet initialized, create it
      createEditor()
    }
  },
  { immediate: true }
)

// 监听语言变化
watch(
  () => props.node.language,
  () => {
    // If the language changes, we need to recreate the editor with the new language
    createEditor()
  }
)

// 初始化代码编辑器
onMounted(() => {
  // Initial editor setup is handled by the immediate watch on code
  createEditor()
})

// 清理资源
onUnmounted(() => {
  if (editorInstance.value) {
    editorInstance.value.destroy()
    editorInstance.value = null
  }
})
</script>

<style>
/* Ensure CodeMirror inherits the right font in the editor */
.cm-editor .cm-content {
  font-family:
    ui-monospace,
    SFMono-Regular,
    SF Mono,
    Menlo,
    Consolas,
    Liberation Mono,
    monospace !important;
}
</style>

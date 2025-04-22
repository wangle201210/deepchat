<template>
  <div class="code-block-node">
    <div class="code-header">
      <span class="code-lang">{{ displayLanguage }}</span>
      <span class="copy-button" @click="copyCode">{{ copyText }}</span>
    </div>
    <div ref="codeEditor" class="code-editor" :data-language="node.language"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import { useI18n } from 'vue-i18n'

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
const editorId = ref(`editor-${uuidv4()}`)
const codeEditor = ref<HTMLElement | null>(null)
const copyText = ref(t('common.copy'))

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

// 初始化代码编辑器
onMounted(() => {
  if (codeEditor.value) {
    // 在这里仅设置编辑器的 ID 和代码内容
    // 真正的初始化将由父组件通过引用完成
    codeEditor.value.id = editorId.value
    codeEditor.value.textContent = props.node.code

    // 发出事件通知父组件初始化此编辑器
    const event = new CustomEvent('editor-ready', {
      detail: {
        id: editorId.value,
        element: codeEditor.value,
        language: props.node.language,
        code: props.node.code,
        messageId: props.messageId,
        threadId: props.threadId
      }
    })

    window.dispatchEvent(event)
  }
})

// 清理资源
onUnmounted(() => {
  // 发出事件通知父组件清理此编辑器
  const event = new CustomEvent('editor-cleanup', {
    detail: {
      id: editorId.value
    }
  })

  window.dispatchEvent(event)
})
</script>

<style scoped>
.code-block-node {
  margin: 1rem 0;
  border-radius: 6px;
  overflow: hidden;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.code-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 1rem;
  background-color: rgba(175, 184, 193, 0.2);
  font-size: 0.85rem;
}

.code-lang {
  color: rgba(0, 0, 0, 0.6);
}

.copy-button {
  cursor: pointer;
  color: rgba(0, 0, 0, 0.6);
  transition: color 0.2s;
}

.copy-button:hover {
  color: rgba(0, 0, 0, 0.8);
}

.code-editor {
  min-height: 30px;
  max-height: 400px;
  overflow: auto;
  padding: 1rem;
  background-color: rgba(246, 248, 250, 1);
  font-family:
    ui-monospace,
    SFMono-Regular,
    SF Mono,
    Menlo,
    Consolas,
    Liberation Mono,
    monospace;
  font-size: 0.85rem;
  white-space: pre;
  line-height: 1.45;
}

:deep(.code-editor *) {
  font-family:
    ui-monospace,
    SFMono-Regular,
    SF Mono,
    Menlo,
    Consolas,
    Liberation Mono,
    monospace !important;
}

.dark .code-header {
  background-color: rgba(110, 118, 129, 0.4);
}

.dark .code-lang,
.dark .copy-button {
  color: rgba(255, 255, 255, 0.6);
}

.dark .copy-button:hover {
  color: rgba(255, 255, 255, 0.8);
}

.dark .code-editor {
  background-color: rgba(13, 17, 23, 0.8);
  color: #e6edf3;
}
</style>

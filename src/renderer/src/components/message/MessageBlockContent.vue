<!-- eslint-disable @typescript-eslint/no-explicit-any -->
<!-- eslint-disable vue/no-v-html -->
<template>
  <div ref="messageBlock" class="markdown-content-wrapper relative w-full">
    <template v-for="(part, index) in processedContent" :key="index">
      <div
        v-if="part.type === 'text'"
        :id="id"
        class="prose prose-sm dark:prose-invert max-w-full break-all"
        @click="handleCopyClick"
        @mouseover="handleHover($event, true)"
        @mouseout="handleHover($event, false)"
        @contextmenu="handleContextMenu"
        v-html="renderContent(part.content)"
      ></div>
      <ArtifactThinking v-if="part.type === 'thinking' && part.loading" />
      <div v-if="part.type === 'artifact' && part.artifact" class="my-1">
        <ArtifactPreview
          :block="{
            content: part.content,
            artifact: part.artifact
          }"
          :message-id="messageId"
          :thread-id="threadId"
          :loading="part.loading"
        />
      </div>
      <div v-if="part.type === 'tool_call' && part.tool_call" class="my-1">
        <ToolCallPreview :block="part" :block-status="props.block.status" />
      </div>
    </template>
    <LoadingCursor v-show="block.status === 'loading'" ref="loadingCursor" />
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { getMarkdown, renderMarkdown } from '@/lib/markdown.helper'
import { v4 as uuidv4 } from 'uuid'

import { usePresenter } from '@/composables/usePresenter'
import { SearchResult } from '@shared/presenter'
import LoadingCursor from '@/components/LoadingCursor.vue'

const threadPresenter = usePresenter('threadPresenter')
const searchResults = ref<SearchResult[]>([])

import ArtifactThinking from '../artifacts/ArtifactThinking.vue'
import ArtifactPreview from '../artifacts/ArtifactPreview.vue'
import ToolCallPreview from '../artifacts/ToolCallPreview.vue'
import { useCodeEditor } from '@/composables/useCodeEditor'
import { useBlockContent } from '@/composables/useArtifacts'
import { useArtifactStore } from '@/stores/artifact'
import { useReferenceStore } from '@/stores/reference'

const artifactStore = useArtifactStore()
const props = defineProps<{
  block: {
    content: string
    status?: 'loading' | 'success' | 'error'
    timestamp: number
  }
  messageId: string
  threadId: string
  isSearchResult?: boolean
}>()

const id = ref(`editor-${uuidv4()}`)

const { initCodeEditors, cleanupEditors } = useCodeEditor(id.value)

const loadingCursor = ref<InstanceType<typeof LoadingCursor> | null>(null)
const messageBlock = ref<HTMLDivElement>()

const referenceStore = useReferenceStore()

const { t } = useI18n()

const { processedContent } = useBlockContent(props)

const refreshLoadingCursor = () => {
  if (messageBlock.value) {
    loadingCursor.value?.updateCursorPosition(messageBlock.value)
  }
}

const md = getMarkdown(id.value, t)
const handleReferenceHover = ({ msgId, refId, isHover, event }) => {
  const rect = (event.target as HTMLElement).getBoundingClientRect()

  if (msgId !== id.value) {
    referenceStore.hideReference()
    return
  }
  console.log(id.value, msgId, refId, isHover, rect)
  const index = parseInt(refId) - 1
  // console.log(id, isHover, rect)
  if (searchResults.value && searchResults.value[index]) {
    if (isHover) {
      referenceStore.showReference(searchResults.value[index], rect)
    } else {
      referenceStore.hideReference()
    }
  }
}

const handleReferenceClick = ({ msgId, refId }) => {
  if (msgId !== id.value) {
    return
  }
  const index = parseInt(refId) - 1
  if (searchResults.value && searchResults.value[index]) {
    // Handle navigation or content display
    // console.log('Navigate to:', searchResults.value[index])
    window.open(searchResults.value[index].url, '_blank')
  }
}

// Handle copy functionality
const handleCopyClick = async (e: MouseEvent) => {
  const target = e.target as HTMLElement
  if (target.classList.contains('copy-button')) {
    const encodedCode = target.getAttribute('data-code')
    if (encodedCode) {
      try {
        const decodedCode = decodeURIComponent(escape(atob(encodedCode)))
        await navigator.clipboard.writeText(decodedCode)
        const originalText = target.textContent
        target.textContent = t('common.copySuccess')
        setTimeout(() => {
          target.textContent = originalText
        }, 2000)
      } catch (err) {
        console.error('Failed to copy:', err)
      }
    }
  }
  if (target.classList.contains('reference-link')) {
    const refId = target.getAttribute('data-reference-id')
    if (refId) {
      console.log('reference-link', refId)
      handleReferenceClick({ msgId: id.value, refId })
    }
  }
}

const handleHover = (e: MouseEvent, isHover: boolean) => {
  const target = e.target as HTMLElement
  if (target.classList.contains('reference-link')) {
    console.log('reference-link', target.getAttribute('data-reference-id'))
    handleReferenceHover({
      msgId: id.value,
      refId: target.getAttribute('data-reference-id'),
      isHover,
      event: e
    })
  }
}
const renderContent = (content: string) => {
  refreshLoadingCursor()
  // 处理常规内容或代码块
  const rendered = renderMarkdown(
    md,
    props.block.status === 'loading' ? content + loadingCursor.value?.CURSOR_MARKER : content
  )
  return rendered
}

// 右键菜单事件处理
const handleContextMenu = (event) => {
  // 检查目标元素是否是可编辑元素或其中的一部分
  const target = event.target as HTMLElement
  const isEditable =
    target.isContentEditable ||
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    !!target.closest('input, textarea, [contenteditable="true"]')

  // 只有在非可编辑元素上且没有选中文本时才自动选择
  if (!isEditable && window.getSelection()?.toString().trim().length === 0) {
    // 获取事件目标元素
    const targetForSelection = event.currentTarget

    // 创建范围选择整个元素内容
    const range = document.createRange()
    range.selectNodeContents(targetForSelection)

    // 应用选择
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
  }
}

// 修改 watch 函数
watch(
  processedContent,
  () => {
    nextTick(() => {
      refreshLoadingCursor()
      for (const part of processedContent.value) {
        if (part.type === 'text') {
          initCodeEditors(props.block.status)
        }
        if (part.type === 'artifact' && part.artifact) {
          if (props.block.status === 'loading') {
            if (artifactStore.currentArtifact?.id === part.artifact.identifier) {
              artifactStore.currentArtifact.content = part.content
              artifactStore.currentArtifact.title = part.artifact.title
              artifactStore.currentArtifact.type = part.artifact.type
              artifactStore.currentArtifact.status = part.loading ? 'loading' : 'loaded'
            } else {
              artifactStore.showArtifact(
                {
                  id: part.artifact.identifier,
                  type: part.artifact.type,
                  title: part.artifact.title,
                  content: part.content,
                  status: part.loading ? 'loading' : 'loaded'
                },
                props.messageId,
                props.threadId
              )
            }
          } else {
            if (artifactStore.currentArtifact?.id === part.artifact.identifier) {
              artifactStore.currentArtifact.content = part.content
              artifactStore.currentArtifact.title = part.artifact.title
              artifactStore.currentArtifact.type = part.artifact.type
              artifactStore.currentArtifact.status = 'loaded'
            }
          }
        }
      }
    })
  },
  { immediate: true }
)

onMounted(async () => {
  if (props.isSearchResult) {
    searchResults.value = await threadPresenter.getSearchResults(props.messageId)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).addEventListener('reference-click', handleReferenceClick)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).addEventListener('reference-hover', handleReferenceHover)
  }
})

onUnmounted(() => {
  cleanupEditors()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(window as any).removeEventListener('reference-click', handleReferenceClick)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(window as any).removeEventListener('reference-hover', handleReferenceHover)
})
</script>

<style>
.prose {
  @apply leading-7;
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* 添加行内公式样式 */
.prose .math-inline {
  @apply inline-block;
  white-space: nowrap;
}

/* 确保块级公式正确显示 */
.prose .math-block {
  @apply block my-4;
}

.prose pre {
  @apply bg-transparent p-0 m-0;
}

.prose h1 {
  @apply text-xl mt-4 mb-2;
}

.prose h2 {
  @apply text-lg mt-4 mb-2;
}

.prose h3 {
  @apply text-base mt-3 mb-2;
}

.prose .code-block {
  @apply rounded-lg overflow-hidden mt-2 mb-4 text-xs shadow-sm;
}

.prose .code-header {
  @apply flex justify-between rounded-t-lg items-center px-3 py-2 bg-zinc-100 dark:bg-zinc-900 border-t border-l border-r;
}

.prose .code-lang {
  @apply text-xs text-muted-foreground;
}

.prose .copy-button {
  @apply text-xs text-muted-foreground hover:text-foreground;
}

.prose .code-editor {
  @apply overflow-auto dark:bg-gray-900 border;
  min-height: 10px;
  border-radius: 0 0 0.5rem 0.5rem;
}

.prose .code-editor * {
  font-family: Menlo, Monaco, 'JetBrains Mono', Consolas, 'Courier New', monospace !important;
}

.prose hr {
  @apply my-4;
}

.prose hr:last-child {
  @apply mb-4;
}

.prose hr + p {
  @apply mt-4;
}

/* MathJax 容器样式 */
.prose mjx-container:not([display='true']) {
  display: inline-block !important;
  margin: 0 !important;
  vertical-align: middle !important;
}

.prose mjx-container[display='true'] {
  @apply block my-4;
  text-align: center;
}
.prose .reference-link {
  @apply inline-block text-xs text-muted-foreground bg-muted rounded-md text-center min-w-4 py-0.5 mx-0.5 hover:bg-accent;
}
</style>

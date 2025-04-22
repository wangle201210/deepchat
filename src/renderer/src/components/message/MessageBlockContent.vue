<!-- eslint-disable @typescript-eslint/no-explicit-any -->
<template>
  <div ref="messageBlock" class="markdown-content-wrapper relative w-full">
    <template v-for="(part, index) in processedContent" :key="index">
      <!-- 使用结构化渲染器替代 v-html -->
      <MarkdownRenderer
        v-if="part.type === 'text'"
        :content="part.content"
        :message-id="messageId"
        :thread-id="threadId"
        @copy="handleCopyClick"
      />

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
import { ref, nextTick, watch, onMounted } from 'vue'

import { usePresenter } from '@/composables/usePresenter'
import { SearchResult } from '@shared/presenter'
import LoadingCursor from '@/components/LoadingCursor.vue'

const threadPresenter = usePresenter('threadPresenter')
const searchResults = ref<SearchResult[]>([])

import ArtifactThinking from '../artifacts/ArtifactThinking.vue'
import ArtifactPreview from '../artifacts/ArtifactPreview.vue'
import ToolCallPreview from '../artifacts/ToolCallPreview.vue'
import { useBlockContent } from '@/composables/useArtifacts'
import { useArtifactStore } from '@/stores/artifact'
import MarkdownRenderer from '@/components/markdown/MarkdownRenderer.vue'

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

const loadingCursor = ref<InstanceType<typeof LoadingCursor> | null>(null)
const messageBlock = ref<HTMLDivElement>()

const { processedContent } = useBlockContent(props)

const refreshLoadingCursor = () => {
  if (messageBlock.value) {
    loadingCursor.value?.updateCursorPosition(messageBlock.value)
  }
}

// Handle copy functionality
const handleCopyClick = () => {
  // 现在复制功能在组件内部处理
  refreshLoadingCursor()
}

// 修改 watch 函数
watch(
  processedContent,
  () => {
    nextTick(() => {
      refreshLoadingCursor()
      for (const part of processedContent.value) {
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
  }
})
</script>

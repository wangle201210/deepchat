<template>
  <div class="w-full h-full flex-row flex">
    <div
      :class="[
        'flex-1 w-0 h-full transition-all duration-200 max-lg:!mr-0',
        artifactStore.isOpen && route.name === 'chat' ? 'mr-[calc(60%_-_104px)]' : ''
      ]"
    >
      <div class="flex h-full">
        <!-- 左侧会话列表 -->
        <Transition
          enter-active-class="transition-all duration-300 ease-out"
          leave-active-class="transition-all duration-300 ease-in"
          enter-from-class="-translate-x-full opacity-0"
          leave-to-class="-translate-x-full opacity-0"
        >
          <div
            v-if="chatStore.isSidebarOpen"
            class="w-60 max-w-60 h-full fixed left-0 z-20 lg:relative"
          >
            <ThreadsView class="transform" />
          </div>
        </Transition>

        <!-- 主聊天区域 -->
        <div class="flex-1 flex flex-col w-0">
          <!-- 新会话 -->
          <NewThread v-if="!chatStore.getActiveThreadId()" />
          <template v-else>
            <!-- 标题栏 -->
            <TitleView :model="activeModel" />

            <!-- 聊天内容区域 -->
            <ChatView />
          </template>
        </div>
      </div>
    </div>
    <!-- Artifacts 预览区域 -->
    <ArtifactDialog />
  </div>
</template>

<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import { useChatStore } from '@/stores/chat'
import { computed, watch } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { RENDERER_MODEL_META } from '@shared/presenter'
import { useArtifactStore } from '@/stores/artifact'
import ArtifactDialog from '@/components/artifacts/ArtifactDialog.vue'
import { useRoute } from 'vue-router'
import { useTitle } from '@vueuse/core'
const ThreadsView = defineAsyncComponent(() => import('@/components/ThreadsView.vue'))
const TitleView = defineAsyncComponent(() => import('@/components/TitleView.vue'))
const ChatView = defineAsyncComponent(() => import('@/components/ChatView.vue'))
const NewThread = defineAsyncComponent(() => import('@/components/NewThread.vue'))
const artifactStore = useArtifactStore()
const settingsStore = useSettingsStore()
const route = useRoute()
const chatStore = useChatStore()
const title = useTitle()

// 添加标题更新逻辑
const updateTitle = () => {
  const activeThread = chatStore.activeThread
  if (activeThread) {
    title.value = activeThread.title
  } else {
    title.value = 'New Chat'
  }
}

// 监听活动会话变化
watch(
  () => chatStore.activeThread,
  () => {
    updateTitle()
  },
  { immediate: true }
)

// 监听会话标题变化
watch(
  () => chatStore.threads,
  () => {
    if (chatStore.activeThread) {
      updateTitle()
    }
  },
  { deep: true }
)

const activeModel = computed(() => {
  let model: RENDERER_MODEL_META | undefined
  const modelId = chatStore.activeThread?.settings.modelId
  if (modelId) {
    for (const group of settingsStore.enabledModels) {
      const foundModel = group.models.find((m) => m.id === modelId)
      if (foundModel) {
        model = foundModel
        break
      }
    }

    if (!model) {
      for (const group of settingsStore.customModels) {
        const foundModel = group.models.find((m) => m.id === modelId)
        if (foundModel) {
          model = foundModel
          break
        }
      }
    }
  }
  if (!model) {
    model = {
      name: chatStore.activeThread?.settings.modelId || '',
      id: chatStore.activeThread?.settings.modelId || '',
      group: '',
      providerId: '',
      enabled: false,
      isCustom: false,
      contextLength: 0,
      maxTokens: 0
    }
  }
  return {
    name: model.name,
    id: model.id,
    tags: []
  }
})
</script>

<style>
.bg-grid-pattern {
  background-image:
    linear-gradient(to right, #000 1px, transparent 1px),
    linear-gradient(to bottom, #000 1px, transparent 1px);
  background-size: 20px 20px;
}

/* 添加全局样式 */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: #d1d5db80;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #9ca3af80;
}
</style>

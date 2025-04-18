<script setup lang="ts">
import { onMounted, ref, watch, onBeforeUnmount } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import AppBar from './components/AppBar.vue'
import SideBar from './components/SideBar.vue'
import UpdateDialog from './components/ui/UpdateDialog.vue'
import { usePresenter } from './composables/usePresenter'
import ArtifactDialog from './components/artifacts/ArtifactDialog.vue'
import { useArtifactStore } from './stores/artifact'
import { useChatStore } from '@/stores/chat'
import { NOTIFICATION_EVENTS } from './events'
import { useToast } from './components/ui/toast/use-toast'
import Toaster from './components/ui/toast/Toaster.vue'

const route = useRoute()
const configPresenter = usePresenter('configPresenter')
const artifactStore = useArtifactStore()
const chatStore = useChatStore()
const { toast } = useToast()

// 错误通知队列及当前正在显示的错误
const errorQueue = ref<Array<{ id: string; title: string; message: string; type: string }>>([])
const currentErrorId = ref<string | null>(null)
const errorDisplayTimer = ref<number | null>(null)

// 处理错误通知
const showErrorToast = (error: { id: string; title: string; message: string; type: string }) => {
  // 查找队列中是否已存在相同ID的错误，防止重复
  const existingErrorIndex = errorQueue.value.findIndex((e) => e.id === error.id)

  if (existingErrorIndex === -1) {
    // 如果当前有错误正在展示，将新错误放入队列
    if (currentErrorId.value) {
      if (errorQueue.value.length > 5) {
        errorQueue.value.shift()
      }
      errorQueue.value.push(error)
    } else {
      // 否则直接展示这个错误
      displayError(error)
    }
  }
}

// 显示指定的错误
const displayError = (error: { id: string; title: string; message: string; type: string }) => {
  // 更新当前显示的错误ID
  currentErrorId.value = error.id

  // 显示错误通知
  const { dismiss } = toast({
    title: error.title,
    description: error.message,
    variant: 'destructive',
    onOpenChange: (open) => {
      if (!open) {
        // 用户手动关闭时也显示下一个错误
        handleErrorClosed()
      }
    }
  })

  // 设置定时器，3秒后自动关闭当前错误
  if (errorDisplayTimer.value) {
    clearTimeout(errorDisplayTimer.value)
  }

  errorDisplayTimer.value = window.setTimeout(() => {
    console.log('errorDisplayTimer.value', errorDisplayTimer.value)
    // 处理错误关闭后的逻辑
    dismiss()
    handleErrorClosed()
  }, 3000)
}

// 处理错误关闭后的逻辑
const handleErrorClosed = () => {
  // 清除当前错误ID
  currentErrorId.value = null

  // 显示队列中的下一个错误（如果有）
  if (errorQueue.value.length > 0) {
    const nextError = errorQueue.value.shift()
    if (nextError) {
      displayError(nextError)
    }
  } else {
    // 队列为空，清除定时器
    if (errorDisplayTimer.value) {
      clearTimeout(errorDisplayTimer.value)
      errorDisplayTimer.value = null
    }
  }
}

const router = useRouter()
const activeTab = ref('chat')

const getInitComplete = async () => {
  const initComplete = await configPresenter.getSetting('init_complete')
  if (!initComplete) {
    router.push({ name: 'welcome' })
  }
}

getInitComplete()

onMounted(() => {
  // 监听全局错误通知事件
  window.electron.ipcRenderer.on(NOTIFICATION_EVENTS.SHOW_ERROR, (_event, error) => {
    showErrorToast(error)
  })

  watch(
    () => activeTab.value,
    (newVal) => {
      router.push({ name: newVal })
    }
  )

  watch(
    () => route.fullPath,
    (newVal) => {
      const pathWithoutQuery = newVal.split('?')[0]
      const newTab =
        pathWithoutQuery === '/'
          ? (route.name as string)
          : pathWithoutQuery.split('/').filter(Boolean)[0] || ''
      if (newTab !== activeTab.value) {
        activeTab.value = newTab
      }
      // 路由变化时关闭 artifacts 页面
      artifactStore.hideArtifact()
    }
  )

  // 监听当前对话的变化
  watch(
    () => chatStore.activeThreadId,
    () => {
      // 当切换对话时关闭 artifacts 页面
      artifactStore.hideArtifact()
    }
  )

  watch(
    () => artifactStore.isOpen,
    () => {
      chatStore.isSidebarOpen = false
    }
  )
})

// 在组件卸载前清除定时器
onBeforeUnmount(() => {
  if (errorDisplayTimer.value) {
    clearTimeout(errorDisplayTimer.value)
    errorDisplayTimer.value = null
  }
})
</script>

<template>
  <div class="flex flex-col h-screen">
    <AppBar />
    <div class="flex flex-row h-0 flex-grow relative overflow-hidden">
      <!-- 侧边导航栏 -->
      <SideBar
        v-show="route.name !== 'welcome'"
        v-model:model-value="activeTab"
        class="h-full z-10"
      />

      <!-- 主内容区域 -->
      <div
        :class="{
          'flex-1 w-0 h-full transition-all duration-200': true,
          'mr-[calc(60%_-_104px)]': artifactStore.isOpen && route.name === 'chat'
        }"
      >
        <RouterView />
      </div>

      <!-- Artifacts 预览区域 -->
      <ArtifactDialog />
    </div>
    <!-- 全局更新弹窗 -->
    <UpdateDialog />
    <!-- 全局Toast提示 -->
    <Toaster />
  </div>
</template>

<!-- eslint-disable vue/no-v-html -->
<template>
  <div>
    <div
      v-if="isTranslateDialogOpen"
      ref="translateRef"
      class="fixed z-50 w-[500px] bg-background border rounded-lg shadow-lg"
      :style="{ top: translatePosition.y + 'px', left: translatePosition.x + 'px' }"
    >
      <div class="flex items-center justify-between p-4 border-b cursor-move" @mousedown="startDrag('translate')">
        <h3 class="text-lg font-semibold">{{ t('contextMenu.translate.title') }}</h3>
        <Button variant="ghost" size="icon" @click="isTranslateDialogOpen = false">
          <Icon icon="lucide:x" class="h-4 w-4" />
        </Button>
      </div>
      <div class="p-4">
        <div class="mb-4">
          <div class="p-2 bg-muted text-muted-foreground">{{ selectedText }}</div>
        </div>
        <div class="h-px bg-border my-2"></div>
        <div>
          <div v-if="isTranslating" class="flex items-center gap-2 p-2 bg-muted text-sm text-muted-foreground">
            <Icon icon="lucide:loader-2" class="animate-spin w-4 h-4" />
            <span>{{ t('common.loading') }}</span>
          </div>
          <div v-else class="p-2 bg-muted text-sm">{{ translatedText }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePresenter } from '@/composables/usePresenter'
import { Button } from '@/components/ui/button'
import { Icon } from '@iconify/vue'

const { t } = useI18n()

const threadPresenter = usePresenter('threadPresenter')

const isTranslateDialogOpen = ref(false)
const selectedText = ref('')
const translatedText = ref('')
const isTranslating = ref(false)

// 窗口位置状态
const translatePosition = ref({ x: 100, y: 100 })

// 拖动相关状态
const isDragging = ref(false)
const currentDragType = ref<'translate' | null>(null)
const dragStart = ref({ x: 0, y: 0 })

const VISIBLE_EDGE = 40 // 保证至少40px可见

// 开始拖动
const startDrag = (type: 'translate') => {
  isDragging.value = true
  currentDragType.value = type
  const event = window.event as MouseEvent
  dragStart.value = {
    x: event.clientX - translatePosition.value.x,
    y: event.clientY - translatePosition.value.y
  }
}

// 处理拖动
const getMaxX = () => window.innerWidth - VISIBLE_EDGE
const getMinX = () => -(500 - VISIBLE_EDGE)
const getMaxY = (ref: HTMLElement | null) => window.innerHeight - VISIBLE_EDGE
const getMinY = (ref: HTMLElement | null) => -((ref?.offsetHeight || 300) - VISIBLE_EDGE)

const handleDrag = (event: MouseEvent) => {
  if (!isDragging.value || !currentDragType.value) return

  let newX = event.clientX - dragStart.value.x
  let newY = event.clientY - dragStart.value.y

  if (currentDragType.value === 'translate') {
    newX = Math.max(getMinX(), Math.min(newX, getMaxX()))
    newY = Math.max(getMinY(translateRef.value), Math.min(newY, getMaxY(translateRef.value)))
    translatePosition.value = { x: newX, y: newY }
  }
}

// 结束拖动
const stopDrag = () => {
  isDragging.value = false
  currentDragType.value = null
}

// 处理翻译事件
const handleTranslate = async (text: string, x?: number, y?: number) => {
  selectedText.value = text
  if (typeof x === 'number' && typeof y === 'number') {
    const dialogWidth = 500
    const dialogHeight = 220
    const posX = x - dialogWidth / 2
    const posY = y - dialogHeight / 2
    translatePosition.value = {
      x: Math.max(0, posX),
      y: Math.max(0, posY)
    }
  }
  isTranslateDialogOpen.value = true
  isTranslating.value = true
  translatedText.value = ''
  try {
    const result = await (threadPresenter as ThreadPresenter).translateText(text)
    translatedText.value = result
  } catch (error) {
    translatedText.value = t('contextMenu.translate.error')
  } finally {
    isTranslating.value = false
  }
}

// 处理AI询问事件
const handleAskAI = (text: string) => {
  window.dispatchEvent(new CustomEvent('context-menu-ask-ai', { detail: text }))
}

// 监听主进程发送的事件
onMounted(() => {
  window.electron.ipcRenderer.on('context-menu-translate', (_, text: string, x?: number, y?: number) => {
    handleTranslate(text, x, y)
  })
  window.electron.ipcRenderer.on('context-menu-ask-ai', (_, text: string) => {
    handleAskAI(text)
  })

  // 添加全局鼠标事件监听
  document.addEventListener('mousemove', handleDrag)
  document.addEventListener('mouseup', stopDrag)
})

// 清理事件监听器
onUnmounted(() => {
  window.electron.ipcRenderer.removeAllListeners('context-menu-translate')
  window.electron.ipcRenderer.removeAllListeners('context-menu-ask-ai')
  document.removeEventListener('mousemove', handleDrag)
  document.removeEventListener('mouseup', stopDrag)
})
</script>

<style scoped>
.cursor-move {
  cursor: move;
}
</style> 
<template>
  <div
    ref="messageNode"
    :data-message-id="message.id"
    :class="['flex flex-row py-4 pl-4 pr-11 group gap-2 w-full', 'justify-start']"
  >
    <ModelIcon
      :model-id="message.model_id"
      custom-class="flex-shrink-0 w-5 h-5 block rounded-md bg-background"
      :alt="message.role"
    />
    <div class="flex flex-col w-full space-y-1.5">
      <MessageInfo :name="message.model_name" :timestamp="message.timestamp" />
      <div
        v-if="currentContent.length === 0"
        class="flex flex-row items-center gap-2 text-xs text-muted-foreground"
      >
        <Icon icon="lucide:loader-circle" class="w-4 h-4 animate-spin" />
        {{ t('chat.messages.thinking') }}
      </div>
      <div v-else class="flex flex-col w-full space-y-2">
        <template v-for="(block, idx) in currentContent" :key="`${message.id}-${idx}`">
          <MessageBlockContent
            v-if="block.type === 'content'"
            :block="block"
            :message-id="message.id"
            :thread-id="currentThreadId"
            :is-search-result="isSearchResult"
          />
          <MessageBlockThink
            v-else-if="block.type === 'reasoning_content'"
            :block="block"
            :usage="message.usage"
          />
          <MessageBlockSearch
            v-else-if="block.type === 'search'"
            :message-id="message.id"
            :block="block"
          />
          <MessageBlockToolCall
            v-else-if="block.type === 'tool_call'"
            :block="block"
            :message-id="message.id"
            :thread-id="currentThreadId"
          />
          <MessageBlockAction
            v-else-if="block.type === 'action'"
            :message-id="message.id"
            :conversation-id="currentThreadId"
            :block="block"
          />
          <MessageBlockImage
            v-else-if="block.type === 'image'"
            :block="block"
            :message-id="message.id"
            :thread-id="currentThreadId"
          />
          <MessageBlockError v-else-if="block.type === 'error'" :block="block" />
        </template>
      </div>
      <MessageToolbar
        :loading="message.status === 'pending'"
        :usage="message.usage"
        :is-assistant="true"
        :current-variant-index="currentVariantIndex"
        :total-variants="totalVariants"
        :is-in-generating-thread="chatStore.generatingThreadIds.has(currentThreadId)"
        :is-capturing-image="isCapturingImage"
        @retry="handleAction('retry')"
        @delete="handleAction('delete')"
        @copy="handleAction('copy')"
        @copyImage="handleAction('copyImage')"
        @prev="handleAction('prev')"
        @next="handleAction('next')"
        @fork="handleAction('fork')"
      />
    </div>
  </div>

  <!-- 分支会话确认对话框 -->
  <Dialog v-model:open="isForkDialogOpen">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{{ t('dialog.fork.title') }}</DialogTitle>
        <DialogDescription>
          {{ t('dialog.fork.description') }}
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline" @click="cancelFork">
          {{ t('dialog.cancel') }}
        </Button>
        <Button variant="default" @click="confirmFork">
          {{ t('dialog.fork.confirm') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, useTemplateRef } from 'vue'
import { AssistantMessage, AssistantMessageBlock } from '@shared/chat'
import MessageBlockContent from './MessageBlockContent.vue'
import MessageBlockThink from './MessageBlockThink.vue'
import MessageBlockSearch from './MessageBlockSearch.vue'
import MessageBlockToolCall from './MessageBlockToolCall.vue'
import MessageBlockError from './MessageBlockError.vue'
import MessageToolbar from './MessageToolbar.vue'
import MessageInfo from './MessageInfo.vue'
import { useChatStore } from '@/stores/chat'
import ModelIcon from '@/components/icons/ModelIcon.vue'
import { Icon } from '@iconify/vue'
import MessageBlockAction from './MessageBlockAction.vue'
import { useI18n } from 'vue-i18n'
import MessageBlockImage from './MessageBlockImage.vue'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { usePresenter } from '@/composables/usePresenter'

const devicePresenter = usePresenter('devicePresenter')
const tabPresenter = usePresenter('tabPresenter')

const appVersion = ref('')
const isCapturingImage = ref(false)

const props = defineProps<{
  message: AssistantMessage
  isDark: boolean
}>()

const chatStore = useChatStore()
const currentVariantIndex = ref(0)
const { t } = useI18n()

const messageNode = useTemplateRef('messageNode')

// 获取当前会话ID
const currentThreadId = computed(() => chatStore.getActiveThreadId() || '')

// 计算当前消息的所有变体（包括缓存中的）
const allVariants = computed(() => {
  const messageVariants = props.message.variants || []
  const combinedVariants = messageVariants.map((variant) => {
    const cachedVariant = Array.from(chatStore.getGeneratingMessagesCache().values()).find(
      (cached) => {
        const msg = cached.message as AssistantMessage
        return msg.is_variant && msg.id === variant.id
      }
    )
    return cachedVariant ? cachedVariant.message : variant
  })
  return combinedVariants
})

// 计算变体总数
const totalVariants = computed(() => allVariants.value.length + 1)

// 获取当前显示的内容
const currentContent = computed(() => {
  if (currentVariantIndex.value === 0) {
    return props.message.content as AssistantMessageBlock[]
  }

  const variant = allVariants.value[currentVariantIndex.value - 1]
  return (variant?.content || props.message.content) as AssistantMessageBlock[]
})

// 监听变体变化
watch(
  () => allVariants.value.length,
  (newLength, oldLength) => {
    // 如果当前没有选中任何变体，或者当前选中的是最后一个变体
    // 则自动跟随最新的变体
    if (currentVariantIndex.value === 0 || newLength > oldLength) {
      currentVariantIndex.value = newLength
    }
    // 如果当前选中的变体超出范围，调整到最后一个变体
    else if (currentVariantIndex.value > newLength) {
      currentVariantIndex.value = newLength
    }
  }
)

const isSearchResult = computed(() => {
  return Boolean(
    currentContent.value?.some((block) => block.type === 'search' && block.status === 'success')
  )
})

onMounted(async () => {
  currentVariantIndex.value = allVariants.value.length
  appVersion.value = await devicePresenter.getAppVersion()
})

// 分支会话对话框
const isForkDialogOpen = ref(false)

// 显示分支对话框
const showForkDialog = () => {
  isForkDialogOpen.value = true
}

// 取消分支
const cancelFork = () => {
  isForkDialogOpen.value = false
}

// 确认分支
const confirmFork = async () => {
  try {
    // 执行fork操作
    await chatStore.forkThread(props.message.id, t('dialog.fork.tag'))
    isForkDialogOpen.value = false
  } catch (error) {
    console.error('创建对话分支失败:', error)
  }
}

/**
 * 查找用户消息DOM元素
 * 通过parentId查找对应的用户消息
 */
const findUserMessageElement = (): HTMLElement | null => {
  if (!props.message.parentId) return null

  // 在DOM中查找包含用户消息ID的元素
  const userMessageSelector = `[data-message-id="${props.message.parentId}"]`
  return document.querySelector(userMessageSelector) as HTMLElement
}

/**
 * 计算包含用户消息和助手消息的整体范围
 */
const calculateMessageGroupRect = (): {
  x: number
  y: number
  width: number
  height: number
} | null => {
  const userMessageElement = findUserMessageElement()
  const assistantMessageElement = messageNode.value

  if (!userMessageElement || !assistantMessageElement) {
    // 如果找不到用户消息，只截取当前助手消息
    if (assistantMessageElement) {
      const rect = assistantMessageElement.getBoundingClientRect()
      return {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      }
    }
    return null
  }

  const userRect = userMessageElement.getBoundingClientRect()
  const assistantRect = assistantMessageElement.getBoundingClientRect()

  // 计算包含两个消息的最小矩形
  const left = Math.min(userRect.left, assistantRect.left)
  const top = Math.min(userRect.top, assistantRect.top)
  const right = Math.max(userRect.right, assistantRect.right)
  const bottom = Math.max(userRect.bottom, assistantRect.bottom)

  return {
    x: Math.round(left),
    y: Math.round(top),
    width: Math.round(right - left),
    height: Math.round(bottom - top)
  }
}

const handleAction = (
  action: 'retry' | 'delete' | 'copy' | 'prev' | 'next' | 'copyImage' | 'fork'
) => {
  if (action === 'retry') {
    chatStore.retryMessage(props.message.id)
  } else if (action === 'delete') {
    chatStore.deleteMessage(props.message.id)
  } else if (action === 'copy') {
    window.api.copyText(
      currentContent.value
        .map((block) => {
          if (block.type === 'reasoning_content' || block.type === 'artifact-thinking') {
            return `<think>${block.content}</think>`
          }
          return block.content
        })
        .join('\n')
    )
  } else if (action === 'prev') {
    if (currentVariantIndex.value > 0) {
      currentVariantIndex.value--
    }
  } else if (action === 'next') {
    if (currentVariantIndex.value < totalVariants.value - 1) {
      currentVariantIndex.value++
    }
  } else if (action === 'copyImage') {
    handleCopyImage()
  } else if (action === 'fork') {
    showForkDialog()
  }
}

/**
 * 处理复制图片操作
 * 使用Vue控制滚动，分段截图后拼接
 */
const handleCopyImage = async () => {
  if (isCapturingImage.value) {
    console.log('正在截图中，请稍候...')
    return
  }

  isCapturingImage.value = true

  try {
    // 计算初始消息区域
    const initialRect = calculateMessageGroupRect()
    if (!initialRect) {
      console.error('无法计算消息区域')
      return
    }

    // 获取当前标签页ID
    const tabId = window.api.getWebContentsId()

    // 保存原始滚动位置
    const originalScrollPosition = {
      top: document.documentElement.scrollTop || document.body.scrollTop,
      left: document.documentElement.scrollLeft || document.body.scrollLeft
    }

    // 临时隐藏不需要的元素（可选）
    const hideSelectors = [
      '.message-toolbar',
      '.input-area',
      '.floating-button',
      '.overlay',
      '.modal',
      '.tooltip'
    ]

    const hideOperations = await hideElementsTemporarily(hideSelectors)

    console.log('开始分段截图...', initialRect)

    // 计算需要的截图区域（避开顶部工具栏和底部输入框）
    const toolbarHeight = 40 // 顶部工具栏高度
    const inputAreaHeight = 60 // 底部输入区域高度
    const captureRect = {
      x: initialRect.x,
      y: toolbarHeight,
      width: initialRect.width,
      height: Math.min(initialRect.height, window.innerHeight - toolbarHeight - inputAreaHeight)
    }

    // 判断是否需要分段截图
    const maxSegmentHeight = Math.floor(window.innerHeight * 0.6) // 每段最大高度
    const needsScrolling = initialRect.height > maxSegmentHeight

    const imageDataList: string[] = []

    if (!needsScrolling) {
      // 不需要滚动，直接截图
      console.log('Single capture')
      const imageData = await tabPresenter.captureTabArea(tabId, captureRect)
      if (imageData) {
        imageDataList.push(imageData)
      }
    } else {
      // 需要分段截图
      console.log('Multiple segments capture')

      // 计算分段
      const segments: Array<{
        x: number
        y: number
        width: number
        height: number
        scrollY: number
        segmentIndex: number
      }> = []
      let currentY = initialRect.y
      let segmentIndex = 0

      while (currentY < initialRect.y + initialRect.height) {
        const remainingHeight = initialRect.y + initialRect.height - currentY
        const segmentHeight = Math.min(maxSegmentHeight, remainingHeight)

        segments.push({
          x: initialRect.x,
          y: currentY,
          width: initialRect.width,
          height: segmentHeight,
          scrollY: currentY,
          segmentIndex: segmentIndex++
        })

        currentY += segmentHeight
      }

      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i]

        // 滚动到目标位置
        document.documentElement.scrollTop = segment.scrollY

        // 等待滚动完成
        await new Promise((resolve) => setTimeout(resolve, 300))

        // 截取当前段
        const segmentData = await tabPresenter.captureTabArea(tabId, {
          x: captureRect.x,
          y: captureRect.y,
          width: captureRect.width,
          height: Math.min(segment.height, captureRect.height)
        })

        if (segmentData) {
          imageDataList.push(segmentData)
          console.log(`Captured segment ${i + 1}/${segments.length}`)
        }
      }
    }

    // 恢复隐藏的元素
    await restoreHiddenElements(hideOperations)

    // 恢复原始滚动位置
    document.documentElement.scrollTop = originalScrollPosition.top
    document.documentElement.scrollLeft = originalScrollPosition.left

    if (imageDataList.length === 0) {
      console.error('没有成功截取任何图片')
      return
    }

    // 拼接图片并添加水印
    const finalImage = await tabPresenter.stitchImagesWithWatermark(imageDataList, {
      isDark: props.isDark,
      version: appVersion.value,
      texts: {
        brand: 'DeepChat',
        tip: t('common.watermarkTip')
      }
    })

    if (finalImage) {
      // 复制到剪贴板
      window.api.copyImage(finalImage)
      console.log('消息截图已复制到剪贴板')
    } else {
      console.error('图片拼接失败')
    }
  } catch (error) {
    console.error('截图时出错:', error)
  } finally {
    isCapturingImage.value = false
  }
}

/**
 * 临时隐藏指定元素
 */
const hideElementsTemporarily = async (selectors: string[]) => {
  const operations: Array<{ element: Element; originalDisplay: string }> = []

  for (const selector of selectors) {
    const elements = document.querySelectorAll(selector)
    elements.forEach((element) => {
      const htmlElement = element as HTMLElement
      const originalDisplay = htmlElement.style.display || ''
      htmlElement.style.display = 'none'
      operations.push({ element, originalDisplay })
    })
  }

  return operations
}

/**
 * 恢复隐藏的元素
 */
const restoreHiddenElements = async (
  operations: Array<{ element: Element; originalDisplay: string }>
) => {
  operations.forEach(({ element, originalDisplay }) => {
    const htmlElement = element as HTMLElement
    htmlElement.style.display = originalDisplay
  })
}

// Expose the handleAction method to parent components
defineExpose({
  handleAction
})
</script>

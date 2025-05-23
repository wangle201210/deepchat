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
 * 使用固定截图窗口，预先规划分段截图策略
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

    // 找到消息列表的滚动容器
    const scrollContainer = messageNode.value?.closest('.overflow-y-auto') as HTMLElement
    if (!scrollContainer) {
      console.error('找不到滚动容器')
      return
    }

    const containerOriginalScrollTop = scrollContainer.scrollTop

    // 定义固定的截图窗口（相对于页面的绝对位置）
    const containerRect = scrollContainer.getBoundingClientRect()
    const toolbarHeight = 40
    const maxSegmentHeight = Math.floor((window.innerHeight - toolbarHeight - 60) * 0.8)

    // 固定截图窗口：容器顶部开始，高度为maxSegmentHeight
    const fixedCaptureWindow = {
      x: containerRect.left,
      y: containerRect.top,
      width: containerRect.width - 9, // 避开右侧滚动条
      height: Math.min(maxSegmentHeight, containerRect.height)
    }

    console.log('固定截图窗口:', fixedCaptureWindow)
    console.log('消息高度:', initialRect.height, '窗口高度:', fixedCaptureWindow.height)

    console.log('开始分段截图...', {
      messageHeight: initialRect.height,
      windowHeight: fixedCaptureWindow.height,
      avoidScrollbar: true
    })
    // 计算消息在容器中的起始位置
    const messageRect = messageNode.value!.getBoundingClientRect()
    const messageTopInContainer = messageRect.top - containerRect.top + containerOriginalScrollTop

    console.log('消息在容器中的起始位置:', messageTopInContainer)

    // ===== 规划阶段：预先计算所有截图段的详细信息 =====
    interface SegmentPlan {
      index: number
      scrollTop: number // 需要滚动到的位置
      captureHeight: number // 截图高度
      messageOffsetStart: number // 在消息中的起始偏移
      messageOffsetEnd: number // 在消息中的结束偏移
    }

    const planSegments = (): SegmentPlan[] => {
      const segments: SegmentPlan[] = []

      // 判断是否需要分段
      if (initialRect.height <= fixedCaptureWindow.height) {
        // 单段截图
        segments.push({
          index: 0,
          scrollTop: messageTopInContainer,
          captureHeight: initialRect.height,
          messageOffsetStart: 0,
          messageOffsetEnd: initialRect.height
        })
        return segments
      }

      // 多段截图：计算最优分段策略
      const totalHeight = initialRect.height
      const segmentHeight = fixedCaptureWindow.height
      const segmentCount = Math.ceil(totalHeight / segmentHeight)

      // 计算滚动容器的边界
      const maxScrollTop = scrollContainer.scrollHeight - scrollContainer.clientHeight

      console.log(`规划 ${segmentCount} 段截图`)

      for (let i = 0; i < segmentCount; i++) {
        const messageOffsetStart = i * segmentHeight
        let messageOffsetEnd = (i + 1) * segmentHeight

        // 最后一段：确保不超出消息范围
        if (i === segmentCount - 1) {
          messageOffsetEnd = totalHeight
        }

        const actualCaptureHeight = messageOffsetEnd - messageOffsetStart
        let scrollTop = messageTopInContainer + messageOffsetStart

        // 确保滚动位置不超出容器边界
        if (scrollTop > maxScrollTop) {
          scrollTop = maxScrollTop
        }

        segments.push({
          index: i,
          scrollTop: scrollTop,
          captureHeight: actualCaptureHeight,
          messageOffsetStart: messageOffsetStart,
          messageOffsetEnd: messageOffsetEnd
        })
      }

      return segments
    }

    const segmentPlans = planSegments()
    console.log('分段计划完成:', segmentPlans.length, '段')

    // ===== 执行阶段：按照规划逐一截图 =====
    const imageDataList: string[] = []

    for (const segment of segmentPlans) {
      console.log(`截图第 ${segment.index + 1}/${segmentPlans.length} 段`)

      // 滚动到目标位置
      scrollContainer.scrollTop = segment.scrollTop

      // 等待滚动完成
      await new Promise((resolve) => setTimeout(resolve, 300))

      // 验证滚动位置
      const actualScrollTop = scrollContainer.scrollTop
      const scrollDiff = Math.abs(actualScrollTop - segment.scrollTop)

      if (scrollDiff > 10) {
        console.warn(`滚动偏差: ${scrollDiff}px`)
      }

      // 重新计算消息在当前滚动位置下的实际位置
      const currentMessageRect = messageNode.value!.getBoundingClientRect()
      const currentContainerRect = scrollContainer.getBoundingClientRect()
      const messageTopInCurrentView = currentMessageRect.top - currentContainerRect.top

      // 验证当前段是否会截取到正确的消息部分
      const expectedMessageTopInView = -segment.messageOffsetStart

      // 计算截图区域
      let captureRect = {
        x: fixedCaptureWindow.x,
        y: fixedCaptureWindow.y,
        width: fixedCaptureWindow.width,
        height: segment.captureHeight
      }

      if (Math.abs(messageTopInCurrentView - expectedMessageTopInView) > 20) {
        console.warn(`位置偏差较大，调整截图区域`)

        // 计算偏差
        const positionOffset = messageTopInCurrentView - expectedMessageTopInView

        // 调整截图区域：如果消息向下偏移了，需要从更下面的位置开始截图
        if (positionOffset > 0) {
          const adjustedY = fixedCaptureWindow.y + positionOffset
          const adjustedHeight = Math.max(segment.captureHeight - positionOffset, 100)

          captureRect = {
            x: fixedCaptureWindow.x,
            y: adjustedY,
            width: fixedCaptureWindow.width,
            height: adjustedHeight
          }

          console.warn(
            `调整Y: ${fixedCaptureWindow.y} -> ${adjustedY}, 高度: ${segment.captureHeight} -> ${adjustedHeight}`
          )
        }
      }

      // 截取当前段
      const segmentData = await tabPresenter.captureTabArea(tabId, captureRect)

      if (segmentData) {
        imageDataList.push(segmentData)
        console.log(`✓ 第 ${segment.index + 1} 段完成`)
      } else {
        console.error(`✗ 第 ${segment.index + 1} 段失败`)
      }
    }

    // 恢复原始滚动位置
    scrollContainer.scrollTop = containerOriginalScrollTop

    if (imageDataList.length === 0) {
      console.error('没有成功截取任何图片')
      return
    }

    console.log(`截图完成，共 ${imageDataList.length} 段，开始拼接...`)

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

// Expose the handleAction method to parent components
defineExpose({
  handleAction
})
</script>

<template>
  <div ref="messageNode" :data-message-id="message.id"
    class="flex flex-row py-4 pl-4 pr-11 group gap-2 w-full justify-start assistant-message-item">
    <ModelIcon :model-id="message.model_id" custom-class="flex-shrink-0 w-5 h-5 block rounded-md bg-background"
      :alt="message.role" />
    <div class="flex flex-col w-full space-y-1.5">
      <MessageInfo :name="message.model_name" :timestamp="message.timestamp" />
      <div v-if="currentContent.length === 0" class="flex flex-row items-center gap-2 text-xs text-muted-foreground">
        <Icon icon="lucide:loader-circle" class="w-4 h-4 animate-spin" />
        {{ t('chat.messages.thinking') }}
      </div>
      <div v-else class="flex flex-col w-full space-y-2">
        <template v-for="(block, idx) in currentContent" :key="`${message.id}-${idx}`">
          <MessageBlockContent v-if="block.type === 'content'" :block="block" :message-id="message.id"
            :thread-id="currentThreadId" :is-search-result="isSearchResult" />
          <MessageBlockThink v-else-if="block.type === 'reasoning_content'" :block="block" :usage="message.usage" />
          <MessageBlockSearch v-else-if="block.type === 'search'" :message-id="message.id" :block="block" />
          <MessageBlockToolCall v-else-if="block.type === 'tool_call'" :block="block" :message-id="message.id"
            :thread-id="currentThreadId" />
          <MessageBlockAction v-else-if="block.type === 'action'" :message-id="message.id"
            :conversation-id="currentThreadId" :block="block" />
          <MessageBlockImage v-else-if="block.type === 'image'" :block="block" :message-id="message.id"
            :thread-id="currentThreadId" />
          <MessageBlockError v-else-if="block.type === 'error'" :block="block" />
        </template>
      </div>
      <MessageToolbar :loading="message.status === 'pending'" :usage="message.usage" :is-assistant="true"
        :current-variant-index="currentVariantIndex" :total-variants="totalVariants"
        :is-in-generating-thread="chatStore.generatingThreadIds.has(currentThreadId)"
        :is-capturing-image="isCapturingImage" @retry="handleAction('retry')" @delete="handleAction('delete')"
        @copy="handleAction('copy')" @copyImage="handleAction('copyImage')" @prev="handleAction('prev')"
        @next="handleAction('next')" @fork="handleAction('fork')" />
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
      const assistantOnlyRect = {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      }
      return assistantOnlyRect
    }
    return null
  }

  const userRect = userMessageElement.getBoundingClientRect()
  const assistantRect = assistantMessageElement.getBoundingClientRect()


  const left = Math.min(userRect.left, assistantRect.left)
  const top = Math.min(userRect.top, assistantRect.top)
  const right = Math.max(userRect.right, assistantRect.right)
  const bottom = Math.max(userRect.bottom, assistantRect.bottom)

  const combinedRect = {
    x: Math.round(left),
    y: Math.round(top),
    width: Math.round(right - left),
    height: Math.round(bottom - top)
  }
  return combinedRect
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
    return
  }
  isCapturingImage.value = true
  let originalScrollBehavior = ''
  let scrollContainer: HTMLElement | null = null

  try {
    const initialRect = calculateMessageGroupRect()
    if (!initialRect) {
      console.error('[CAPTURE_DEBUG] Failed to calculate initialRect')
      isCapturingImage.value = false
      return
    }

    const tabId = window.api.getWebContentsId()
    scrollContainer = document.querySelector('.message-list-container') as HTMLElement
    if (!scrollContainer) {
      console.error('[CAPTURE_DEBUG] Scroll container not found')
      isCapturingImage.value = false
      return
    }

    // Attempt to disable smooth scrolling temporarily
    originalScrollBehavior = scrollContainer.style.scrollBehavior
    scrollContainer.style.scrollBehavior = 'auto'

    const containerOriginalScrollTop = scrollContainer.scrollTop
    const containerRect = scrollContainer.getBoundingClientRect()

    const scrollbarOffset = 20; // Offset to avoid scrollbar
    const captureWindowVisibleHeight = containerRect.height - 44;
    const fixedCaptureWindow = {
      x: containerRect.left,
      y: containerRect.top,
      width: containerRect.width - scrollbarOffset, // Use defined offset
      height: captureWindowVisibleHeight
    };

    const maxScrollTop = scrollContainer.scrollHeight - scrollContainer.clientHeight;

    if (initialRect.height <= 0) {
      isCapturingImage.value = false
      return
    }

    const imageDataList: string[] = []
    let totalCapturedContentHeight = 0
    let iteration = 0


    while (totalCapturedContentHeight < initialRect.height) {
      iteration++;

      const currentActualInitialRect = calculateMessageGroupRect();
      if (!currentActualInitialRect) {
        console.error(`[CAPTURE_DEBUG] Iteration ${iteration}: Failed to get currentActualInitialRect mid-loop!`);
        break;
      }

      const targetContentSegmentTopInCurrentInitialRectY = currentActualInitialRect.y + totalCapturedContentHeight;
      const scrollTopTarget = scrollContainer.scrollTop + targetContentSegmentTopInCurrentInitialRectY - fixedCaptureWindow.y; // fixedCaptureWindow.y IS containerRect.top

      const currentScroll = Math.max(0, Math.min(scrollTopTarget, maxScrollTop));

      scrollContainer.scrollTop = currentScroll;
      await new Promise(resolve => setTimeout(resolve, 350));

      // const actualScrolledTo = scrollContainer.scrollTop;
      // if (Math.abs(actualScrolledTo - currentScroll) > 5 && !(currentScroll === 0 && actualScrolledTo < 5)) { // Allow 0->0.5 without warning
      //   console.warn(`[CAPTURE_DEBUG] Iteration ${iteration}: Scroll position mismatch. Requested: ${currentScroll}, Actual: ${actualScrolledTo}.`);
      // }

      const finalInitialRectStateAfterScroll = calculateMessageGroupRect();
      if (!finalInitialRectStateAfterScroll) {
        console.error(`[CAPTURE_DEBUG] Iteration ${iteration}: Failed to get finalInitialRectStateAfterScroll!`);
        break;
      }
      const finalScRect = scrollContainer.getBoundingClientRect();

      const topOfUncapturedContentInViewport = finalInitialRectStateAfterScroll.y + totalCapturedContentHeight;
      const contentOffsetYInCaptureWindow = topOfUncapturedContentInViewport - finalScRect.top;

      let captureStartYInWindow = 0;
      let heightToCaptureFromSegment = 0;

      if (contentOffsetYInCaptureWindow < 0) {
        captureStartYInWindow = 0;
        heightToCaptureFromSegment = Math.min(
          initialRect.height - totalCapturedContentHeight + contentOffsetYInCaptureWindow,
          fixedCaptureWindow.height
        );
      } else {
        captureStartYInWindow = contentOffsetYInCaptureWindow;
        heightToCaptureFromSegment = Math.min(
          initialRect.height - totalCapturedContentHeight,
          fixedCaptureWindow.height - contentOffsetYInCaptureWindow
        );
      }
      heightToCaptureFromSegment = Math.max(0, heightToCaptureFromSegment);

      if (heightToCaptureFromSegment < 1 && initialRect.height > totalCapturedContentHeight) {
        break
      }

      const captureRect = {
        x: fixedCaptureWindow.x,
        y: Math.round(finalScRect.top + captureStartYInWindow),
        width: fixedCaptureWindow.width, // Ensure using the width from fixedCaptureWindow
        height: Math.round(heightToCaptureFromSegment)
      };

      try {
        const segmentData = await tabPresenter.captureTabArea(tabId, captureRect)
        if (segmentData) {
          imageDataList.push(segmentData)
        } else {
          console.error(`[CAPTURE_DEBUG] Iteration ${iteration}: Segment capture failed (returned no data).`)
          break
        }
      } catch (captureError) {
        console.error(`[CAPTURE_DEBUG] Iteration ${iteration}: Error during captureTabArea:`, captureError)
        break
      }

      totalCapturedContentHeight += heightToCaptureFromSegment
      // Add a small safety break for extremely long content or potential infinite loops.
      if (iteration > 30) {
        console.warn('[CAPTURE_DEBUG] Exceeded 30 iterations, breaking loop as a failsafe.')
        break
      }
    }

    scrollContainer.scrollTop = containerOriginalScrollTop

    if (imageDataList.length === 0 && initialRect.height > 0) {
      console.error('[CAPTURE_DEBUG] No images captured despite content having height.')
      isCapturingImage.value = false
      return
    }
    if (imageDataList.length === 0 && initialRect.height === 0) {
      isCapturingImage.value = false
      return
    }

    if (imageDataList.length > 0) {
      const finalImage = await tabPresenter.stitchImagesWithWatermark(imageDataList, {
        isDark: props.isDark,
        version: appVersion.value,
        texts: {
          brand: 'DeepChat',
          tip: t('common.watermarkTip')
        }
      })

      if (finalImage) {
        window.api.copyImage(finalImage)
      } else {
        console.error('[CAPTURE_DEBUG] Stitching failed or produced no image.')
      }
    }

  } catch (error) {
    console.error('[CAPTURE_DEBUG] General error in handleCopyImage:', error)
  } finally {
    // Restore original scroll behavior in the finally block
    if (scrollContainer && originalScrollBehavior !== undefined) {
      scrollContainer.style.scrollBehavior = originalScrollBehavior
    }
    isCapturingImage.value = false
  }
}

// Expose the handleAction method to parent components
defineExpose({
  handleAction
})
</script>

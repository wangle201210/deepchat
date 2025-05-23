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
    console.log('[CAPTURE_DEBUG] Capture already in progress');
    return;
  }
  console.log('[CAPTURE_DEBUG] Starting handleCopyImage');
  isCapturingImage.value = true;
  let originalScrollBehavior = '';
  let scrollContainer: HTMLElement | null = null;

  try {
    const initialRect = calculateMessageGroupRect();
    if (!initialRect) {
      console.error('[CAPTURE_DEBUG] Failed to calculate initialRect');
      isCapturingImage.value = false;
      return;
    }
    console.log('[CAPTURE_DEBUG] initialRect:', JSON.parse(JSON.stringify(initialRect)));

    const tabId = window.api.getWebContentsId();
    scrollContainer = document.querySelector('.message-list-container') as HTMLElement;
    if (!scrollContainer) {
      console.error('[CAPTURE_DEBUG] Scroll container not found');
      isCapturingImage.value = false;
      return;
    }

    // Attempt to disable smooth scrolling temporarily
    originalScrollBehavior = scrollContainer.style.scrollBehavior;
    scrollContainer.style.scrollBehavior = 'auto';
    console.log(`[CAPTURE_DEBUG] scrollContainer.style.scrollBehavior set to 'auto'. Original: '${originalScrollBehavior}'`);

    const containerOriginalScrollTop = scrollContainer.scrollTop;
    const containerRect = scrollContainer.getBoundingClientRect();
    console.log('[CAPTURE_DEBUG] containerOriginalScrollTop:', containerOriginalScrollTop);
    console.log('[CAPTURE_DEBUG] containerRect:', JSON.parse(JSON.stringify(containerRect)));

    const captureWindowVisibleHeight = containerRect.height - 44;
    const fixedCaptureWindow = {
      x: containerRect.left,
      y: containerRect.top,
      width: containerRect.width - 9,
      height: captureWindowVisibleHeight
    };
    console.log('[CAPTURE_DEBUG] fixedCaptureWindow:', JSON.parse(JSON.stringify(fixedCaptureWindow)));

    const scrollTopForInitialRectTop = initialRect.y - containerRect.top + containerOriginalScrollTop;
    console.log('[CAPTURE_DEBUG] scrollTopForInitialRectTop:', scrollTopForInitialRectTop);

    const maxScrollTop = scrollContainer.scrollHeight - scrollContainer.clientHeight;
    console.log('[CAPTURE_DEBUG] maxScrollTop:', maxScrollTop);

    if (initialRect.height <= 0) {
      console.log('[CAPTURE_DEBUG] initialRect has no height, skipping capture.');
      isCapturingImage.value = false;
      return;
    }

    const imageDataList: string[] = [];
    let totalCapturedContentHeight = 0;
    let iteration = 0;

    console.log(`[CAPTURE_DEBUG] Starting capture loop. initialRect.height: ${initialRect.height}`);

    while (totalCapturedContentHeight < initialRect.height) {
      iteration++;
      console.log(`[CAPTURE_DEBUG] Iteration ${iteration}: totalCapturedContentHeight = ${totalCapturedContentHeight}`);

      const messageGroupElement = messageNode.value;
      if (!messageGroupElement) {
        console.error("[CAPTURE_DEBUG] messageNode.value is null!");
        break;
      }

      const mgRectPreScroll = messageGroupElement.getBoundingClientRect();
      const scRectPreScroll = scrollContainer.getBoundingClientRect();

      const scrollPosOfMessageGroupTop = scrollContainer.scrollTop + (mgRectPreScroll.top - scRectPreScroll.top);
      const scrollTopTarget = scrollPosOfMessageGroupTop + totalCapturedContentHeight;

      console.log(`[CAPTURE_DEBUG] Iteration ${iteration}: mgRectPreScroll.top=${mgRectPreScroll.top}, scRectPreScroll.top=${scRectPreScroll.top}, scrollContainer.scrollTop=${scrollContainer.scrollTop}, scrollPosOfMessageGroupTop=${scrollPosOfMessageGroupTop}`);
      console.log(`[CAPTURE_DEBUG] Iteration ${iteration}: Calculated scrollTopTarget = ${scrollTopTarget}`);

      const currentScroll = Math.max(0, Math.min(scrollTopTarget, maxScrollTop));
      console.log(`[CAPTURE_DEBUG] Iteration ${iteration}: Clamped currentScroll = ${currentScroll}`);

      scrollContainer.scrollTop = currentScroll;
      await new Promise(resolve => setTimeout(resolve, 350));

      const actualScrolledTo = scrollContainer.scrollTop;
      if (Math.abs(actualScrolledTo - currentScroll) > 5 && !(currentScroll === 0 && actualScrolledTo > 50)) { // Keep warning, but don't overwrite if it's the known scrollTop=0 issue
        console.warn(`[CAPTURE_DEBUG] Iteration ${iteration}: Scroll position mismatch. Requested: ${currentScroll}, Actual: ${actualScrolledTo}. Using actual for calculations.`);
        // Do not use actualScrolledTo directly to correct currentScroll if the discrepancy is the known 0 -> large value issue
        // currentScroll = actualScrolledTo;
      }
      console.log(`[CAPTURE_DEBUG] Iteration ${iteration}: Actual scroll position after wait = ${actualScrolledTo}`);

      // Recalculate rects AFTER scrolling to get the true current visual state
      const finalMgRect = messageGroupElement.getBoundingClientRect();
      const finalScRect = scrollContainer.getBoundingClientRect(); // This is effectively fixedCaptureWindow for .y, .width, .height

      // contentOffsetYInCaptureWindow: Y of the current segment's top, relative to the capture window's top.
      // 0 = aligned. Negative = segment top is above window top. Positive = segment top is below window top.
      const contentOffsetYInCaptureWindow = (finalMgRect.top + totalCapturedContentHeight) - finalScRect.top;
      console.log(`[CAPTURE_DEBUG] Iteration ${iteration}: finalMgRect.top=${finalMgRect.top}, totalCapturedContentHeight=${totalCapturedContentHeight}, finalScRect.top=${finalScRect.top}`);
      console.log(`[CAPTURE_DEBUG] Iteration ${iteration}: contentOffsetYInCaptureWindow = ${contentOffsetYInCaptureWindow}`);

      let captureStartYInWindow = 0; // Y-coordinate *within the capture window* where actual capture begins.
      let heightToCaptureFromSegment = 0;

      if (contentOffsetYInCaptureWindow < 0) {
        // Segment top is ABOVE the capture window top.
        captureStartYInWindow = 0; // Start capturing from the top of the window.
        // The amount of the segment that is effectively "lost" above the window is -contentOffsetYInCaptureWindow.
        // The height of the segment actually available *within* the window starts from its top.
        heightToCaptureFromSegment = Math.min(
          initialRect.height - totalCapturedContentHeight + contentOffsetYInCaptureWindow, // Remaining segment height, adjusted for part above window
          fixedCaptureWindow.height // Max height is the window height
        );
      } else {
        // Segment top is AT OR BELOW the capture window top.
        captureStartYInWindow = contentOffsetYInCaptureWindow; // Start capturing from this offset within the window.
        heightToCaptureFromSegment = Math.min(
          initialRect.height - totalCapturedContentHeight, // Max remaining segment height
          fixedCaptureWindow.height - contentOffsetYInCaptureWindow // Max space left in window
        );
      }
      heightToCaptureFromSegment = Math.max(0, heightToCaptureFromSegment);
      console.log(`[CAPTURE_DEBUG] Iteration ${iteration}: captureStartYInWindow=${captureStartYInWindow}, heightToCaptureFromSegment=${heightToCaptureFromSegment}`);

      if (heightToCaptureFromSegment < 1 && initialRect.height > totalCapturedContentHeight) {
        if (iteration > 1 && Math.abs(actualScrolledTo - maxScrollTop) < 5) {
          console.log('[CAPTURE_DEBUG] Iteration > 1, at max scroll, and small slice. Likely end of content.');
        } else {
          console.warn(`[CAPTURE_DEBUG] Iteration ${iteration}: Stalled or minimal slice. SliceH: ${heightToCaptureFromSegment}, TotalCap: ${totalCapturedContentHeight}, InitialH: ${initialRect.height}, Offset: ${contentOffsetYInCaptureWindow}, scroll: ${actualScrolledTo}/${maxScrollTop}`);
        }
        console.log('[CAPTURE_DEBUG] Breaking due to zero or very small slice height.');
        break;
      }

      const captureRect = {
        x: finalScRect.left, // Use finalScRect for x as well, as it represents the capture window
        y: Math.round(finalScRect.top + captureStartYInWindow),
        width: finalScRect.width, // Use finalScRect for width
        height: Math.round(heightToCaptureFromSegment)
      };
      console.log(`[CAPTURE_DEBUG] Iteration ${iteration}: captureRect = ${JSON.stringify(captureRect)}`);

      try {
        const segmentData = await tabPresenter.captureTabArea(tabId, captureRect);
        if (segmentData) {
          imageDataList.push(segmentData);
          console.log(`[CAPTURE_DEBUG] Iteration ${iteration}: Segment captured successfully.`);
        } else {
          console.error(`[CAPTURE_DEBUG] Iteration ${iteration}: Segment capture failed (returned no data).`);
          // If capture fails, we should probably not increment totalCapturedContentHeight with this segment's height
          console.log('[CAPTURE_DEBUG] Breaking loop due to segment capture failure.');
          break;
        }
      } catch (captureError) {
        console.error(`[CAPTURE_DEBUG] Iteration ${iteration}: Error during captureTabArea:`, captureError);
        console.log('[CAPTURE_DEBUG] Breaking loop due to error in captureTabArea.');
        break;
      }

      totalCapturedContentHeight += heightToCaptureFromSegment;
      // Add a small safety break for extremely long content or potential infinite loops.
      if (iteration > 30) {
        console.warn('[CAPTURE_DEBUG] Exceeded 30 iterations, breaking loop as a failsafe.');
        break;
      }
    }
    console.log(`[CAPTURE_DEBUG] Capture loop finished. totalCapturedContentHeight = ${totalCapturedContentHeight}. imageDataList length = ${imageDataList.length}`);

    scrollContainer.scrollTop = containerOriginalScrollTop;
    console.log('[CAPTURE_DEBUG] Restored original scroll top:', containerOriginalScrollTop);

    if (imageDataList.length === 0 && initialRect.height > 0) {
      console.error('[CAPTURE_DEBUG] No images captured despite content having height.');
      isCapturingImage.value = false;
      return;
    }
    if (imageDataList.length === 0 && initialRect.height === 0) {
      console.log('[CAPTURE_DEBUG] Content has no height, no images captured as expected.');
      isCapturingImage.value = false;
      return;
    }

    if (imageDataList.length > 0) {
      console.log('[CAPTURE_DEBUG] Stitching images...');
      const finalImage = await tabPresenter.stitchImagesWithWatermark(imageDataList, {
        isDark: props.isDark,
        version: appVersion.value,
        texts: {
          brand: 'DeepChat',
          tip: t('common.watermarkTip')
        }
      });

      if (finalImage) {
        window.api.copyImage(finalImage);
        console.log('[CAPTURE_DEBUG] Final image stitched and copied to clipboard.');
      } else {
        console.error('[CAPTURE_DEBUG] Stitching failed or produced no image.');
      }
    } else {
      console.log('[CAPTURE_DEBUG] No images in list to stitch.');
    }

  } catch (error) {
    console.error('[CAPTURE_DEBUG] General error in handleCopyImage:', error);
  } finally {
    // Restore original scroll behavior in the finally block
    if (scrollContainer && originalScrollBehavior !== undefined) {
      scrollContainer.style.scrollBehavior = originalScrollBehavior;
      console.log(`[CAPTURE_DEBUG] scrollContainer.style.scrollBehavior restored to '${originalScrollBehavior}'`);
    }
    isCapturingImage.value = false;
    console.log('[CAPTURE_DEBUG] handleCopyImage finished.');
  }
}

// Expose the handleAction method to parent components
defineExpose({
  handleAction
})
</script>

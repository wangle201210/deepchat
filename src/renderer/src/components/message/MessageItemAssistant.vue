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
 * 使用固定截图窗口，滚动内容进行分段截图
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

    console.log('开始分段截图...', initialRect)

    // 定义固定的截图窗口（相对于页面的绝对位置）
    const containerRect = scrollContainer.getBoundingClientRect()
    const toolbarHeight = 40
    const maxSegmentHeight = Math.floor((window.innerHeight - toolbarHeight - 60) * 0.8)

    // 固定截图窗口：容器顶部开始，高度为maxSegmentHeight
    const fixedCaptureWindow = {
      x: containerRect.left,
      y: containerRect.top,
      width: containerRect.width,
      height: Math.min(maxSegmentHeight, containerRect.height)
    }

    console.log('固定截图窗口:', fixedCaptureWindow)
    console.log('消息高度:', initialRect.height, '窗口高度:', fixedCaptureWindow.height)

    const imageDataList: string[] = []

    // 判断是否需要分段
    const needsScrolling = initialRect.height > fixedCaptureWindow.height

    if (!needsScrolling) {
      // 不需要滚动，直接截图
      console.log('Single capture')
      const imageData = await tabPresenter.captureTabArea(tabId, fixedCaptureWindow)
      if (imageData) {
        imageDataList.push(imageData)
      }
    } else {
      // 需要分段截图
      console.log('Multiple segments capture')

      // 计算需要多少段
      const totalSegments = Math.ceil(initialRect.height / fixedCaptureWindow.height)
      console.log(`总共需要 ${totalSegments} 段`)

      // 计算消息在容器中的起始位置
      const messageRect = messageNode.value!.getBoundingClientRect()
      const messageTopInContainer = messageRect.top - containerRect.top + containerOriginalScrollTop

      for (let segmentIndex = 0; segmentIndex < totalSegments; segmentIndex++) {
        // 计算需要滚动到的位置：让消息的对应部分出现在固定窗口的顶部
        const segmentOffsetInMessage = segmentIndex * fixedCaptureWindow.height
        const targetScrollTop = messageTopInContainer + segmentOffsetInMessage

        console.log(`第 ${segmentIndex + 1} 段: 计划滚动到 ${targetScrollTop}`)

        // 记录滚动前的位置
        const beforeScrollTop = scrollContainer.scrollTop

        // 滚动到目标位置
        scrollContainer.scrollTop = targetScrollTop

        // 等待滚动完成
        await new Promise((resolve) => setTimeout(resolve, 300))

        // 获取实际滚动后的位置
        const actualScrollTop = scrollContainer.scrollTop
        const actualScrollDistance = actualScrollTop - beforeScrollTop

        console.log(
          `第 ${segmentIndex + 1} 段: 计划滚动 ${targetScrollTop - beforeScrollTop}, 实际滚动 ${actualScrollDistance}`
        )

        // 如果是最后一段，需要调整截图高度避免重复
        let captureHeight = fixedCaptureWindow.height

        if (segmentIndex === totalSegments - 1) {
          // 最后一段：计算剩余的消息高度
          const remainingMessageHeight =
            initialRect.height - segmentIndex * fixedCaptureWindow.height
          captureHeight = Math.min(remainingMessageHeight, fixedCaptureWindow.height)
          console.log(
            `最后一段调整高度: ${captureHeight} (剩余消息高度: ${remainingMessageHeight})`
          )
        } else if (actualScrollDistance < fixedCaptureWindow.height * 0.5) {
          // 如果实际滚动距离太少，说明已经到底部了，调整截图高度
          captureHeight = Math.max(actualScrollDistance, fixedCaptureWindow.height * 0.3)
          console.log(`滚动距离不足，调整高度: ${captureHeight}`)
        }

        // 截图区域
        const captureRect = {
          x: fixedCaptureWindow.x,
          y: fixedCaptureWindow.y,
          width: fixedCaptureWindow.width,
          height: captureHeight
        }

        console.log(`第 ${segmentIndex + 1} 段截图区域:`, captureRect)

        // 截取当前段
        const segmentData = await tabPresenter.captureTabArea(tabId, captureRect)

        if (segmentData) {
          imageDataList.push(segmentData)
          console.log(segmentData)
          console.log(`成功截取第 ${segmentIndex + 1}/${totalSegments} 段`)
        } else {
          console.error(`第 ${segmentIndex + 1} 段截图失败`)
        }
      }
    }

    // 恢复原始滚动位置
    scrollContainer.scrollTop = containerOriginalScrollTop

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

// Expose the handleAction method to parent components
defineExpose({
  handleAction
})
</script>

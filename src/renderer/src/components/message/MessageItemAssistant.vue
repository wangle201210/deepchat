<template>
  <div
    ref="messageNode"
    :class="['flex flex-row py-4 pl-4 pr-11 group gap-2 w-full', 'justify-start']"
  >
    <ModelIcon
      :model-id="message.model_id"
      custom-class="flex-shrink-0 w-5 h-5 block rounded-md bg-background"
      :alt="message.role"
    />
    <div class="flex flex-col w-full space-y-1.5">
      <MessageInfo :name="message.model_name" :timestamp="message.timestamp" />
      <!-- 消息内容 -->
      <div
        v-if="currentContent.length === 0"
        class="flex flex-row items-center gap-2 text-xs text-muted-foreground"
      >
        <Icon icon="lucide:loader-circle" class="w-4 h-4 animate-spin" />
        正在思考...
      </div>
      <div v-else class="flex flex-col w-full space-y-2">
        <div v-for="block in currentContent" :key="block.id" class="w-full">
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
          <MessageBlockError v-else-if="block.type === 'error'" :block="block" />
        </div>
      </div>
      <MessageToolbar
        :loading="message.status === 'pending'"
        :usage="message.usage"
        :is-assistant="true"
        :current-variant-index="currentVariantIndex"
        :total-variants="totalVariants"
        @retry="handleAction('retry')"
        @delete="handleAction('delete')"
        @copy="handleAction('copy')"
        @copyImage="handleAction('copyImage')"
        @prev="handleAction('prev')"
        @next="handleAction('next')"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, useTemplateRef } from 'vue'
import { AssistantMessage } from '@shared/chat'
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
import { toBlob } from 'html-to-image'
import { useDark } from '@vueuse/core'
import MessageBlockAction from './MessageBlockAction.vue'
const props = defineProps<{
  message: AssistantMessage
}>()

const isDark = useDark()
const chatStore = useChatStore()
const currentVariantIndex = ref(0)

const messageNode = useTemplateRef('messageNode')

// 获取当前会话ID
const currentThreadId = computed(() => chatStore.activeThreadId || '')

// 计算当前消息的所有变体（包括缓存中的）
const allVariants = computed(() => {
  const messageVariants = props.message.variants || []
  const combinedVariants = messageVariants.map((variant) => {
    const cachedVariant = Array.from(chatStore.generatingMessagesCache.values()).find((cached) => {
      const msg = cached.message as AssistantMessage
      return msg.is_variant && msg.id === variant.id
    })
    return cachedVariant ? cachedVariant.message : variant
  })
  return combinedVariants
})

// 计算变体总数
const totalVariants = computed(() => allVariants.value.length + 1)

// 获取当前显示的内容
const currentContent = computed(() => {
  if (currentVariantIndex.value === 0) {
    return props.message.content
  }

  const variant = allVariants.value[currentVariantIndex.value - 1]
  return variant?.content || props.message.content
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

onMounted(() => {
  // 默认显示最后一个变体
  currentVariantIndex.value = allVariants.value.length
})
const filterDom = (node: HTMLElement) => {
  return !node.classList?.contains('message-toolbar')
}
const handleAction = (action: 'retry' | 'delete' | 'copy' | 'prev' | 'next' | 'copyImage') => {
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
    if (messageNode.value) {
      toBlob(messageNode.value, {
        quality: 1,
        backgroundColor: isDark.value ? '#000000' : '#FFFFFF',
        filter: filterDom
      }).then((blob) => {
        if (blob) {
          const rd = new FileReader()
          rd.onloadend = () => {
            const url = rd.result as string
            window.api.copyImage(url)
          }
          rd.readAsDataURL(blob)
        }
      })
    }
  }
}

// Expose the handleAction method to parent components
defineExpose({
  handleAction
})
</script>

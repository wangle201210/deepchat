<template>
  <div
    draggable="true"
    class="text-xs font-medium pl-2 pr-1 h-7 mt-0.5 rounded-md flex items-center justify-between transition-all duration-200 group"
    :class="[
      active
        ? 'bg-background shadow-sm'
        : 'bg-transparent text-muted-foreground hover:bg-zinc-500/20 active:bg-zinc-900/20'
    ]"
    @dragstart="onDragStart"
    @click="onClick"
  >
    <div
      class="flex items-center truncate"
      :class="[isSmall ? 'max-w-4 overflow-hidden justify-start truncate' : 'max-w-36 truncate']"
    >
      <slot></slot>
    </div>
    <button
      class="ml-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-full hover:bg-zinc-500/20 p-0.5"
      @click.stop="onClose"
    >
      <Icon icon="lucide:x" class="w-3 h-3" />
    </button>
  </div>
</template>
<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed } from 'vue'
import { useWindowSize } from '@vueuse/core'

const emit = defineEmits<{
  (e: 'click'): void
  (e: 'close'): void
  (e: 'dragstart', event: DragEvent): void
}>()

const props = defineProps<{
  active: boolean
  size: number
  index: number
}>()
const { width } = useWindowSize()
const isSmall = computed(() => {
  const totalWidth = props.size * 144 // 每个标签页最大宽度为144px
  const screenWidth = width.value
  return totalWidth > screenWidth * 0.8 && props.index !== props.size - 1
})

const onClick = () => {
  emit('click')
}

const onClose = () => {
  emit('close')
}

const onDragStart = (event: DragEvent) => {
  emit('dragstart', event)
}
</script>

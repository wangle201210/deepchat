<template>
  <div
    ref="tabItem"
    draggable="true"
    class="flex-shrink-0 text-xs font-medium pl-2 pr-1 h-7 mt-0.5 rounded-md flex items-center justify-between transition-all duration-200 group"
    :class="[
      active
        ? 'bg-background shadow-sm'
        : 'bg-transparent text-secondary-foreground hover:bg-zinc-500/20 active:bg-zinc-900/20'
    ]"
    @dragstart="onDragStart"
    @click="onClick"
  >
    <div class="flex items-center truncate max-w-36">
      <slot></slot>
    </div>
    <button
      class="ml-2 opacity-0 transition-opacity duration-200 rounded-full hover:bg-zinc-500/20 p-0.5"
      :class="[index > 0 ? 'group-hover:opacity-100' : '']"
      @click.stop="onClose"
    >
      <Icon icon="lucide:x" class="w-3 h-3" />
    </button>
  </div>
</template>
<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { ref } from 'vue'

const tabItem = ref<HTMLElement | null>(null)

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

const onClick = () => {
  emit('click')

  if (tabItem.value instanceof HTMLElement) {
    setTimeout(() => {
      tabItem.value?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 100)
  }
}

const onClose = () => {
  if (props.index > 0) {
    emit('close')
  }
}

const onDragStart = (event: DragEvent) => {
  emit('dragstart', event)
}
</script>

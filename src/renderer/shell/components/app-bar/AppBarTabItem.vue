<template>
  <div
    class="text-xs font-medium px-3 h-7 rounded-md flex items-center justify-between transition-all duration-200 group"
    :class="[
      active
        ? 'bg-card shadow-sm'
        : 'bg-transparent text-muted-foreground hover:bg-zinc-500/20 active:bg-zinc-900/20'
    ]"
  >
    <div class="flex items-center justify-center" @click="onClick">
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

const emit = defineEmits<{
  (e: 'click'): void
  (e: 'close'): void
}>()

defineProps<{
  active: boolean
}>()

const onClick = () => {
  emit('click')
}

const onClose = () => {
  emit('close')
}
</script>

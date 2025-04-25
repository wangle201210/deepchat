<template>
  <div
    class="text-xs font-medium px-3 h-7 rounded-md flex items-center justify-center transition-all duration-200"
    :class="[
      active
        ? 'bg-card shadow-sm'
        : 'bg-transparent text-muted-foreground hover:bg-zinc-500/20 active:bg-zinc-900/20'
    ]"
    @click="onClick"
  >
    <slot></slot>
  </div>
</template>
<script setup lang="ts">
const emit = defineEmits<{
  (e: 'click'): void
}>()

defineProps<{
  active: boolean
}>()

const onClick = () => {
  emit('click')
}
</script>

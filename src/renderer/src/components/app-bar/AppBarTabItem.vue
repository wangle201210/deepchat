<template>
  <div
    class="text-xs font-medium px-3 h-7 rounded-md flex items-center justify-center"
    :class="[active ? 'bg-card shadow-sm' : 'bg-transparent']"
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

<template>
  <span class="whitespace-pre-wrap break-all">{{ props.node.content }}</span>
</template>

<script setup lang="ts">
const props = defineProps<{
  node: {
    type: 'text'
    content: string
    raw: string
  }
  messageId: string
  threadId?: string
}>()

defineEmits(['copy'])
</script>

<style scoped></style>

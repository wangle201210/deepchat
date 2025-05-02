<template>
  {{ props.node.content }}
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

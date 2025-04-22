<template>
  <span>{{ props.node.raw }}</span>
</template>

<script setup lang="ts">
const props = defineProps<{
  node: {
    type: 'text'
    content: string
    raw: string
  }
  messageId: string
}>()
</script>

<style scoped></style>

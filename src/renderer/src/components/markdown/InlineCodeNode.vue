<template>
  <code class="inline-code-node">{{ node.code }}</code>
</template>

<script setup lang="ts">
defineProps<{
  node: {
    type: 'inline_code'
    code: string
    raw: string
  }
  messageId: string
}>()
</script>

<style scoped>
.inline-code-node {
  padding: 0.2em 0.4em;
  border-radius: 3px;
  font-family:
    ui-monospace,
    SFMono-Regular,
    SF Mono,
    Menlo,
    Consolas,
    Liberation Mono,
    monospace;
  font-size: 0.85em;
  background-color: rgba(175, 184, 193, 0.2);
}
</style>

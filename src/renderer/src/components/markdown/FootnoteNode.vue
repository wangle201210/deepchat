<template>
  <div class="footnote" :id="`footnote-${node.id}`">
    <span class="footnote-id">[{{ node.id }}]</span>
    <div class="footnote-content">
      <NodeRenderer
        :nodes="node.children"
        :message-id="messageId"
        :thread-id="threadId"
        @copy="$emit('copy', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import NodeRenderer from './NodeRenderer.vue'

// 定义脚注节点
interface FootnoteNode {
  type: 'footnote'
  id: string
  children: { type: string; raw: string }[]
  raw: string
}

// 接收props
defineProps<{
  node: FootnoteNode
  messageId?: string
  threadId?: string
}>()

// 定义事件
defineEmits(['copy'])
</script>

<style scoped>
.footnote {
  display: flex;
  margin: 0.5rem 0;
  font-size: 0.9rem;
  line-height: 1.5;
  border-top: 1px solid #eaecef;
  padding-top: 0.5rem;
}

.footnote-id {
  font-weight: 600;
  margin-right: 0.5rem;
  color: #0366d6;
}

.footnote-content {
  flex: 1;
}
</style>

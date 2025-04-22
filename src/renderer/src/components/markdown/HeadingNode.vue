<template>
  <component :is="`h${node.level}`" class="heading-node" :class="[`heading-${node.level}`]">
    <component
      v-for="(child, index) in node.children"
      :key="index"
      :is="nodeComponents[child.type]"
      :node="child"
      :message-id="messageId"
    />
  </component>
</template>

<script setup lang="ts">
import TextNode from './TextNode.vue'
import InlineCodeNode from './InlineCodeNode.vue'

// Define the type for the node children
interface NodeChild {
  type: string
  raw: string
  [key: string]: unknown
}

defineProps<{
  node: {
    type: 'heading'
    level: number
    text: string
    children: NodeChild[]
    raw: string
  }
  messageId: string
}>()

const nodeComponents = {
  text: TextNode,
  inline_code: InlineCodeNode
  // 添加其他内联元素组件
}
</script>

<style scoped>
.heading-node {
  font-weight: 600;
  line-height: 1.25;
}

.heading-1 {
  margin-top: 1.5em;
  margin-bottom: 0.5em;
  font-size: 2em;
}

.heading-2 {
  margin-top: 1.25em;
  margin-bottom: 0.5em;
  font-size: 1.5em;
}

.heading-3 {
  margin-top: 1em;
  margin-bottom: 0.5em;
  font-size: 1.25em;
}

.heading-4 {
  margin-top: 1em;
  margin-bottom: 0.5em;
  font-size: 1em;
}

.heading-5 {
  margin-top: 0.875em;
  margin-bottom: 0.5em;
  font-size: 0.875em;
}

.heading-6 {
  margin-top: 0.85em;
  margin-bottom: 0.5em;
  font-size: 0.85em;
  color: #6a737d;
}
</style>

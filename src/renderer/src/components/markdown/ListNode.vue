<template>
  <component :is="node.ordered ? 'ol' : 'ul'" class="list-node">
    <li v-for="(item, index) in node.items" :key="index" class="list-item">
      <component
        v-for="(child, childIndex) in item.children"
        :is="nodeComponents[child.type]"
        :key="childIndex"
        :node="child"
        :message-id="messageId"
      />
    </li>
  </component>
</template>

<script setup lang="ts">
import TextNode from './TextNode.vue'
import ParagraphNode from './ParagraphNode.vue'
import InlineCodeNode from './InlineCodeNode.vue'
import LinkNode from './LinkNode.vue'
import ImageNode from './ImageNode.vue'
import StrongNode from './StrongNode.vue'
import EmphasisNode from './EmphasisNode.vue'
import StrikethroughNode from './StrikethroughNode.vue'
import HighlightNode from './HighlightNode.vue'
import InsertNode from './InsertNode.vue'
import SubscriptNode from './SubscriptNode.vue'
import SuperscriptNode from './SuperscriptNode.vue'
import EmojiNode from './EmojiNode.vue'
import CheckboxNode from './CheckboxNode.vue'
import FootnoteReferenceNode from './FootnoteReferenceNode.vue'
import HardBreakNode from './HardBreakNode.vue'
import CodeBlockNode from './CodeBlockNode.vue'
import ListNode from './ListNode.vue'
// 节点子元素类型
interface NodeChild {
  type: string
  raw: string
  [key: string]: unknown
}

// 列表项类型
interface ListItem {
  type: 'list_item'
  children: NodeChild[]
  raw: string
}

defineProps<{
  node: {
    type: 'list'
    ordered: boolean
    items: ListItem[]
    raw: string
  }
  messageId: string
}>()

// 可用的节点组件
const nodeComponents = {
  text: TextNode,
  paragraph: ParagraphNode,
  inline_code: InlineCodeNode,
  link: LinkNode,
  image: ImageNode,
  strong: StrongNode,
  emphasis: EmphasisNode,
  strikethrough: StrikethroughNode,
  highlight: HighlightNode,
  insert: InsertNode,
  subscript: SubscriptNode,
  superscript: SuperscriptNode,
  emoji: EmojiNode,
  checkbox: CheckboxNode,
  footnote_reference: FootnoteReferenceNode,
  hardbreak: HardBreakNode,
  code_block: CodeBlockNode,
  list: ListNode
  // 其他节点类型
}
</script>

<style scoped>
.list-node {
  margin: 1rem 0;
  padding-left: 2rem;
}

.list-item {
  margin-bottom: 0.5rem;
}

/* 有序列表样式 */
ol.list-node {
  list-style-type: decimal;
}

/* 无序列表样式 */
ul.list-node {
  list-style-type: disc;
}
</style>

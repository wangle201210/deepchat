<!-- eslint-disable vue/no-v-html -->
<template>
  <NodeRenderer :customComponents="nodeComponents" :content="content" :message-id="messageId" :thread-id="threadId"
    @copy="$emit('copy', $event)" />
</template>
<script setup lang="ts">
  import NodeRenderer, { CodeBlockNode } from 'vue-renderer-markdown'
  import ReferenceNode from './ReferenceNode.vue'
  import { h } from 'vue'
  import { useArtifactStore } from '@/stores/artifact'

  const props = defineProps<{
    content: string
    messageId: string
    threadId?: string
    debug?: boolean
  }>()

  // 组件映射表
  const artifactStore = useArtifactStore()
  const nodeComponents = {
    reference: ReferenceNode,
    code_block: (_props) => h(CodeBlockNode, {
      ..._props,
      onPreviewCode(v) {
        const messageId = props.messageId || props['message-id']
        const threadId = props.threadId || props['thread-id']
        if (!messageId || !threadId)
          return
        artifactStore.showArtifact(
          {
            id: v.id,
            type: v.artifactType,
            title: v.artifactTitle,
            content: v.node.code,
            status: 'loaded',
          },
          messageId,
          threadId,
        )
      }
    })
  }



  defineEmits(['copy'])

</script>
<style>
  .prose {
    li p {
      @apply py-0 my-0;
    }

    hr {
      margin-block-start: 0.5em;
      margin-block-end: 0.5em;
      margin-inline-start: auto;
      margin-inline-end: auto;
    }
  }
</style>

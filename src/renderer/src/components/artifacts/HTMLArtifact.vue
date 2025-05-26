<template>
  <div class="w-full h-full overflow-auto">
    <iframe
      ref="iframeRef"
      :srcdoc="block.content"
      class="w-full h-full min-h-[400px] html-iframe-wrapper"
      sandbox="allow-scripts allow-same-origin"
    ></iframe>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
// import DOMPurify from 'dompurify'

const props = defineProps<{
  block: {
    artifact: {
      type: string
      title: string
    }
    content: string
  }
  isPreview: boolean
}>()

const iframeRef = ref<HTMLIFrameElement>()

// const sanitizedContent = computed(() => {
//   if (!props.block.content) return ''
//   return DOMPurify.sanitize(props.block.content, {
//     WHOLE_DOCUMENT: true,
//     ADD_TAGS: ['script', 'style'],
//     ADD_ATTR: ['src', 'style', 'onclick'],
//     ALLOWED_URI_REGEXP:
//       /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp|xxx):|[^a-z]|[a-z+.]+(?:[^a-z+.:]|$))/i
//   })
// })

onMounted(() => {
  if (props.isPreview && iframeRef.value) {
    const iframe = iframeRef.value
    iframe.onload = () => {
      // 移除动态高度调整，让外层容器控制滚动
      const resetCSS = `
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      html, body {
        height: 100%;
        font-family: Arial, sans-serif;
      }
      img {
        max-width: 100%;
        height: auto;
      }
      a {
        text-decoration: none;
        color: inherit;
      }
    `
      const styleElement = document.createElement('style')
      styleElement.textContent = resetCSS
      iframeRef.value?.contentDocument?.head.appendChild(styleElement)
    }
  }
})
</script>

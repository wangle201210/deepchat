<template>
  <div class="w-full h-full flex flex-col overflow-hidden">
    <iframe
      v-if="props.isPreview"
      :srcdoc="iframeSrcdoc"
      class="w-full h-full border-0"
      sandbox=""
    ></iframe>
    <div v-else class="h-full p-4">
      <pre
        class="rounded-lg bg-muted p-4 h-full m-0 overflow-auto"
      ><code class="font-mono text-sm leading-6 h-full block">{{ props.block.content }}</code></pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import mermaid from 'mermaid'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

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

// Rendered SVG content
const renderedSvg = ref('')
const renderError = ref('')

// Detect current theme from document
const isDarkTheme = computed(() => {
  return document.documentElement.classList.contains('dark')
})

// Initialize mermaid
onMounted(() => {
  mermaid.initialize({
    startOnLoad: false,
    theme: isDarkTheme.value ? 'dark' : 'default',
    securityLevel: 'strict',
    fontFamily: 'system-ui, -apple-system, sans-serif'
  })

  if (props.isPreview && props.block.content) {
    renderDiagram()
  }
})

// Render mermaid diagram to SVG using the built-in library
const renderDiagram = async () => {
  if (!props.block.content) {
    renderedSvg.value = ''
    return
  }

  try {
    renderError.value = ''
    // Generate unique ID for each render
    const id = `mermaid-${Date.now()}`
    const { svg } = await mermaid.render(id, props.block.content)
    renderedSvg.value = svg
  } catch (error) {
    console.error('Failed to render mermaid diagram:', error)
    const msg = error instanceof Error ? error.message : t('common.unknownError')
    renderError.value = t('artifacts.mermaid.renderError', { message: msg })
    renderedSvg.value = ''
  }
}

// Watch for content changes
watch([() => props.block.content, () => props.isPreview], ([, newIsPreview]) => {
  if (newIsPreview) {
    renderDiagram()
  }
})

// Generate the srcdoc content for the iframe
// SVG is pre-rendered, iframe is purely for display isolation
const iframeSrcdoc = computed(() => {
  const bgColor = isDarkTheme.value ? '#1a1a1a' : '#ffffff'
  const textColor = isDarkTheme.value ? '#e5e5e5' : '#333333'

  if (renderError.value) {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      margin: 0;
      padding: 16px;
      background-color: ${bgColor};
      color: #ef4444;
      font-family: system-ui, -apple-system, sans-serif;
    }
  </style>
</head>
<body>${renderError.value}</body>
</html>`
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      height: 100%;
      background-color: ${bgColor};
      color: ${textColor};
    }
    body {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 16px;
    }
    svg {
      max-width: 100%;
      max-height: calc(100vh - 32px);
    }
  </style>
</head>
<body>${renderedSvg.value}</body>
</html>`
})
</script>

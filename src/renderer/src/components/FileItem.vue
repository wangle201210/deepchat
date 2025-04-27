<template>
  <div
    class="inline-flex flex-row bg-card border items-center justify-start rounded-md text-xs cursor-pointer select-none overflow-hidden"
    @click="$emit('click', fileName)"
  >
    <span class="flex flex-row gap-1 items-center hover:bg-accent px-2 py-1">
      <Icon :icon="getFileIcon()" class="w-4 h-4 text-muted-foreground" />
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger as-child>
            <span class="max-w-28 truncate">{{ fileName }}</span>
          </TooltipTrigger>
          <TooltipContent>
            <p>{{ tokens }} tokens</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </span>

    <span v-if="deletable" class="h-3 w-[1px] bg-border"></span>
    <span
      v-if="deletable"
      class="hover:bg-accent px-2 h-full flex items-center justify-center"
      @click.stop.prevent="$emit('delete', fileName)"
    >
      <Icon icon="lucide:x" class="w-3 h-3 text-muted-foreground" />
    </span>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

const props = withDefaults(
  defineProps<{
    fileName: string
    deletable: boolean
    mimeType?: string
    tokens: number
  }>(),
  {
    mimeType: 'text/plain'
  }
)

defineEmits<{
  click: [fileName: string]
  delete: [fileName: string]
}>()

const getFileIcon = () => {
  // 根据 MIME 类型返回对应的图标
  if (
    props.mimeType.startsWith('text/plain') ||
    props.mimeType.startsWith('application/json') ||
    props.mimeType.startsWith('application/javascript') ||
    props.mimeType.startsWith('application/typescript')
  ) {
    return 'vscode-icons:file-type-text'
  } else if (props.mimeType.startsWith('text/csv')) {
    return 'vscode-icons:file-type-excel'
  } else if (
    props.mimeType.startsWith('application/vnd.ms-excel') ||
    props.mimeType.includes('spreadsheet') ||
    props.mimeType.includes('numbers')
  ) {
    return 'vscode-icons:file-type-excel'
  } else if (props.mimeType.startsWith('text/markdown')) {
    return 'vscode-icons:file-type-markdown'
  } else if (props.mimeType.startsWith('application/x-yaml')) {
    return 'vscode-icons:file-type-yaml'
  } else if (
    props.mimeType.startsWith('application/xml') ||
    props.mimeType.startsWith('application/xhtml+xml')
  ) {
    return 'vscode-icons:file-type-xml'
  } else if (props.mimeType.startsWith('application/pdf')) {
    return 'vscode-icons:file-type-pdf2'
  } else if (props.mimeType.startsWith('image/')) {
    return 'vscode-icons:file-type-image'
  } else if (
    props.mimeType.startsWith('application/msword') ||
    props.mimeType.includes('wordprocessingml')
  ) {
    return 'vscode-icons:file-type-word'
  } else if (
    props.mimeType.startsWith('application/vnd.ms-powerpoint') ||
    props.mimeType.includes('presentationml')
  ) {
    return 'vscode-icons:file-type-powerpoint'
  } else if (props.mimeType.startsWith('text/html')) {
    return 'vscode-icons:file-type-html'
  } else if (props.mimeType.startsWith('text/css')) {
    return 'vscode-icons:file-type-css'
  } else if (props.mimeType.startsWith('audio/')) {
    return 'vscode-icons:file-type-audio'
  } else {
    // 默认文件图标
    return 'vscode-icons:default-file'
  }
}
</script>

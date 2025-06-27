<template>
  <div
    class="flex px-3 py-2 gap-2 flex-row bg-card border items-center shadow-sm justify-start rounded-md text-base select-none hover:bg-accent"
  >
    <img v-if="thumbnail" :src="thumbnail" class="w-10 h-10 rounded-md border" />
    <Icon
      v-else
      :icon="getFileIcon()"
      class="w-10 h-10 text-muted-foreground p-1 bg-accent rounded-md border"
    />

    <div class="flex-grow flex-1">
      <div class="text-sm leading-none pb-2 truncate text-ellipsis whitespace-nowrap">
        {{ fileName }}
      </div>
      <div
        class="text-xs leading-none text-muted-foreground truncate text-ellipsis whitespace-nowrap"
      >
        {{ uploadTime }} . {{ formatFileSize(fileSize) }}
      </div>
    </div>
    <div class="ml-auto flex align-center">
      <Button
        variant="ghost"
        size="icon"
        class="h-7 w-7 flex items-center justify-center rounded-full hover:bg-blue-100 transition-colors"
        :title="success ? '已完成' : '未完成'"
      >
        <Icon v-if="success" icon="lucide:circle-check-big" class="text-base text-green-500" />
        <Icon v-else icon="lucide:circle-alert" class="text-base text-yellow-500" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        class="h-7 w-7 flex items-center justify-center rounded-full hover:bg-blue-100 transition-colors"
        title="删除"
        @click="deleteFile"
      >
        <Icon icon="lucide:trash" class="text-base text-red-600" />
      </Button>

      <!-- 看看cherry的刷新做了什么 -->

      <!-- 再判断这个刷新按钮保留与否   -->
      <!-- <Button
                variant="ghost"
                size="icon"
                class="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted"
                title="设置"
              >
                <Icon icon="lucide:edit" class="w-4 h-4" />
              </Button> -->
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'

const props = withDefaults(
  defineProps<{
    fileName: string
    mimeType?: string
    tokens: number
    thumbnail?: string
    fileSize: number
    uploadTime: string
    success?: boolean
  }>(),
  {
    mimeType: 'text/plain'
  }
)

const emit = defineEmits<{
  delete: []
}>()

// 删除文件
const deleteFile = () => {
  emit('delete')
}

// 文件大小的单位转换
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(2) + ' MB'
  return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB'
}

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
  } else if (props.mimeType.startsWith('directory')) {
    return 'vscode-icons:default-folder-opened'
  } else {
    // 默认文件图标
    return 'vscode-icons:default-file'
  }
}
</script>

<template>
  <div
    class="flex px-3 py-2 gap-2 flex-row bg-card border items-center justify-start rounded-md text-base select-none hover:bg-accent"
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
        title="重新上传"
        v-if="fileStatus !== 'loading'"
        @click="refreshFile"
      >
        <Icon icon="lucide:refresh-ccw" class="text-base" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        class="h-7 w-7 flex items-center justify-center rounded-full hover:bg-blue-100 transition-colors"
        :title="statusList[fileStatus]"
      >
        <Icon
          v-if="fileStatus === 'success'"
          icon="lucide:circle-check-big"
          class="text-base text-green-500"
        />
        <Icon
          v-else-if="fileStatus === 'loading'"
          icon="lucide:loader"
          class="text-base text-blue-500 animate-spin"
        />
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
    </div>
  </div>
</template>

<script setup lang="ts">
import { getMimeTypeIcon } from '@/lib/utils';
import { Icon } from '@iconify/vue'

const props = withDefaults(
  defineProps<{
    fileName: string
    mimeType: string
    thumbnail?: string
    fileSize: number
    uploadTime: string
    // 上传状态
    fileStatus: string
  }>(),
  {
    fileStatus: 'fail'
  }
)

const emit = defineEmits<{
  delete: []
  refresh: []
}>()

// 上传状态
const statusList = {
  success: '上传成功',
  loadind: '上传中',
  fail: '上传失败'
}

// 删除文件
const deleteFile = () => {
  emit('delete')
}

// 重新上传
const refreshFile = () => {
  emit('refresh')
}

// 文件大小的单位转换
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(2) + ' MB'
  return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB'
}

const getFileIcon = () => {
  return getMimeTypeIcon(props.mimeType)
}
</script>

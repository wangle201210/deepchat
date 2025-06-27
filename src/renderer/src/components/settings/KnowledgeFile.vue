<template>
  <div class="w-full h-full flex flex-col gap-1.5 p-2">
    <div class="flex flex-row justify-between items-center gap-2">
      <div class="flex flex-row items-center gap-2">
        <Icon icon="lucide:book-marked" class="w-4 h-4 text-muted-foreground" />
        <span class="text-sm font-bold">
          {{ builtinKnowledgeDetail.description }}
          <span
            :class="[
              'text-xs px-2 py-0.5 rounded-md ml-2',
              'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
            ]"
          >
            {{ builtinKnowledgeDetail.modelId }}
          </span>
        </span>
      </div>
      <div class="flex flex-row gap-2 flex-shrink-0">
        <Button variant="outline" size="sm" @click="openSearchDialog">
          <Icon icon="lucide:search" class="w-4 h-4" />
        </Button>
        <Button variant="outline" size="sm" @click="onReturn">
          <Icon icon="lucide:corner-down-left" class="w-4 h-4" />
          返回
        </Button>
      </div>
    </div>

    <div class="bg-card border border-border rounded-lg px-4">
      <Accordion type="single" collapsible className="w-full" defaultValue="item-1">
        <AccordionItem value="item-1">
          <AccordionTrigger><div class="text-sm">文件</div></AccordionTrigger>
          <AccordionContent className="flex flex-col gap-4 text-balance">
            <!-- 
            <div
    class="w-200 h-200"
    @dragenter.prevent="handleDragEnter"
  >拖拽文件到此处</div> -->
            <label for="upload">
              <div
                @dragenter.prevent="handleDragEnter"
                @dragover.prevent="handleDragOver"
                @drop.prevent="handleDrop"
                class="mb-5 h-20 border border-border inset-0 cursor-pointer rounded-lg text-muted-foreground hover:bg-muted/0 transition-colors"
              >
                <div class="flex flex-col items-center justify-center h-full gap-2">
                  <div class="flex items-center gap-1">
                    <Icon icon="lucide:file-up" class="w-4 h-4" />
                    <span class="text-sm">点击上传或{{ t('chat.input.dropFiles') }} </span>
                  </div>
                  <div class="flex items-center gap-1">
                    <Icon icon="lucide:clipboard" class="w-4 h-4" />
                    <span class="text-sm">仅支持 {{ allowedExts.join('，') }} 类型</span>
                  </div>
                </div>
              </div>
            </label>

            <!-- 拖动上传 -->
            <Input v-show="false" multiple type="file" id="upload" @change="handleChange" />

            <div v-for="file in fileList" :key="file.metadata.fileName">
              <KnowledgeFileItem
                :mime-type="file.mimeType"
                :tokens="file.token"
                :thumbnail="file.thumbnail"
                :file-size="file.metadata.fileSize"
                :file-name="file.name"
                :upload-time="new Date().toLocaleString()"
                @delete="deleteFile(file.name)"
                class="mt-2"
              ></KnowledgeFileItem>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>

    <!-- 搜索弹窗 -->
    <Dialog v-model:open="isSearchDialogOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>搜索知识库</DialogTitle>
        </DialogHeader>
        <div className="flex w-full items-center gap-1">
          <Input placeholder="请输入查询内容" />
          <Button @click="handleSearch">
            <Icon icon="lucide:search" class="w-4 h-4" />
          </Button>
        </div>

        <!-- 空状态 -->
        <div class="text-center text-muted-foreground py-12">
          <Icon icon="lucide:book-open-text" class="w-12 h-12 mx-auto mb-4 opacity-50" />
          <!-- <p class="text-lg font-medium">暂无数据</p> -->
          <p class="text-sm mt-1">暂无数据</p>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@/components/ui/accordion'

import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Icon } from '@iconify/vue'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from '../ui/toast'
import { Input } from '@/components/ui/input'
import { MessageFile } from '@shared/chat'
import { usePresenter } from '@/composables/usePresenter'
import KnowledgeFileItem from './KnowledgeFileItem.vue'

defineProps<{
  builtinKnowledgeDetail: object
}>()

const emit = defineEmits<{
  (e: 'hideKnowledgeFile'): void
}>()

const { t } = useI18n()

// 弹窗状态
const isSearchDialogOpen = ref(false)

// 打开搜索弹窗
const openSearchDialog = () => {
  isSearchDialogOpen.value = true
}

// 返回知识库页面
const onReturn = () => {
  emit('hideKnowledgeFile')
}

// 查询知识库
const handleSearch = () => {}

const handleChange = (event: Event) => {
  const files = (event.target as HTMLInputElement).files
  if (files && files.length > 0) {
    // 构造一个假的 DragEvent-like 对象，复用 handleDrop 逻辑
    const fakeDragEvent = {
      dataTransfer: {
        files
      }
    } as DragEvent
    handleDrop(fakeDragEvent)
  }
}

const handleDragEnter = (e) => {
  console.log('handleDragEnter')
}

const handleDragOver = () => {
  // // 防止默认行为并保持拖拽状态
  // if (dragLeaveTimer) {
  //   clearTimeout(dragLeaveTimer)
  //   dragLeaveTimer = null
  // }
}
const allowedExts = ['txt', 'doc', 'docx']

// 文件列表
const fileList = ref<MessageFile[]>([])
const filePresenter = usePresenter('filePresenter')

const handleDrop = async (e: DragEvent) => {
  if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
    for (const file of e.dataTransfer.files) {
      // 校验类型
      const ext = file.name.split('.').pop()?.toLowerCase()
      if (!ext || !allowedExts.includes(ext)) {
        toast({
          title: `"${file.name}"上传失败`,
          description: `仅支持 ${allowedExts.join('，')} 类型`,
          variant: 'destructive',
          duration: 3000
        })

        continue
      }
      try {
        const path = window.api.getPathForFile(file)
        // 如果 file.type 为空，可能是文件夹
        if (file.type === '') {
          const isDirectory = await filePresenter.isDirectory(path)
          // 是目录则用 prepareDirectory 处理
          if (isDirectory) {
            const fileInfo: MessageFile = await filePresenter.prepareDirectory(path)
            if (fileInfo) {
              fileList.value.push(fileInfo)
            }
          } else {
            // 不是目录则获取 MIME 类型后用 prepareFile 处理
            const mimeType = await filePresenter.getMimeType(path)
            console.log('mimeType', mimeType)
            const fileInfo: MessageFile = await filePresenter.prepareFile(path, mimeType)
            console.log('fileInfo', fileInfo)
            if (fileInfo) {
              fileList.value.push(fileInfo)
            }
          }
        } else {
          // 如果有类型，直接用 prepareFile 处理
          const mimeType = await filePresenter.getMimeType(path)
          const fileInfo: MessageFile = await filePresenter.prepareFile(path, mimeType)
          if (fileInfo) {
            fileList.value.push(fileInfo)
          }
        }
      } catch (error) {
        console.error('文件准备失败:', error)
        return
      }
    }
    console.log(fileList.value, 'fileList')
    // emit('file-upload', fileList.value)
  }
}

// 刪除文件
const deleteFile = (fileName) => {
  fileList.value = fileList.value.filter((item) => item.name != fileName)
}
</script>

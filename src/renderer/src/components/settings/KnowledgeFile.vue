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
            {{ builtinKnowledgeDetail.modelId?.rerank }}
          </span>
        </span>
      </div>
      <div class="flex flex-row gap-2 flex-shrink-0">
        <Button variant="outline" size="sm" @click="openSearchDialog">
          <Icon icon="lucide:search" class="w-4 h-4" />
        </Button>
        <Button variant="outline" size="sm" @click="onReturn">
          <Icon icon="lucide:corner-down-left" class="w-4 h-4" />
          {{ t('settings.knowledgeBase.return') }}
        </Button>
      </div>
    </div>

    <div class="bg-card border border-border rounded-lg px-4">
      <Accordion type="single" collapsible className="w-full" defaultValue="item-1">
        <AccordionItem value="item-1">
          <AccordionTrigger><div class="text-sm">文件</div></AccordionTrigger>
          <AccordionContent className="flex flex-col gap-4 text-balance">
            <label for="upload">
              <div
                @dragover.prevent
                @drop.prevent="handleDrop"
                class="mb-5 h-20 border border-border inset-0 cursor-pointer rounded-lg text-muted-foreground hover:bg-muted/0 transition-colors"
              >
                <div class="flex flex-col items-center justify-center h-full gap-2">
                  <div class="flex items-center gap-1">
                    <Icon icon="lucide:file-up" class="w-4 h-4" />
                    <span class="text-sm">
                      {{ t('settings.knowledgeBase.uploadHelper') }}
                    </span>
                  </div>
                  <div class="flex items-center gap-1">
                    <Icon icon="lucide:clipboard" class="w-4 h-4" />
                    <span class="text-sm">
                      {{ t('settings.knowledgeBase.onlySupport') }}
                      {{ allowedExts.join('，') }}
                    </span>
                  </div>
                </div>
              </div>
            </label>

            <!-- 拖动上传 -->
            <Input v-show="false" multiple type="file" id="upload" @change="handleChange" />
            <div v-for="(file, index) in fileList" :key="file.metadata.fileName">
              <KnowledgeFileItem
                :mime-type="file.mimeType"
                :thumbnail="file.thumbnail"
                :file-size="file.metadata.fileSize"
                :file-name="file.name"
                :file-status="file.status"
                :upload-time="file.uploadTime"
                @delete="deleteFile(index)"
                @refresh="refreshFile(file)"
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
          <DialogTitle> {{ t('settings.knowledgeBase.searchKnowledge') }} </DialogTitle>
        </DialogHeader>
        <div className="flex w-full items-center gap-1">
          <Input :placeholder="t('settings.knowledgeBase.searchKnowledgePlaceholder')" />
          <Button @click="handleSearch">
            <Icon icon="lucide:search" class="w-4 h-4" />
          </Button>
        </div>
        <!-- 空状态 -->
        <div class="text-center text-muted-foreground py-12">
          <Icon icon="lucide:book-open-text" class="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p class="text-sm mt-1"> {{ t('settings.knowledgeBase.noData') }}</p>
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
  builtinKnowledgeDetail: BuiltinKnowledgeConfig
}>()

const emit = defineEmits<{
  (e: 'hideKnowledgeFile'): void
}>()

const { t } = useI18n()

// 弹窗状态
const isSearchDialogOpen = ref(false)

interface BuiltinKnowledgeConfig {
  id: string
  description: string
  providerId: {
    embedding: string
    rerank: string
  }
  modelId: {
    embedding: string
    rerank: string
  }
  chunkSize?: number // defualt 1000
  chunkOverlap?: number // default 0
  fragmentsNumber?: number // default 6
  dimensions?: number
  enabled?: boolean
}

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

// 内置知识库文件类型
type BuiltinKnowledgeFile = MessageFile & {
  // 文件上传时间
  uploadTime: string
  // 文件状态
  status: 'loading' | 'success' | 'fail'
}

// 文件列表
const fileList = ref<BuiltinKnowledgeFile[]>([])
const filePresenter = usePresenter('filePresenter')

// 允许的文件扩展名
const allowedExts = ['txt', 'doc', 'docx']

// 上传文件到内置知识库
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
        const mimeType = await filePresenter.getMimeType(path)
        const fileInfo: MessageFile = await filePresenter.prepareFile(path, mimeType)
        if (fileInfo) {
          const builtinFile: BuiltinKnowledgeFile = {
            ...fileInfo,
            uploadTime: new Date().toLocaleString(),
            status: 'success'
          }
          fileList.value.push(builtinFile)
          toast({
            title: `"${file.name}"上传成功`,
            description: `文件已添加到知识库`,
            variant: 'default',
            duration: 3000
          })
        }
      } catch (error) {
        console.error('文件准备失败:', error)
        return
      }
    }
  }
}

// 刪除文件
const deleteFile = (index) => {
  fileList.value.splice(index, 1)
}

// 重新上传文件
const refreshFile = (file) => {
  file.status = 'loading'
  setTimeout(() => {
    file.status = 'success'
  }, 1000)
}
</script>

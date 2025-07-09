<template>
  <div class="w-full h-full flex flex-col gap-1.5 p-2">
    <!-- 顶部 -->
    <div class="flex flex-row justify-between items-center gap-2">
      <!-- 知识库信息 -->
      <div class="flex flex-row items-center gap-2">
        <Icon icon="lucide:book-marked" class="w-4 h-4 text-muted-foreground" />
        <span class="text-sm font-bold">
          {{ builtinKnowledgeDetail.description }}
          <span
            class="text-xs px-2 py-0.5 rounded-md ml-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50"
          >
            {{ builtinKnowledgeDetail.embedding.modelId }}
          </span>
        </span>
      </div>
      <!-- 操作按钮 -->
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
    <!-- 文件上传 -->
    <div class="bg-card border border-border rounded-lg px-4">
      <Accordion type="single" collapsible className="w-full" defaultValue="item-1">
        <AccordionItem value="item-1">
          <AccordionTrigger
            ><div class="text-sm">{{ t('settings.knowledgeBase.file') }}</div></AccordionTrigger
          >
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
            <Input
              v-show="false"
              multiple
              type="file"
              id="upload"
              @change="handleChange"
              :accept="allowedExts.map((ext) => '.' + ext).join(',')"
            />
            <div v-for="file in fileList" :key="file.id">
              <KnowledgeFileItem
                :file="file"
                @delete="deleteFile(file.id)"
                @reAdd="reAddFile(file)"
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
          <Input v-model="searchKey" :placeholder="t('settings.knowledgeBase.searchKnowledgePlaceholder')" />
          <Button @click="handleSearch">
            <Icon icon="lucide:search" class="w-4 h-4" />
          </Button>
        </div>
        <!-- 空状态 -->
        <div class="text-center text-muted-foreground py-12">
          <Icon icon="lucide:book-open-text" class="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p class="text-sm mt-1">{{ t('settings.knowledgeBase.noData') }}</p>
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

import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Icon } from '@iconify/vue'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from '../ui/toast'
import { Input } from '@/components/ui/input'
import { usePresenter } from '@/composables/usePresenter'
import KnowledgeFileItem from './KnowledgeFileItem.vue'
import { BuiltinKnowledgeConfig, KnowledgeFileMessage } from '@shared/presenter'
import { RAG_EVENTS } from '@/events'

const props = defineProps<{
  builtinKnowledgeDetail: BuiltinKnowledgeConfig
}>()

const emit = defineEmits<{
  (e: 'hideKnowledgeFile'): void
}>()

const { t } = useI18n()
// 文件列表
const fileList = ref<KnowledgeFileMessage[]>([])
// 允许的文件扩展名
const allowedExts = ['txt', 'doc', 'docx']
const knowledgePresenter = usePresenter('knowledgePresenter')
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
const searchKey = ref('')
const handleSearch = async () => {
  const search = await knowledgePresenter.similarityQuery(props.builtinKnowledgeDetail.id, searchKey.value)
  console.log('查询结果:', search)
}
// 文件点击上传
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

// 加载文件列表
const loadList = async () => {
  fileList.value = await knowledgePresenter.listFiles(props.builtinKnowledgeDetail.id)
}

// 初始化文件列表
onMounted(() => {
  loadList()
  // 监听知识库文件更新事件
  window.electron.ipcRenderer.on(RAG_EVENTS.FILE_UPDATED, (_, data) => {
    console.log('知识库文件更新:', data)
    const file = fileList.value.find((file) => file.id === data.fileId)
    if (!file) {
      return
    }
    file.status = data.status
    file.metadata = data.metadata
  })
})
onBeforeUnmount(() => {
  window.electron.ipcRenderer.removeAllListeners(RAG_EVENTS.FILE_UPDATED)
})
// 上传文件到内置知识库
const handleDrop = async (e: DragEvent) => {
  if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
    for (const file of e.dataTransfer.files) {
      // 校验类型
      const ext = file.name.split('.').pop()?.toLowerCase()
      if (!ext || !allowedExts.includes(ext)) {
        toast({
          title: `"${file.name}"${t('settings.knowledgeBase.uploadError')}`,
          description: `${t('settings.knowledgeBase.onlySupport')} ${allowedExts.join('，')}`,
          variant: 'destructive',
          duration: 3000
        })
        continue
      }
      try {
        const path = window.api.getPathForFile(file)
        await knowledgePresenter.addFile(props.builtinKnowledgeDetail.id, path)
        loadList()
      } catch (error) {
        console.error('文件准备失败:', error)
        return
      }
    }
  }
}

// 刪除文件
const deleteFile = async (fileId: string) => {
  await knowledgePresenter.deleteFile(props.builtinKnowledgeDetail.id, fileId)
    toast({
    title: t('settings.knowledgeBase.deleteSuccess'),
    variant: 'default',
    duration: 3000
  })
  loadList()
}

// 重新上传文件
const reAddFile = async (file: KnowledgeFileMessage) => {
  file.status = 'processing' // 设置状态为加载中
    knowledgePresenter.reAddFile(props.builtinKnowledgeDetail.id, file.id)
}
</script>

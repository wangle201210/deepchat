<template>
  <div class="rounded-lg overflow-hidden">
    <div class="flex flex-row p-2 items-center gap-2 px-2">
      <span class="flex flex-row items-center gap-2 flex-grow w-full">
        <Icon icon="lucide:book-marked" class="w-4 h-4 text-muted-foreground" />
        <span class="text-sm font-medium"> 内置知识库文件设置 </span>
      </span>
      <div class="flex-shrink-0">
        <Button variant="outline" size="sm" class="flex items-center gap-1" @click="openSearchDialog">
          <Icon icon="lucide:search" class="w-4 h-4" />
        </Button>
      </div>
      <div class="flex-shrink-0">
        <Button variant="outline" size="sm" class="flex items-center gap-1" @click="onReturn">
          <Icon icon="lucide:corner-down-left" class="w-4 h-4" />
          返回
        </Button>
      </div>
    </div>

    <div></div>
    <div class="bg-card border border-border rounded-lg px-4">
      <Accordion type="single" collapsible className="w-full" defaultValue="item-1">
        <AccordionItem value="item-1">
          <AccordionTrigger><div class="text-base">文件</div></AccordionTrigger>
          <AccordionContent className="flex flex-col gap-4 text-balance">
            <Input multiple type="file" />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
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

        <div class="border h-20">暂无数据</div>
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
import { Icon } from '@iconify/vue'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

defineProps<{
  builtinKnowledgeDetail: object
}>()

const emit = defineEmits<{
  (e: 'hideKnowledgeFile'): void
}>()

// 返回知识库页面
const onReturn = () => {
  emit('hideKnowledgeFile')
}

// 查询知识库
const handleSearch = () => {}

// 对话框状态
const isSearchDialogOpen = ref(false)

// 打开添加对话框
function openSearchDialog() {
  isSearchDialogOpen.value=true
}
</script>

<template>
  <ScrollArea class="w-full h-full p-2">
    <div class="w-full h-full flex flex-col gap-2">
      <div class="flex flex-row items-center justify-between mb-2">
        <div class="flex items-center gap-2">
          <Icon icon="lucide:book-open-text" class="w-5 h-5 text-primary" />
          <span class="text-lg font-semibold">{{ t('promptSetting.title') }}</span>
        </div>
        <div class="flex items-center gap-2">
          <Button @click="exportPrompts" variant="outline" size="sm">
            <Icon icon="lucide:download" class="w-4 h-4 mr-1" />
            {{ t('promptSetting.export') }}
          </Button>
          <Button @click="importPrompts" variant="outline" size="sm">
            <Icon icon="lucide:upload" class="w-4 h-4 mr-1" />
            {{ t('promptSetting.import') }}
          </Button>
          <Button @click="openAddDialog = true" variant="default">
            <Icon icon="lucide:plus" class="w-4 h-4 mr-1" />
            {{ t('common.add') }}
          </Button>
        </div>
      </div>
      <div class="flex flex-col gap-2">
        <div v-if="prompts.length === 0" class="text-center text-muted-foreground py-8">
          {{ t('promptSetting.noPrompt') }}
        </div>
        <div
          v-for="prompt in prompts"
          :key="prompt.id"
          class="flex flex-row items-center gap-2 bg-card rounded-lg p-3 border border-border"
        >
          <div class="flex-1">
            <div class="font-medium text-base">{{ prompt.name }}</div>
            <div class="text-xs text-muted-foreground mt-1">{{ prompt.description }}</div>
            <div class="relative">
              <div
                :class="[
                  'text-xs mt-1 whitespace-pre-line',
                  !isExpanded(prompt.id) && 'line-clamp-3'
                ]"
              >
                {{ prompt.content }}
              </div>
              <Button
                v-if="prompt.content.split('\n').length > 3"
                variant="ghost"
                size="sm"
                class="text-xs text-primary mt-1"
                @click="toggleShowMore(prompt.id)"
              >
                {{
                  isExpanded(prompt.id) ? t('promptSetting.showLess') : t('promptSetting.showMore')
                }}
              </Button>
            </div>
          </div>
          <Button variant="outline" size="icon" @click="editPrompt(prompts.indexOf(prompt))"
            ><Icon icon="lucide:pencil" class="w-4 h-4"
          /></Button>
          <Button variant="destructive" size="icon" @click="deletePrompt(prompts.indexOf(prompt))"
            ><Icon icon="lucide:trash-2" class="w-4 h-4"
          /></Button>
        </div>
      </div>
    </div>
    <!-- 新增/编辑弹窗 -->
    <Dialog v-model:open="openAddDialog">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{
            editingIdx === null ? t('promptSetting.addTitle') : t('promptSetting.editTitle')
          }}</DialogTitle>
        </DialogHeader>
        <div class="space-y-3 py-2">
          <div>
            <Label>{{ t('promptSetting.name') }}</Label>
            <Input v-model="form.name" :placeholder="t('promptSetting.namePlaceholder')" />
          </div>
          <div>
            <Label>{{ t('promptSetting.description') }}</Label>
            <Input
              v-model="form.description"
              :placeholder="t('promptSetting.descriptionPlaceholder')"
            />
          </div>
          <div>
            <Label>{{ t('promptSetting.content') }}</Label>
            <textarea
              v-model="form.content"
              class="w-full min-h-24 rounded-md border border-input bg-transparent px-2 py-1.5 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 font-mono"
              :placeholder="t('promptSetting.contentPlaceholder')"
            ></textarea>
          </div>
          <div>
            <div class="flex items-center justify-between mb-2">
              <Label>{{ t('promptSetting.parameters') }}</Label>
              <Button variant="outline" size="sm" @click="addParameter">
                <Icon icon="lucide:plus" class="w-4 h-4 mr-1" />
                {{ t('promptSetting.addParameter') }}
              </Button>
            </div>
            <div v-if="form.parameters?.length" class="space-y-2">
              <div
                v-for="(param, index) in form.parameters"
                :key="index"
                class="flex items-start gap-2 p-2 border rounded-md"
              >
                <div class="flex-1 space-y-2">
                  <div class="flex items-center gap-2">
                    <Input
                      v-model="param.name"
                      :placeholder="t('promptSetting.parameterNamePlaceholder')"
                      class="flex-1"
                    />
                    <div class="flex items-center gap-1">
                      <Checkbox
                        :id="'required-' + index"
                        :checked="param.required"
                        @update:checked="(value) => param.required = value"
                      />
                      <Label :for="'required-' + index" class="text-sm">
                        {{ t('promptSetting.required') }}
                      </Label>
                    </div>
                  </div>
                  <Input
                    v-model="param.description"
                    :placeholder="t('promptSetting.parameterDescriptionPlaceholder')"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  @click="removeParameter(index)"
                >
                  <Icon icon="lucide:trash-2" class="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div v-else class="text-center text-muted-foreground py-4">
              {{ t('promptSetting.noParameters') }}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="openAddDialog = false">{{ t('common.cancel') }}</Button>
          <Button :disabled="!form.name || !form.content" @click="savePrompt">{{
            t('common.confirm')
          }}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </ScrollArea>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, toRaw } from 'vue'
import { useI18n } from 'vue-i18n'
import { Icon } from '@iconify/vue'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { usePromptsStore } from '@/stores/prompts'

const { t } = useI18n()
const { toast } = useToast()
const promptsStore = usePromptsStore()

interface PromptItem {
  id: string
  name: string
  description: string
  content: string
  parameters?: Array<{
    name: string
    description: string
    required: boolean
  }>
}

const prompts = ref<PromptItem[]>([])
const expandedPrompts = ref<Set<string>>(new Set())
const openAddDialog = ref(false)
const editingIdx = ref<number | null>(null)
const form = reactive<PromptItem>({
  id: '',
  name: '',
  description: '',
  content: '',
  parameters: []
})

const loadPrompts = async () => {
  await promptsStore.loadPrompts()
  prompts.value = promptsStore.prompts as PromptItem[]
}

const isExpanded = (promptId: string) => expandedPrompts.value.has(promptId)

const toggleShowMore = (promptId: string) => {
  if (expandedPrompts.value.has(promptId)) {
    expandedPrompts.value.delete(promptId)
  } else {
    expandedPrompts.value.add(promptId)
  }
}

const addParameter = () => {
  if (!form.parameters) {
    form.parameters = []
  }
  form.parameters.push({
    name: '',
    description: '',
    required: true
  })
}

const removeParameter = (index: number) => {
  form.parameters?.splice(index, 1)
}

const resetForm = () => {
  form.id = ''
  form.name = ''
  form.description = ''
  form.content = ''
  form.parameters = []
  editingIdx.value = null
}

const savePrompt = async () => {
  if (!form.name || !form.content) return
  if (editingIdx.value === null) {
    // 新增
    const newPrompt = { ...form, id: Date.now().toString() }
    await promptsStore.addPrompt(newPrompt)
  } else {
    // 编辑
    await promptsStore.updatePrompt(form.id, form)
  }
  openAddDialog.value = false
  resetForm()
  await loadPrompts()
}

const editPrompt = (idx: number) => {
  const p = prompts.value[idx]
  form.id = p.id
  form.name = p.name
  form.description = p.description
  form.content = p.content
  if (p.parameters) {
    form.parameters = p.parameters.map(param => {
      return {
        name: param.name,
        description: param.description,
        required: !!param.required
      }
    })
  } else {
    form.parameters = []
  }
  editingIdx.value = idx
  openAddDialog.value = true
}

const deletePrompt = async (idx: number) => {
  const prompt = prompts.value[idx]
  await promptsStore.deletePrompt(prompt.id)
  await loadPrompts()
}

const exportPrompts = () => {
  try {
    const data = JSON.stringify(
      prompts.value.map((prompt) => toRaw(prompt)),
      null,
      2
    )
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'prompts.json'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast({
      title: t('promptSetting.exportSuccess'),
      variant: 'default'
    })
  } catch (error) {
    toast({
      title: t('promptSetting.exportFailed'),
      variant: 'destructive'
    })
  }
}

const importPrompts = () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json'
  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = async (event) => {
        try {
          const content = event.target?.result as string
          const importedPrompts = JSON.parse(content)
          if (Array.isArray(importedPrompts)) {
            await promptsStore.savePrompts(importedPrompts)
            await loadPrompts()
            toast({
              title: t('promptSetting.importSuccess'),
              variant: 'default'
            })
          } else {
            throw new Error('Invalid format')
          }
        } catch (error) {
          toast({
            title: t('promptSetting.importFailed'),
            variant: 'destructive'
          })
        }
      }
      reader.readAsText(file)
    }
  }
  input.click()
}

onMounted(async () => {
  await loadPrompts()
})
</script>

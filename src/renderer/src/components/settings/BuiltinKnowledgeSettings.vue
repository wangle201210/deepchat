<template>
  <div class="border rounded-lg overflow-hidden">
    <div class="flex items-center p-4 bg-card">
      <div class="flex-1">
        <div class="flex items-center">
          <Icon icon="lucide:book-open" class="h-5 mr-2 text-primary" />
          <span class="text-base font-medium">{{
            $t('settings.knowledgeBase.builtInKnowledgeTitle')
          }}</span>
        </div>
        <p class="text-sm text-muted-foreground mt-1">
          {{ t('settings.knowledgeBase.builtInKnowledgeDescription') }}
        </p>
      </div>
      <div class="flex items-center gap-2">
        <Switch
          :checked="isBuiltinMcpEnabled"
          :disabled="!mcpStore.mcpEnabled"
          @update:checked="toggleBuiltinMcpServer"
        />
        <Button
          variant="outline"
          size="sm"
          class="flex items-center gap-1"
          @click="toggleBuiltinConfigPanel"
        >
          <Icon
            :icon="isBuiltinConfigPanelOpen ? 'lucide:chevron-up' : 'lucide:chevron-down'"
            class="w-4 h-4"
          />
          {{ isBuiltinConfigPanelOpen ? t('common.collapse') : t('common.expand') }}
        </Button>
      </div>
    </div>
    <Collapsible v-model:open="isBuiltinConfigPanelOpen">
      <CollapsibleContent>
        <div class="p-4 border-t space-y-4">
          <div v-if="builtinConfigs.length > 0" class="space-y-3">
            <div
              v-for="(config, index) in builtinConfigs"
              :key="index"
              class="p-3 border rounded-md relative"
            >
              <div class="absolute top-2 right-2 flex gap-2">
                <Switch
                  :checked="config.enabled === true"
                  size="sm"
                  @update:checked="toggleConfigEnabled(index, $event)"
                />
                <button
                  type="button"
                  class="text-muted-foreground hover:text-primary"
                  @click="editBuiltinConfig(index)"
                >
                  <Icon icon="lucide:edit" class="h-4 w-4" />
                </button>
                <button
                  type="button"
                  class="text-muted-foreground hover:text-destructive"
                  @click="removeBuiltinConfig(index)"
                >
                  <Icon icon="lucide:trash-2" class="h-4 w-4" />
                </button>
              </div>
              <div class="grid gap-2">
                <div class="flex items-center">
                  <span class="font-medium text-sm">{{ config.description }}</span>
                </div>
              </div>
            </div>
          </div>
          <div class="flex justify-center">
            <Button
              type="button"
              size="sm"
              class="w-full flex items-center justify-center gap-2"
              variant="outline"
              @click="openAddConfig"
            >
              <Icon icon="lucide:plus" class="w-8 h-4" />
              {{ t('settings.knowledgeBase.addBuiltinKnowledgeConfig') }}
            </Button>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
    <Dialog v-model:open="isBuiltinConfigDialogOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{
            isEditMode
              ? t('settings.knowledgeBase.editBuiltinKnowledgeConfig')
              : t('settings.knowledgeBase.addBuiltinKnowledgeConfig')
          }}</DialogTitle>
        </DialogHeader>
        <form @submit.prevent="saveBuiltinConfig">
          <div class="space-y-4 py-2">
            <div>
              <Label>{{ t('settings.knowledgeBase.builtInKnowledgeDescription') }}</Label>
              <Input
                v-model="form.description"
                required
                :placeholder="t('settings.knowledgeBase.descriptionPlaceholder')"
              />
            </div>
            <!-- 选择向量模型 -->
            <ModelSelect></ModelSelect>
          </div>
          <DialogFooter>
            <Button variant="outline" @click="closeBuiltinConfigDialog">{{
              t('common.cancel')
            }}</Button>
            <Button type="button" :disabled="!isEditMode" @click="saveBuiltinConfig">
              {{ isEditMode ? t('common.confirm') : t('settings.knowledgeBase.addConfig') }}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import { Icon } from '@iconify/vue'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useMcpStore } from '@/stores/mcp'
import ModelSelect from '@/components/ModelSelect.vue'

const { t } = useI18n()
const mcpStore = useMcpStore()
const isBuiltinMcpEnabled = ref(false)
const isBuiltinConfigPanelOpen = ref(false)
const isBuiltinConfigDialogOpen = ref(false)
const isEditMode = ref(false)
const builtinConfigs = ref<Array<{ description: string; enabled: boolean }>>([])

interface BuiltinKnowledgeConfig {
  description: string
  providerId: string
  model: string
  chuckSize?: number // defualt 1000
  chunkOverlap?: number // default 0
  enabled?: boolean
}

const form = reactive<BuiltinKnowledgeConfig>({
  description: '',
  providerId: '',
  model: '',
  chuckSize: 1000,
  chunkOverlap: 0,
  enabled: true
})
let editIndex = -1

function toggleBuiltinMcpServer(val: boolean) {
  isBuiltinMcpEnabled.value = val
  // TODO: 触发后端启动/关闭BuiltinKnowledgeServer
}
function toggleBuiltinConfigPanel() {
  isBuiltinConfigPanelOpen.value = !isBuiltinConfigPanelOpen.value
}
function openAddConfig() {
  isEditMode.value = false
  form.description = ''
  form.enabled = true
  isBuiltinConfigDialogOpen.value = true
}

defineExpose({
  openAddConfig
})

function editBuiltinConfig(index: number) {
  isEditMode.value = true
  editIndex = index
  form.description = builtinConfigs.value[index].description
  form.enabled = builtinConfigs.value[index].enabled
  isBuiltinConfigDialogOpen.value = true
}
function removeBuiltinConfig(index: number) {
  builtinConfigs.value.splice(index, 1)
}
function toggleConfigEnabled(index: number, enabled: boolean) {
  builtinConfigs.value[index].enabled = enabled
}
function saveBuiltinConfig() {
  if (isEditMode.value && editIndex >= 0) {
    builtinConfigs.value[editIndex] = { ...form }
  } else {
    builtinConfigs.value.push({ ...form })
  }
  isBuiltinConfigDialogOpen.value = false
}
function closeBuiltinConfigDialog() {
  isBuiltinConfigDialogOpen.value = false
}
</script>

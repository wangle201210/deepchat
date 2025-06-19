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
            isEditing
              ? t('settings.knowledgeBase.editBuiltinKnowledgeConfig')
              : t('settings.knowledgeBase.addBuiltinKnowledgeConfig')
          }}</DialogTitle>
        </DialogHeader>
        <div class="space-y-4 py-4">
          <div class="space-y-2">
            <Label>{{ t('settings.knowledgeBase.builtInKnowledgeDescription') }}</Label>
            <Input
              v-model="editingBuiltinConfig.description"
              required
              :placeholder="t('settings.knowledgeBase.descriptionPlaceholder')"
            />
          </div>
          <div class="space-y-2">
            <Label class="text-xs text-muted-foreground" for="server-model">
              {{ t('settings.knowledgeBase.selectEmbeddingModel') }}
            </Label>
            <Popover v-model:open="modelSelectOpen">
              <PopoverTrigger as-child>
                <Button variant="outline" class="w-full justify-between" :disabled="isEditing">
                  <div class="flex items-center gap-2">
                    <ModelIcon
                      :model-id="editingBuiltinConfig?.model?.id || ''"
                      class="h-4 w-4"
                      :is-dark="themeStore.isDark"
                    />
                    <span class="truncate">{{
                      editingBuiltinConfig?.model?.name || t('settings.common.selectModel')
                    }}</span>
                  </div>
                  <ChevronDown class="h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent class="w-80 p-0">
                <ModelSelect
                  :type="[ModelType.Embedding]"
                  @update:model="handleEmbeddingModelSelect"
                />
              </PopoverContent>
            </Popover>
          </div>
          <div class="space-y-2">
            <Label>{{ t('settings.knowledgeBase.chunkSize') }}</Label>
            <Input
              type="number"
              :min="1"
              :max="editingBuiltinConfig?.model?.maxTokens"
              v-model="editingBuiltinConfig.chunkSize"
            ></Input>
          </div>
          <div class="space-y-2">
            <Label>{{ t('settings.knowledgeBase.chunkOverlap') }}</Label>
            <Input type="number" :min="0" v-model="editingBuiltinConfig.chunkOverlap"></Input>
          </div>
          <DialogFooter>
            <Button variant="outline" @click="closeBuiltinConfigDialog">{{
              t('common.cancel')
            }}</Button>
            <Button type="button" :disabled="!isEditingBuiltinConfigValid" @click="saveBuiltinConfig">
              {{ isEditing ? t('common.confirm') : t('settings.knowledgeBase.addConfig') }}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, toRaw, computed, watch } from 'vue'
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import ModelSelect from '@/components/ModelSelect.vue'
import ModelIcon from '@/components/icons/ModelIcon.vue'
import { useMcpStore } from '@/stores/mcp'
import { ModelType } from '@shared/model'
import { useThemeStore } from '@/stores/theme'
import { RENDERER_MODEL_META } from '@shared/presenter'
import { toast } from '../ui/toast'
import { useRoute } from 'vue-router'

const { t } = useI18n()
const mcpStore = useMcpStore()
const themeStore = useThemeStore()

// 模型选择相关
const modelSelectOpen = ref(false)
const isBuiltinConfigPanelOpen = ref(false)
const isEditing = ref(false)

const builtinConfigs = ref<Array<BuiltinKnowledgeConfig>>([])

interface BuiltinKnowledgeConfig {
  description: string
  providerId: string
  model: RENDERER_MODEL_META | null
  chunkSize?: number // defualt 1000
  chunkOverlap?: number // default 0
  enabled?: boolean
}

const editingBuiltinConfig = ref<BuiltinKnowledgeConfig>({
  description: '',
  providerId: '',
  model: null,
  chunkSize: 512,
  chunkOverlap: 0,
  enabled: true
})

// 对话框状态
const isBuiltinConfigDialogOpen = ref(false)

// 打开添加对话框
function openAddConfig() {
  isEditing.value = false
  editingBuiltinConfig.value = {
    description: '',
    providerId: '',
    model: null,
    chunkSize: 512,
    chunkOverlap: 0,
    enabled: true
  }
  isBuiltinConfigDialogOpen.value = true
}

defineExpose({
  openAddConfig
})

const editingConfigIndex = ref<number>(-1)

// 验证配置是否有效
const isEditingBuiltinConfigValid = computed(() => {
  return (
    editingBuiltinConfig.value.description.trim() !== '' &&
    editingBuiltinConfig.value.providerId.trim() !== '' &&
    editingBuiltinConfig.value.model !== null &&
    editingBuiltinConfig.value.chunkSize !== undefined &&
    editingBuiltinConfig.value.chunkOverlap !== undefined &&
    editingBuiltinConfig.value.chunkSize > 0 &&
    editingBuiltinConfig.value.chunkOverlap >= 0
  )
})

// 打开编辑对话框
const editBuiltinConfig = (index: number) => {
  isEditing.value = true
  editingConfigIndex.value = index
  editingBuiltinConfig.value = { ...builtinConfigs.value[index] }
  isBuiltinConfigDialogOpen.value = true
}

// 关闭编辑对话框
const closeBuiltinConfigDialog = () => {
  isBuiltinConfigDialogOpen.value = false
  editingConfigIndex.value = -1
  editingBuiltinConfig.value = {
    description: '',
    providerId: '',
    model: null,
    chunkSize: 512,
    chunkOverlap: 0,
    enabled: true
  }
}

// 保存配置
const saveBuiltinConfig = async () => {
  if (!isEditingBuiltinConfigValid.value) return

  if (isEditing.value) {
    // 更新配置
    if (editingConfigIndex.value !== -1) {
      builtinConfigs.value[editingConfigIndex.value] = { ...editingBuiltinConfig.value }
    }
    toast({
      title: t('settings.knowledgeBase.configUpdated'),
      description: t('settings.knowledgeBase.configUpdatedDesc')
    })
  } else {
    // 添加配置
    builtinConfigs.value.push({ ...editingBuiltinConfig.value })
    toast({
      title: t('settings.knowledgeBase.configAdded'),
      description: t('settings.knowledgeBase.configAddedDesc')
    })
  }

  // 更新到MCP配置
  await updateBuiltinConfigToMcp()

  // 关闭对话框
  closeBuiltinConfigDialog()
}

// 移除配置
const removeBuiltinConfig = async (index: number) => {
  builtinConfigs.value.splice(index, 1)
  await updateBuiltinConfigToMcp()
}

// 选择嵌入模型
const handleEmbeddingModelSelect = (model: RENDERER_MODEL_META, providerId: string) => {
  editingBuiltinConfig.value.model = model
  editingBuiltinConfig.value.providerId = providerId
  modelSelectOpen.value = false
}

// 切换配置启用状态
const toggleConfigEnabled = async (index: number, enabled: boolean) => {
  builtinConfigs.value[index].enabled = enabled
  await updateBuiltinConfigToMcp
}

const isBuiltinMcpEnabled = computed(() => {
  return mcpStore.serverStatuses['builtinKnowledge'] || false
})

// 切换BuitinKnowledge MCP服务器启用状态
const toggleBuiltinMcpServer = async () => {
  if (!mcpStore.mcpEnabled) return
  await mcpStore.toggleServer('builtinKnowledge')
}

// 切换内置配置面板
const toggleBuiltinConfigPanel = () => {
  isBuiltinConfigPanelOpen.value = !isBuiltinConfigPanelOpen.value
}

// 更新配置到MCP
const updateBuiltinConfigToMcp = async () => {
  try {
    const envJson = {
      configs: toRaw(builtinConfigs.value)
    }
    await mcpStore.updateServer('builtinKnowledge', {
      env: envJson
    })
    return true
  } catch (error) {
    console.error('更新BuiltinKnowledge配置失败:', error)
    toast({
      title: t('common.error.operationFailed'),
      description: String(error),
      variant: 'destructive'
    })
    return false
  }
}

// 从MCP加载内置配置
const loadBuiltinConfigFromMcp = async () => {
  try {
    const serverConfig = mcpStore.config.mcpServers['builtinKnowledge']
    console.log(serverConfig)
    if (serverConfig && serverConfig.env) {
      // 解析配置 - env可能是JSON字符串
      try {
        // 尝试解析JSON字符串
        const envObj =
          typeof serverConfig.env === 'string' ? JSON.parse(serverConfig.env) : serverConfig.env
        // const envObj = serverConfig.env
        if (envObj.configs && Array.isArray(envObj.configs)) {
          builtinConfigs.value = envObj.configs
        }
      } catch (parseError) {
        console.error('解析BuiltinKnowledge配置JSON失败:', parseError)
      }
    }
  } catch (error) {
    console.error('加载BuiltinKnowledge配置失败:', error)
  }
}

onMounted(async () => {
  await loadBuiltinConfigFromMcp()
})

const route = useRoute()

// 监听URL查询参数，设置活动标签页
watch(
  () => route.query.subtab,
  (newSubtab) => {
    if (newSubtab === 'builtinKnowledge') {
      isBuiltinConfigPanelOpen.value = true
    }
  },
  { immediate: true }
)
</script>

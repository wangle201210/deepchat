<template>
  <ScrollArea class="w-full h-full p-2">
    <div class="w-full h-full flex flex-col gap-1.5">
      <!-- 知识库配置标题 -->
      <div class="flex flex-row p-2 items-center gap-2 px-2">
        <span class="flex flex-row items-center gap-2 flex-grow w-full">
          <Icon icon="lucide:book-marked" class="w-4 h-4 text-muted-foreground" />
          <span class="text-sm font-medium">{{ t('settings.knowledgeBase.title') }}</span>
        </span>
        <div class="flex-shrink-0">
          <Button
            variant="outline"
            size="sm"
            class="flex items-center gap-1"
            @click="openAddKnowledgeBaseDialog"
          >
            <Icon icon="lucide:plus" class="w-4 h-4" />
            {{ t('settings.knowledgeBase.addKnowledgeBase') }}
          </Button>
        </div>
      </div>

      <!-- 知识库列表 -->
      <div class="space-y-4 px-2 pb-4">
        <!-- Dify知识库 -->
        <div class="border rounded-lg overflow-hidden">
          <div class="flex items-center p-4 bg-card">
            <div class="flex-1">
              <div class="flex items-center">
                <img src="@/assets/images/dify.png" class="h-5 mr-2" />
                <span class="text-base font-medium">Dify知识库</span>
              </div>
              <p class="text-sm text-muted-foreground mt-1">
                {{ t('settings.knowledgeBase.difyDescription') }}
              </p>
            </div>
            <div class="flex items-center gap-2">
              <!-- MCP开关 -->
              <Switch
                :checked="isDifyMcpEnabled"
                :disabled="!mcpStore.mcpEnabled"
                @update:checked="toggleDifyMcpServer"
              />
              <Button
                variant="outline"
                size="sm"
                class="flex items-center gap-1"
                @click="toggleDifyConfigPanel"
              >
                <Icon
                  :icon="isDifyConfigPanelOpen ? 'lucide:chevron-up' : 'lucide:chevron-down'"
                  class="w-4 h-4"
                />
                {{ isDifyConfigPanelOpen ? t('common.collapse') : t('common.expand') }}
              </Button>
            </div>
          </div>

          <!-- Dify配置面板 -->
          <Collapsible v-model:open="isDifyConfigPanelOpen">
            <CollapsibleContent>
              <div class="p-4 border-t space-y-4">
                <!-- 已添加的配置列表 -->
                <div v-if="difyConfigs.length > 0" class="space-y-3">
                  <div
                    v-for="(config, index) in difyConfigs"
                    :key="index"
                    class="p-3 border rounded-md relative"
                  >
                    <div class="absolute top-2 right-2 flex gap-2">
                      <button
                        type="button"
                        class="text-muted-foreground hover:text-primary"
                        @click="editDifyConfig(index)"
                      >
                        <Icon icon="lucide:edit" class="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        class="text-muted-foreground hover:text-destructive"
                        @click="removeDifyConfig(index)"
                      >
                        <Icon icon="lucide:trash-2" class="h-4 w-4" />
                      </button>
                    </div>

                    <div class="grid gap-2">
                      <div class="flex items-center">
                        <span class="font-medium text-sm">{{ config.description }}</span>
                      </div>
                      <div class="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                        <div>
                          <span class="font-medium">API Key:</span>
                          <span>{{ config.apiKey.substring(0, 8) + '****' }}</span>
                        </div>
                        <div>
                          <span class="font-medium">Dataset ID:</span>
                          <span>{{ config.datasetId }}</span>
                        </div>
                        <div class="col-span-2">
                          <span class="font-medium">Endpoint:</span>
                          <span>{{ config.endpoint }}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- 添加配置按钮 -->
                <div class="flex justify-center">
                  <Button
                    type="button"
                    size="sm"
                    class="w-full flex items-center justify-center gap-2"
                    variant="outline"
                    @click="openAddDifyConfig"
                  >
                    <Icon icon="lucide:plus" class="w-8 h-4" />
                    {{ t('settings.knowledgeBase.addDifyConfig') }}
                  </Button>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        <!-- 未来可以添加更多知识库类型，如RAGFlow、FastGPT等 -->
        <div
          class="border rounded-lg p-4 border-dashed flex items-center justify-center text-muted-foreground"
        >
          <span class="text-sm">{{ t('settings.knowledgeBase.moreComingSoon') }}</span>
        </div>
      </div>

      <!-- Dify配置对话框 -->
      <Dialog v-model:open="isDifyConfigDialogOpen">
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{{
              isEditing
                ? t('settings.knowledgeBase.editDifyConfig')
                : t('settings.knowledgeBase.addDifyConfig')
            }}</DialogTitle>
          </DialogHeader>
          <div class="space-y-4 py-4">
            <div class="space-y-2">
              <Label class="text-xs text-muted-foreground" for="edit-dify-description">
                {{ t('settings.knowledgeBase.difyDescription') }}
              </Label>
              <Input
                id="edit-dify-description"
                v-model="editingDifyConfig.description"
                :placeholder="t('settings.knowledgeBase.descriptionPlaceholder')"
              />
            </div>

            <div class="space-y-2">
              <Label class="text-xs text-muted-foreground" for="edit-dify-api-key">
                {{ t('settings.knowledgeBase.apiKey') }}
              </Label>
              <Input
                id="edit-dify-api-key"
                v-model="editingDifyConfig.apiKey"
                type="password"
                placeholder="Dify API Key"
              />
            </div>

            <div class="space-y-2">
              <Label class="text-xs text-muted-foreground" for="edit-dify-dataset-id">
                {{ t('settings.knowledgeBase.datasetId') }}
              </Label>
              <Input
                id="edit-dify-dataset-id"
                v-model="editingDifyConfig.datasetId"
                placeholder="Dify Dataset ID"
              />
            </div>

            <div class="space-y-2">
              <Label class="text-xs text-muted-foreground" for="edit-dify-endpoint">
                {{ t('settings.knowledgeBase.endpoint') }}
              </Label>
              <Input
                id="edit-dify-endpoint"
                v-model="editingDifyConfig.endpoint"
                placeholder="https://api.dify.ai/v1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" @click="closeEditDifyConfigDialog">{{
              t('common.cancel')
            }}</Button>
            <Button type="button" :disabled="!isEditingDifyConfigValid" @click="saveDifyConfig">
              {{ isEditing ? t('common.confirm') : t('settings.knowledgeBase.addConfig') }}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <!-- 添加知识库对话框 -->
      <Dialog v-model:open="isAddKnowledgeBaseDialogOpen">
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{{ t('settings.knowledgeBase.addKnowledgeBase') }}</DialogTitle>
            <DialogDescription>
              {{ t('settings.knowledgeBase.selectKnowledgeBaseType') }}
            </DialogDescription>
          </DialogHeader>
          <div class="grid gap-4 py-4">
            <div
              class="flex items-center p-3 border rounded-md cursor-pointer hover:bg-accent"
              @click="selectKnowledgeBaseType('dify')"
            >
              <img src="@/assets/images/dify.png" class="h-5 mr-3" />
              <div class="flex-1">
                <h3 class="text-sm font-medium">Dify知识库</h3>
                <p class="text-xs text-muted-foreground">
                  {{ t('settings.knowledgeBase.difyDescription') }}
                </p>
              </div>
            </div>
            <div class="flex items-center p-3 border rounded-md opacity-50">
              <div class="w-5 h-5 mr-3 flex items-center justify-center">
                <Icon icon="lucide:database" class="w-4 h-4" />
              </div>
              <div class="flex-1">
                <h3 class="text-sm font-medium">RAGFlow</h3>
                <p class="text-xs text-muted-foreground">
                  {{ t('settings.knowledgeBase.comingSoon') }}
                </p>
              </div>
            </div>
            <div class="flex items-center p-3 border rounded-md opacity-50">
              <div class="w-5 h-5 mr-3 flex items-center justify-center">
                <Icon icon="lucide:database" class="w-4 h-4" />
              </div>
              <div class="flex-1">
                <h3 class="text-sm font-medium">FastGPT</h3>
                <p class="text-xs text-muted-foreground">
                  {{ t('settings.knowledgeBase.comingSoon') }}
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" @click="closeAddKnowledgeBaseDialog">{{
              t('common.cancel')
            }}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  </ScrollArea>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Icon } from '@iconify/vue'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog'
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible'
import { useMcpStore } from '@/stores/mcp'
import { useToast } from '@/components/ui/toast'
import { useRoute } from 'vue-router'

const { t } = useI18n()
const mcpStore = useMcpStore()
const { toast } = useToast()
const route = useRoute()

// 对话框状态
const isAddKnowledgeBaseDialogOpen = ref(false)
const isDifyConfigPanelOpen = ref(true)
const isDifyConfigDialogOpen = ref(false)
const isEditing = ref(false)

// Dify配置状态
interface DifyConfig {
  description: string
  apiKey: string
  datasetId: string
  endpoint: string
}

const difyConfigs = ref<DifyConfig[]>([])
const editingDifyConfig = ref<DifyConfig>({
  description: '',
  apiKey: '',
  datasetId: '',
  endpoint: 'https://api.dify.ai/v1'
})
const editingConfigIndex = ref<number>(-1)

// 验证配置是否有效
const isEditingDifyConfigValid = computed(() => {
  return (
    editingDifyConfig.value.apiKey.trim() !== '' &&
    editingDifyConfig.value.datasetId.trim() !== '' &&
    editingDifyConfig.value.description.trim() !== ''
  )
})

// 打开添加配置对话框
const openAddDifyConfig = () => {
  isEditing.value = false
  editingConfigIndex.value = -1
  editingDifyConfig.value = {
    description: '',
    apiKey: '',
    datasetId: '',
    endpoint: 'https://api.dify.ai/v1'
  }
  isDifyConfigDialogOpen.value = true
}

// 打开编辑配置对话框
const editDifyConfig = (index: number) => {
  isEditing.value = true
  editingConfigIndex.value = index
  const config = difyConfigs.value[index]
  editingDifyConfig.value = { ...config }
  isDifyConfigDialogOpen.value = true
}

// 关闭配置对话框
const closeDifyConfigDialog = () => {
  isDifyConfigDialogOpen.value = false
  editingConfigIndex.value = -1
  editingDifyConfig.value = {
    description: '',
    apiKey: '',
    datasetId: '',
    endpoint: 'https://api.dify.ai/v1'
  }
}

// 保存配置
const saveDifyConfig = async () => {
  if (!isEditingDifyConfigValid.value) return

  if (isEditing.value) {
    // 更新配置
    if (editingConfigIndex.value !== -1) {
      difyConfigs.value[editingConfigIndex.value] = { ...editingDifyConfig.value }
    }
    toast({
      title: t('settings.knowledgeBase.configUpdated'),
      description: t('settings.knowledgeBase.configUpdatedDesc')
    })
  } else {
    // 添加配置
    difyConfigs.value.push({ ...editingDifyConfig.value })
    toast({
      title: t('settings.knowledgeBase.configAdded'),
      description: t('settings.knowledgeBase.configAddedDesc')
    })
  }

  // 更新到MCP配置
  await updateDifyConfigToMcp()

  // 关闭对话框
  closeDifyConfigDialog()
}

// 移除Dify配置
const removeDifyConfig = async (index: number) => {
  difyConfigs.value.splice(index, 1)
  await updateDifyConfigToMcp()
}

// 更新Dify配置到MCP
const updateDifyConfigToMcp = async () => {
  try {
    // 将配置转换为MCP需要的格式 - 转换为JSON字符串
    const envJson = JSON.stringify({
      configs: difyConfigs.value
    })
    // 更新到MCP服务器
    await mcpStore.updateServer('difyKnowledge', {
      env: envJson
    })

    return true
  } catch (error) {
    console.error('更新Dify配置失败:', error)
    toast({
      title: t('common.error.operationFailed'),
      description: String(error),
      variant: 'destructive'
    })
    return false
  }
}

// 从MCP加载Dify配置
const loadDifyConfigFromMcp = async () => {
  try {
    // 获取difyKnowledge服务器配置
    const serverConfig = mcpStore.config.mcpServers['difyKnowledge']
    console.log('serverConfig', serverConfig)
    if (serverConfig && serverConfig.env) {
      // 解析配置 - env可能是JSON字符串
      try {
        // 尝试解析JSON字符串
        const envObj =
          typeof serverConfig.env === 'string' ? JSON.parse(serverConfig.env) : serverConfig.env
        // const envObj = serverConfig.env
        if (envObj.configs && Array.isArray(envObj.configs)) {
          difyConfigs.value = envObj.configs
        }
      } catch (parseError) {
        console.error('解析Dify配置JSON失败:', parseError)
      }
    }
  } catch (error) {
    console.error('加载Dify配置失败:', error)
  }
}

// 打开添加知识库对话框
const openAddKnowledgeBaseDialog = () => {
  isAddKnowledgeBaseDialogOpen.value = true
}

// 关闭添加知识库对话框
const closeAddKnowledgeBaseDialog = () => {
  isAddKnowledgeBaseDialogOpen.value = false
}

// 关闭编辑配置对话框
const closeEditDifyConfigDialog = () => {
  isDifyConfigDialogOpen.value = false
  editingConfigIndex.value = -1
  editingDifyConfig.value = {
    description: '',
    apiKey: '',
    datasetId: '',
    endpoint: 'https://api.dify.ai/v1'
  }
}

// 选择知识库类型
const selectKnowledgeBaseType = (type: string) => {
  if (type === 'dify') {
    isDifyConfigPanelOpen.value = true
    closeAddKnowledgeBaseDialog()
    openAddDifyConfig()
  } else {
    toast({
      title: t('settings.knowledgeBase.comingSoon'),
      description: t('settings.knowledgeBase.featureNotAvailable')
    })
  }
}

// 切换Dify配置面板
const toggleDifyConfigPanel = () => {
  isDifyConfigPanelOpen.value = !isDifyConfigPanelOpen.value
}

// 计算Dify MCP服务器是否启用
const isDifyMcpEnabled = computed(() => {
  return mcpStore.serverStatuses['difyKnowledge'] || false
})

// 切换Dify MCP服务器状态
const toggleDifyMcpServer = async () => {
  if (!mcpStore.mcpEnabled) return
  await mcpStore.toggleServer('difyKnowledge')
}

// 监听MCP全局状态变化
watch(
  () => mcpStore.mcpEnabled,
  async (enabled) => {
    if (!enabled && isDifyMcpEnabled.value) {
      await mcpStore.toggleServer('difyKnowledge')
    }
  }
)
// 监听URL查询参数，设置活动标签页
watch(
  () => route.query.subtab,
  (newSubtab) => {
    if (newSubtab === 'dify') {
      isDifyConfigPanelOpen.value = true
    }
  },
  { immediate: true }
)
// 组件挂载时加载配置
onMounted(async () => {
  await loadDifyConfigFromMcp()
})
</script>

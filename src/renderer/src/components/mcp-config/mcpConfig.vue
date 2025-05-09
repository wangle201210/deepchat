<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { Icon } from '@iconify/vue'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useMcpStore } from '@/stores/mcp'
import { useSettingsStore } from '@/stores/settings'
import type {
  MCPServerConfig,
  MCPToolDefinition,
  PromptListEntry,
  ResourceListEntry
} from '@shared/presenter'
import { useI18n } from 'vue-i18n'
import McpServerForm from './mcpServerForm.vue'
import { useToast } from '@/components/ui/toast'
import { useRoute, useRouter } from 'vue-router'

// 使用MCP Store
const mcpStore = useMcpStore()
// 使用 Settings Store
const settingsStore = useSettingsStore()
// 国际化
const { t } = useI18n()
// Toast通知
const { toast } = useToast()
// 使用路由
const route = useRoute()

const router = useRouter()

// 本地UI状态
const activeTab = ref<'servers' | 'tools' | 'prompts' | 'resources'>('servers')
const isAddServerDialogOpen = ref(false)
const isEditServerDialogOpen = ref(false)
const isResetConfirmDialogOpen = ref(false)
const isRemoveConfirmDialogOpen = ref(false)
const selectedServer = ref<string>('')
const selectedTool = ref<MCPToolDefinition | null>(null)
const selectedPrompt = ref<string>('')
const selectedResource = ref<string>('')
const promptResult = ref<string>('')
const resourceContent = ref<string>('')
const promptParams = ref<string>('{}')
const promptLoading = ref(false)
const resourceLoading = ref(false)
const jsonPromptError = ref(false)

// 将toolInputs和toolResults移到本地组件
const localToolInputs = ref<Record<string, string>>({})
const localToolResults = ref<Record<string, string>>({})
const jsonError = ref<Record<string, boolean>>({})

// 当选择工具时，初始化本地输入
watch(selectedTool, (newTool) => {
  if (newTool) {
    const toolName = newTool.function.name
    if (!localToolInputs.value[toolName]) {
      localToolInputs.value[toolName] = '{}'
    }
    jsonError.value[toolName] = false
  }
})

// 验证JSON格式
const validateJson = (input: string, toolName: string): boolean => {
  try {
    JSON.parse(input)
    jsonError.value[toolName] = false
    return true
  } catch (e) {
    jsonError.value[toolName] = true
    return false
  }
}

// 验证Prompt参数JSON格式
const validatePromptJson = (input: string): boolean => {
  try {
    JSON.parse(input)
    jsonPromptError.value = false
    return true
  } catch (e) {
    jsonPromptError.value = true
    return false
  }
}

// 选择工具
const selectTool = (tool: MCPToolDefinition) => {
  selectedTool.value = tool
}

// 选择Prompt
const selectPrompt = (prompt: PromptListEntry) => {
  selectedPrompt.value = prompt.name
  promptResult.value = ''
}

// 选择Resource
const selectResource = (resource: ResourceListEntry) => {
  selectedResource.value = resource.uri
  resourceContent.value = ''
}

// 加载资源内容
const loadResourceContent = async (resource: ResourceListEntry) => {
  if (!resource) return

  try {
    resourceLoading.value = true
    const result = await mcpStore.readResource(resource) // 传递完整的resource对象
    // 类型断言和检查
    if (result && typeof result === 'object' && 'content' in result) {
      const typedResult = result as { content: unknown }
      resourceContent.value =
        typeof typedResult.content === 'string'
          ? typedResult.content
          : JSON.stringify(typedResult.content, null, 2)
    } else {
      resourceContent.value = typeof result === 'string' ? result : JSON.stringify(result, null, 2)
    }
  } catch (error) {
    console.error('加载资源内容失败:', error)
    resourceContent.value = `加载失败: ${error}`
  } finally {
    resourceLoading.value = false
  }
}

// 调用Prompt
const callPrompt = async (prompt: PromptListEntry) => {
  if (!prompt) return
  if (!validatePromptJson(promptParams.value)) return

  try {
    promptLoading.value = true
    const params = JSON.parse(promptParams.value)
    const result = await mcpStore.getPrompt(prompt, params) // 传递完整的prompt对象

    // 处理返回结果
    if (result && typeof result === 'object') {
      // 检查是否包含messages字段
      const typedResult = result as Record<string, unknown>
      if ('messages' in typedResult) {
        promptResult.value = JSON.stringify(typedResult.messages, null, 2)
      } else {
        promptResult.value = JSON.stringify(typedResult, null, 2)
      }
    } else {
      promptResult.value = typeof result === 'string' ? result : JSON.stringify(result, null, 2)
    }
  } catch (error) {
    console.error('调用Prompt失败:', error)
    promptResult.value = `调用失败: ${error}`
  } finally {
    promptLoading.value = false
  }
}

// 添加服务器
const handleAddServer = async (serverName: string, serverConfig: MCPServerConfig) => {
  const result = await mcpStore.addServer(serverName, serverConfig)
  if (result.success) {
    isAddServerDialogOpen.value = false
  }
}

// 编辑服务器
const handleEditServer = async (serverName: string, serverConfig: Partial<MCPServerConfig>) => {
  const success = await mcpStore.updateServer(serverName, serverConfig)
  if (success) {
    isEditServerDialogOpen.value = false
    selectedServer.value = ''
  }
}

// 删除服务器
const handleRemoveServer = async (serverName: string) => {
  // 检查是否为inmemory服务，如果是则不允许删除
  const config = mcpStore.config.mcpServers[serverName]
  if (config?.type === 'inmemory') {
    toast({
      title: t('settings.mcp.cannotRemoveBuiltIn'),
      description: t('settings.mcp.builtInServerCannotBeRemoved'),
      variant: 'destructive'
    })
    return
  }

  selectedServer.value = serverName
  isRemoveConfirmDialogOpen.value = true
}

// 确认删除服务器
const confirmRemoveServer = async () => {
  const serverName = selectedServer.value
  await mcpStore.removeServer(serverName)
  isRemoveConfirmDialogOpen.value = false
}

// 切换服务器的默认状态
const handleToggleDefaultServer = async (serverName: string) => {
  // 检查是否已经是默认服务器
  const isDefault = mcpStore.config.defaultServers.includes(serverName)
  console.log('mcpStore.config.defaultServers', mcpStore.config.defaultServers)
  // 如果不是默认服务器，且已达到最大数量，显示提示
  if (!isDefault && mcpStore.config.defaultServers.length > 30) {
    toast({
      title: t('mcp.errors.maxDefaultServersReached'),
      description: t('settings.mcp.removeDefaultFirst'),
      variant: 'destructive'
    })
    return
  }

  const result = await mcpStore.toggleDefaultServer(serverName)
  if (!result.success) {
    toast({
      title: t('common.error.operationFailed'),
      description: result.message,
      variant: 'destructive'
    })
  }
}

// 启动/停止服务器
const handleToggleServer = async (serverName: string) => {
  if (mcpStore.serverLoadingStates[serverName]) {
    return
  }
  const success = await mcpStore.toggleServer(serverName)
  if (!success) {
    // 显示错误提示
    const isRunning = mcpStore.serverStatuses[serverName]
    alert(
      `${serverName} ${isRunning ? t('settings.mcp.stopped') : t('settings.mcp.running')}${t('common.error.requestFailed')}`
    )
  }
}

// 恢复默认服务
const handleResetToDefaultServers = async () => {
  const success = await mcpStore.resetToDefaultServers()
  if (success) {
    isResetConfirmDialogOpen.value = false
  } else {
    alert(t('common.error.requestFailed'))
  }
}

// 打开编辑服务器对话框
const openEditServerDialog = (serverName: string) => {
  // 如果是Dify知识库检索服务器，则跳转到知识库设置页面
  if (serverName === 'difyKnowledge') {
    router.push({
      name: 'settings-knowledge-base',
      query: { subtab: 'dify' } // 确保激活服务器子标签
    })
    return
  }
  if (serverName === 'ragflowKnowledge') {
    router.push({
      name: 'settings-knowledge-base',
      query: { subtab: 'ragflow' } // 确保激活服务器子标签
    })
    return
  }
  if (serverName === 'fastGptKnowledge') {
    router.push({
      name: 'settings-knowledge-base',
      query: { subtab: 'fastgpt' } // 确保激活服务器子标签
    })
    return
  }
  selectedServer.value = serverName
  isEditServerDialogOpen.value = true
}

// 调用工具
const callTool = async (toolName: string) => {
  if (!validateJson(localToolInputs.value[toolName], toolName)) {
    return
  }

  try {
    // 调用工具前更新全局store里的参数
    const params = JSON.parse(localToolInputs.value[toolName])
    // 设置全局store参数，以便mcpStore.callTool能使用
    mcpStore.toolInputs[toolName] = params

    // 调用工具
    const result = await mcpStore.callTool(toolName)
    if (result) {
      localToolResults.value[toolName] = result.content || ''
    }
    return result
  } catch (error) {
    console.error('调用工具出错:', error)
    localToolResults.value[toolName] = String(error)
  }
  return
}

// 监听标签切换
watch(
  activeTab,
  async (newTab) => {
    if (newTab === 'tools') {
      await mcpStore.loadTools()
      await mcpStore.loadClients()
    } else if (newTab === 'prompts') {
      await mcpStore.loadPrompts()
    } else if (newTab === 'resources') {
      await mcpStore.loadResources()
    }
  },
  { immediate: true }
)

// 计算属性：区分内置服务和普通服务
const inMemoryServers = computed(() => {
  return mcpStore.serverList.filter((server) => {
    const config = mcpStore.config.mcpServers[server.name]
    return config?.type === 'inmemory'
  })
})

const regularServers = computed(() => {
  return mcpStore.serverList.filter((server) => {
    const config = mcpStore.config.mcpServers[server.name]
    return config?.type !== 'inmemory'
  })
})

// 获取内置服务器的本地化名称和描述
const getLocalizedServerName = (serverName: string) => {
  return t(`mcp.inmemory.${serverName}.name`, serverName)
}

const getLocalizedServerDesc = (serverName: string, fallbackDesc: string) => {
  return t(`mcp.inmemory.${serverName}.desc`, fallbackDesc)
}

// 监听 MCP 安装缓存
watch(
  () => settingsStore.mcpInstallCache,
  (newCache) => {
    if (newCache) {
      // 打开添加服务器对话框
      isAddServerDialogOpen.value = true
    }
  },
  { immediate: true }
)

watch(isAddServerDialogOpen, (newIsAddServerDialogOpen) => {
  // 当添加服务器对话框关闭时，清理缓存
  if (!newIsAddServerDialogOpen) {
    // 清理缓存
    settingsStore.clearMcpInstallCache()
  }
})

// 监听URL查询参数，设置活动标签页
watch(
  () => route.query.subtab,
  (newSubtab) => {
    console.log('newSubtab', newSubtab)
    if (
      newSubtab === 'servers' ||
      newSubtab === 'tools' ||
      newSubtab === 'prompts' ||
      newSubtab === 'resources'
    ) {
      activeTab.value = newSubtab
    }
  },
  { immediate: true }
)

// 添加计算属性：获取当前选中的提示模板对象
const selectedPromptObj = computed(() => {
  return mcpStore.prompts.find((p) => p.name === selectedPrompt.value)
})

// 添加计算属性：获取默认参数模板
const defaultPromptParams = computed(() => {
  if (!selectedPromptObj.value) return '{}'

  // 获取 arguments 字段
  const promptArgs = selectedPromptObj.value.arguments || {}

  // 如果 arguments 是数组，将其转换为对象
  if (Array.isArray(promptArgs)) {
    const argsObject = promptArgs.reduce(
      (acc, arg) => {
        acc[arg.name] = '' // 为每个参数设置空值
        return acc
      },
      {} as Record<string, string>
    )
    return JSON.stringify(argsObject, null, 2)
  }

  // 如果已经是对象，直接返回
  return JSON.stringify(promptArgs, null, 2)
})

// 监听选中提示模板变化，更新参数
watch(selectedPrompt, () => {
  promptParams.value = defaultPromptParams.value
})

// 格式化 JSON 字符串
const formatJson = (json: string): string => {
  try {
    const obj = JSON.parse(json)
    return JSON.stringify(obj, null, 2)
  } catch (e) {
    return json
  }
}

// 添加计算属性：获取当前选中的资源对象
const selectedResourceObj = computed(() => {
  return mcpStore.resources.find((r) => r.uri === selectedResource.value)
})

// 添加计算属性：判断内容是否是JSON
const isJsonContent = computed(() => {
  if (!resourceContent.value) return false

  try {
    // 尝试将内容解析为JSON
    JSON.parse(resourceContent.value)
    return true
  } catch (e) {
    return false
  }
})

// 添加计算属性：解析JSON内容为带有语法高亮的部分
const jsonParts = computed(() => {
  if (!isJsonContent.value || !resourceContent.value) return []

  try {
    // 格式化JSON字符串
    const formattedJson = JSON.stringify(JSON.parse(resourceContent.value), null, 2)

    // 解析JSON，将其分解为带有类型的部分
    const parts: Array<{ type: string; content: string }> = []

    // 简单的词法分析，识别不同类型的JSON元素
    const regex = /"([^"]+)":|"([^"]+)"|-?\d+\.?\d*|true|false|null|[[\]{}:,]/g
    let match
    let lastIndex = 0

    while ((match = regex.exec(formattedJson)) !== null) {
      // 添加匹配前的空白字符
      if (match.index > lastIndex) {
        parts.push({
          type: 'whitespace',
          content: formattedJson.substring(lastIndex, match.index)
        })
      }

      const value = match[0]

      // 确定元素类型
      if (value.endsWith(':')) {
        // 键
        parts.push({
          type: 'key',
          content: value
        })
      } else if (value.startsWith('"')) {
        // 字符串值
        parts.push({
          type: 'string',
          content: value
        })
      } else if (/^-?\d+\.?\d*$/.test(value)) {
        // 数字
        parts.push({
          type: 'number',
          content: value
        })
      } else if (value === 'true' || value === 'false') {
        // 布尔值
        parts.push({
          type: 'boolean',
          content: value
        })
      } else if (value === 'null') {
        // null值
        parts.push({
          type: 'null',
          content: value
        })
      } else if (/^[[\]{}:,]$/.test(value)) {
        // 括号和分隔符
        parts.push({
          type: 'bracket',
          content: value
        })
      } else {
        // 其他
        parts.push({
          type: 'other',
          content: value
        })
      }

      lastIndex = regex.lastIndex
    }

    // 添加剩余部分
    if (lastIndex < formattedJson.length) {
      parts.push({
        type: 'whitespace',
        content: formattedJson.substring(lastIndex)
      })
    }

    return parts
  } catch (e) {
    return [{ type: 'text', content: resourceContent.value }]
  }
})

// 根据JSON部分类型获取CSS类名
const getJsonPartClass = (type: string): string => {
  switch (type) {
    case 'key':
      return 'json-key'
    case 'string':
      return 'json-string'
    case 'number':
      return 'json-number'
    case 'boolean':
      return 'json-boolean'
    case 'null':
      return 'json-null'
    case 'bracket':
      return 'json-bracket'
    default:
      return ''
  }
}

// 添加计算属性：获取参数描述
const promptArgsDescription = computed(() => {
  if (!selectedPromptObj.value) return []
  const promptArgs = selectedPromptObj.value.arguments || {}

  if (Array.isArray(promptArgs)) {
    return promptArgs.map((arg) => ({
      name: arg.name,
      description: arg.description || '',
      required: arg.required || false
    }))
  }

  return []
})
</script>

<template>
  <div class="h-full flex flex-col w-full">
    <!-- 选项卡 -->
    <div class="flex border-b mb-4 px-4">
      <button
        :class="
          activeTab === 'servers'
            ? 'px-3 py-1.5 text-sm border-b-2 border-primary font-medium text-primary'
            : 'px-3 py-1.5 text-sm text-muted-foreground'
        "
        @click="activeTab = 'servers'"
      >
        {{ t('settings.mcp.tabs.servers') }}
      </button>
      <button
        :class="
          activeTab === 'tools'
            ? 'px-3 py-1.5 text-sm ml-2 border-b-2 border-primary font-medium text-primary'
            : 'px-3 py-1.5 text-sm ml-2 text-muted-foreground'
        "
        @click="activeTab = 'tools'"
      >
        {{ t('settings.mcp.tabs.tools') }}
      </button>
      <button
        :class="
          activeTab === 'prompts'
            ? 'px-3 py-1.5 text-sm ml-2 border-b-2 border-primary font-medium text-primary'
            : 'px-3 py-1.5 text-sm ml-2 text-muted-foreground'
        "
        @click="activeTab = 'prompts'"
      >
        {{ t('settings.mcp.tabs.prompts') }}
      </button>
      <button
        :class="
          activeTab === 'resources'
            ? 'px-3 py-1.5 text-sm ml-2 border-b-2 border-primary font-medium text-primary'
            : 'px-3 py-1.5 text-sm ml-2 text-muted-foreground'
        "
        @click="activeTab = 'resources'"
      >
        {{ t('settings.mcp.tabs.resources') }}
      </button>
    </div>

    <div class="flex overflow-hidden px-4 h-full">
      <!-- 服务器配置选项卡 -->
      <ScrollArea v-if="activeTab === 'servers'" class="h-full w-full">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-base font-medium">{{ t('settings.mcp.serverList') }}</h3>
          <div class="flex space-x-2">
            <Dialog v-model:open="isResetConfirmDialogOpen">
              <DialogTrigger as-child>
                <Button variant="outline" size="sm">
                  <Icon icon="lucide:refresh-cw" class="mr-2 h-4 w-4" />
                  {{ t('settings.mcp.resetToDefault') }}
                </Button>
              </DialogTrigger>
              <DialogContent class="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>{{ t('settings.mcp.resetConfirmTitle') }}</DialogTitle>
                  <DialogDescription>
                    {{ t('settings.mcp.resetConfirmDescription') }}
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" @click="isResetConfirmDialogOpen = false">
                    {{ t('common.cancel') }}
                  </Button>
                  <Button variant="default" @click="handleResetToDefaultServers">
                    {{ t('settings.mcp.resetConfirm') }}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog v-model:open="isAddServerDialogOpen">
              <DialogTrigger as-child>
                <Button variant="outline" size="sm">
                  <Icon icon="lucide:plus" class="mr-2 h-4 w-4" />
                  {{ t('settings.mcp.addServer') }}
                </Button>
              </DialogTrigger>
              <DialogContent class="w-[640px] px-0 h-[80vh] flex flex-col">
                <DialogHeader class="px-4 flex-shrink-0">
                  <DialogTitle>{{ t('settings.mcp.addServerDialog.title') }}</DialogTitle>
                </DialogHeader>
                <McpServerForm
                  :default-json-config="settingsStore.mcpInstallCache || undefined"
                  @submit="handleAddServer"
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div v-if="mcpStore.configLoading" class="flex justify-center py-8">
          <Icon icon="lucide:loader" class="h-8 w-8 animate-spin" />
        </div>

        <div
          v-else-if="mcpStore.serverList.length === 0"
          class="text-center py-8 text-muted-foreground text-lg"
        >
          {{ t('settings.mcp.noServersFound') }}
        </div>

        <div v-else class="space-y-4 pb-4 pr-4">
          <!-- 内置服务 -->
          <div v-if="inMemoryServers.length > 0" class="server-item">
            <h4 class="text-sm font-medium mb-2 text-muted-foreground">
              {{ t('settings.mcp.builtInServers') }}
            </h4>
            <div
              v-for="server in inMemoryServers"
              :key="server.name"
              class="border rounded-lg overflow-hidden bg-card mb-4"
            >
              <div class="flex items-center p-4">
                <div class="flex-1 min-w-0">
                  <div>
                    <div class="flex items-center">
                      <span class="text-xl mr-2 flex-shrink-0">{{ server.icons }}</span>
                      <h4 class="text-sm font-medium truncate">
                        {{ getLocalizedServerName(server.name) }}
                      </h4>
                      <span
                        :class="[
                          'ml-2 px-2 py-0.5 text-xs rounded-full flex-shrink-0',
                          server.isRunning
                            ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100'
                        ]"
                      >
                        {{
                          server.isRunning ? t('settings.mcp.running') : t('settings.mcp.stopped')
                        }}
                      </span>
                    </div>
                    <p class="text-xs text-muted-foreground mt-1 break-words">
                      {{ getLocalizedServerDesc(server.name, server.descriptions) }}
                    </p>
                  </div>
                </div>
                <div class="flex items-center gap-2 flex-shrink-0">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger as-child>
                        <Button
                          variant="outline"
                          size="icon"
                          class="h-8 w-8 rounded-lg text-muted-foreground"
                          :disabled="mcpStore.configLoading"
                          @click="handleToggleServer(server.name)"
                        >
                          <Icon
                            v-if="mcpStore.serverLoadingStates[server.name]"
                            icon="lucide:loader"
                            class="h-4 w-4 animate-spin"
                          />
                          <Icon
                            v-else
                            :icon="server.isRunning ? 'lucide:square' : 'lucide:play'"
                            class="h-4 w-4"
                          />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>
                          {{
                            server.isRunning
                              ? t('settings.mcp.stopServer')
                              : t('settings.mcp.startServer')
                          }}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger as-child>
                        <Button
                          variant="outline"
                          size="icon"
                          class="h-8 w-8 rounded-lg"
                          :class="
                            server.isDefault
                              ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100'
                              : 'text-muted-foreground'
                          "
                          :disabled="mcpStore.configLoading"
                          @click="handleToggleDefaultServer(server.name)"
                        >
                          <Icon
                            v-if="server.isDefault"
                            icon="lucide:check-circle"
                            class="h-4 w-4"
                          />
                          <Icon v-else icon="lucide:circle" class="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>
                          {{
                            server.isDefault
                              ? t('settings.mcp.removeDefault')
                              : t('settings.mcp.setAsDefault')
                          }}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger as-child>
                        <Button
                          variant="outline"
                          size="icon"
                          class="h-8 w-8 rounded-lg text-muted-foreground"
                          :disabled="mcpStore.configLoading"
                          @click="openEditServerDialog(server.name)"
                        >
                          <Icon icon="lucide:edit" class="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{{ t('settings.mcp.editServer') }}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
              <div class="bg-muted dark:bg-zinc-800 px-4 py-2 overflow-hidden">
                <div class="flex justify-between items-center">
                  <div
                    class="text-xs font-mono overflow-hidden text-ellipsis whitespace-nowrap pr-2 flex-1 w-0"
                  >
                    {{ server.command }} {{ server.args.join(' ') }}
                  </div>
                  <div class="flex space-x-2 flex-shrink-0">
                    <span
                      class="ml-2 px-2 py-0.5 text-xs bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100 rounded-full shrink-0"
                    >
                      {{ t('settings.mcp.builtIn') }}
                    </span>
                    <span
                      v-if="server.isDefault"
                      class="ml-2 px-2 py-0.5 text-xs bg-primary text-primary-foreground rounded-full shrink-0"
                    >
                      {{ t('settings.mcp.default') }}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <!-- 普通服务标题 -->
            <h4
              v-if="regularServers.length > 0"
              class="text-sm font-medium mb-2 mt-6 text-muted-foreground"
            >
              {{ t('settings.mcp.customServers') }}
            </h4>
          </div>

          <!-- 普通服务 -->
          <div
            v-for="server in regularServers"
            :key="server.name"
            class="border rounded-lg overflow-hidden bg-card"
          >
            <div class="flex items-center p-4">
              <div class="flex-1 min-w-0">
                <div>
                  <div class="flex items-center">
                    <span class="text-xl mr-2 flex-shrink-0">{{ server.icons }}</span>
                    <h4 class="text-sm font-medium truncate">{{ server.name }}</h4>
                    <span
                      :class="[
                        'ml-2 px-2 py-0.5 text-xs rounded-full flex-shrink-0',
                        server.isRunning
                          ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100'
                      ]"
                    >
                      {{ server.isRunning ? t('settings.mcp.running') : t('settings.mcp.stopped') }}
                    </span>
                  </div>
                  <p class="text-xs text-muted-foreground mt-1 break-words">
                    {{ server.descriptions }}
                  </p>
                </div>
              </div>
              <div class="flex items-center gap-2 flex-shrink-0">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger as-child>
                      <Button
                        variant="outline"
                        size="icon"
                        class="h-8 w-8 rounded-lg text-muted-foreground"
                        :disabled="mcpStore.configLoading"
                        @click="handleToggleServer(server.name)"
                      >
                        <Icon
                          v-if="mcpStore.serverLoadingStates[server.name]"
                          icon="lucide:loader"
                          class="h-4 w-4 animate-spin"
                        />
                        <Icon
                          v-else
                          :icon="server.isRunning ? 'lucide:square' : 'lucide:play'"
                          class="h-4 w-4"
                        />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>
                        {{
                          server.isRunning
                            ? t('settings.mcp.stopServer')
                            : t('settings.mcp.startServer')
                        }}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger as-child>
                      <Button
                        variant="outline"
                        size="icon"
                        class="h-8 w-8 rounded-lg"
                        :class="
                          server.isDefault
                            ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100'
                            : 'text-muted-foreground'
                        "
                        :disabled="mcpStore.configLoading"
                        @click="handleToggleDefaultServer(server.name)"
                      >
                        <Icon v-if="server.isDefault" icon="lucide:check-circle" class="h-4 w-4" />
                        <Icon v-else icon="lucide:circle" class="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>
                        {{
                          server.isDefault
                            ? t('settings.mcp.removeDefault')
                            : t('settings.mcp.setAsDefault')
                        }}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger as-child>
                      <Button
                        variant="outline"
                        size="icon"
                        class="h-8 w-8 rounded-lg text-muted-foreground"
                        :disabled="mcpStore.configLoading"
                        @click="openEditServerDialog(server.name)"
                      >
                        <Icon icon="lucide:edit" class="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{{ t('settings.mcp.editServer') }}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger as-child>
                      <Button
                        variant="outline"
                        size="icon"
                        class="h-8 w-8 rounded-lg text-muted-foreground"
                        :disabled="mcpStore.configLoading"
                        @click="handleRemoveServer(server.name)"
                      >
                        <Icon icon="lucide:trash" class="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{{ t('settings.mcp.removeServer') }}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
            <div class="bg-muted dark:bg-zinc-800 px-4 py-2 overflow-hidden">
              <div class="flex justify-between items-center">
                <div
                  v-if="server.type === 'http'"
                  class="text-xs font-mono overflow-hidden text-ellipsis whitespace-nowrap pr-2 flex-1 w-0"
                >
                  {{ server.baseUrl }}
                </div>
                <div
                  v-else
                  class="text-xs font-mono overflow-hidden text-ellipsis whitespace-nowrap pr-2 flex-1 w-0"
                >
                  {{ server.command }} {{ server.args.join(' ') }}
                </div>
                <span
                  v-if="server.isDefault"
                  class="ml-2 px-2 py-0.5 text-xs bg-primary text-primary-foreground rounded-full shrink-0"
                >
                  {{ t('settings.mcp.default') }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>

      <!-- 调试工具选项卡 -->
      <div
        v-if="activeTab === 'tools'"
        class="h-full w-full grid grid-cols-[200px_1fr] gap-2 overflow-hidden"
      >
        <!-- 左侧工具列表 -->
        <div class="h-full flex flex-col overflow-hidden border-r pr-2">
          <ScrollArea class="h-full w-full">
            <div v-if="mcpStore.toolsLoading" class="flex justify-center py-4">
              <Icon icon="lucide:loader" class="h-6 w-6 animate-spin" />
            </div>

            <div
              v-else-if="mcpStore.tools.length === 0"
              class="text-center py-4 text-sm text-muted-foreground"
            >
              {{ t('mcp.tools.noToolsAvailable') }}
            </div>

            <div v-else class="space-y-1">
              <div
                v-for="tool in mcpStore.tools"
                :key="tool.function.name"
                class="p-2 rounded-md cursor-pointer hover:bg-accent text-sm"
                :class="{ 'bg-accent': selectedTool?.function.name === tool.function.name }"
                @click="selectTool(tool)"
              >
                <div class="font-medium">{{ tool.function.name }}</div>
                <div class="text-xs text-muted-foreground line-clamp-2 mt-1">
                  {{ tool.function.description }}
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>

        <!-- 右侧操作区域 -->
        <div class="h-full flex flex-col overflow-hidden">
          <ScrollArea class="h-full w-full">
            <div class="px-4">
              <div v-if="!selectedTool" class="text-center text-sm text-muted-foreground py-8">
                {{ t('mcp.tools.selectTool') }}
              </div>

              <div v-else>
                <div class="mb-3">
                  <h3 class="text-sm font-medium">{{ selectedTool.function.name }}</h3>
                  <p class="text-xs text-muted-foreground">
                    {{ selectedTool.function.description }}
                  </p>
                </div>

                <!-- 工具参数输入 -->
                <div class="space-y-3 mb-3">
                  <div class="space-y-1">
                    <label class="text-xs font-medium">
                      {{ t('mcp.tools.parameters') }}
                      <span class="text-red-500">*</span>
                    </label>
                    <textarea
                      v-model="localToolInputs[selectedTool.function.name]"
                      class="flex h-24 w-full rounded-md border border-input bg-transparent px-2 py-1.5 text-xs shadow-sm transition-colors file:border-0 file:bg-transparent file:text-xs file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 font-mono"
                      placeholder="{}"
                      :class="{ 'border-red-500': jsonError[selectedTool.function.name] }"
                      @input="
                        validateJson(
                          localToolInputs[selectedTool.function.name],
                          selectedTool.function.name
                        )
                      "
                    ></textarea>
                  </div>
                </div>

                <!-- 调用按钮和结果显示 -->
                <div class="space-y-3">
                  <Button
                    class="w-full"
                    :disabled="
                      mcpStore.toolLoadingStates[selectedTool.function.name] ||
                      jsonError[selectedTool.function.name]
                    "
                    @click="callTool(selectedTool.function.name)"
                  >
                    <Icon
                      v-if="mcpStore.toolLoadingStates[selectedTool.function.name]"
                      icon="lucide:loader"
                      class="mr-2 h-4 w-4 animate-spin"
                    />
                    {{
                      mcpStore.toolLoadingStates[selectedTool.function.name]
                        ? t('mcp.tools.runningTool')
                        : t('mcp.tools.executeButton')
                    }}
                  </Button>

                  <div v-if="localToolResults[selectedTool.function.name]" class="mt-3 mb-4">
                    <div class="text-sm font-medium mb-1">{{ t('mcp.tools.resultTitle') }}</div>
                    <pre class="bg-muted p-3 rounded-md text-sm overflow-auto">{{
                      localToolResults[selectedTool.function.name]
                    }}</pre>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>
      </div>

      <!-- 提示模板选项卡 -->
      <div
        v-if="activeTab === 'prompts'"
        class="h-full w-full grid grid-cols-[200px_1fr] gap-2 overflow-hidden"
      >
        <!-- 左侧提示模板列表 -->
        <div class="h-full flex flex-col overflow-hidden border-r pr-2">
          <ScrollArea class="h-full w-full">
            <div v-if="mcpStore.toolsLoading" class="flex justify-center py-4">
              <Icon icon="lucide:loader" class="h-6 w-6 animate-spin" />
            </div>

            <div
              v-else-if="mcpStore.prompts.length === 0"
              class="text-center py-4 text-sm text-muted-foreground"
            >
              {{ t('mcp.prompts.noPromptsAvailable') }}
            </div>

            <div v-else class="space-y-1">
              <div
                v-for="prompt in mcpStore.prompts"
                :key="prompt.name"
                class="p-2 rounded-md cursor-pointer hover:bg-accent text-sm"
                :class="{ 'bg-accent': selectedPrompt === prompt.name }"
                @click="selectPrompt(prompt)"
              >
                <div class="font-medium">{{ prompt.name }}</div>
                <div class="text-xs text-muted-foreground line-clamp-2 mt-1">
                  {{ prompt.description || t('mcp.prompts.noDescription') }}
                </div>
                <div class="text-xs text-muted-foreground mt-1">
                  {{ prompt.client.name }}
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>

        <!-- 右侧操作区域 -->
        <div class="h-full flex flex-col overflow-hidden">
          <ScrollArea class="h-full w-full">
            <div class="px-4">
              <div v-if="!selectedPrompt" class="text-center text-sm text-muted-foreground py-8">
                {{ t('mcp.prompts.selectPrompt') }}
              </div>

              <div v-else>
                <div class="mb-3">
                  <h3 class="text-sm font-medium">{{ selectedPrompt }}</h3>
                  <p v-if="selectedPromptObj?.description" class="text-xs text-muted-foreground">
                    {{ selectedPromptObj.description }}
                  </p>
                </div>

                <!-- 提示参数输入 -->
                <div class="space-y-3 mb-3">
                  <div class="space-y-1">
                    <div class="flex justify-between items-center">
                      <label class="text-xs font-medium">
                        {{ t('mcp.prompts.parameters') }}
                      </label>
                      <Button
                        variant="ghost"
                        size="sm"
                        class="h-6 text-xs"
                        @click="promptParams = defaultPromptParams"
                      >
                        <Icon icon="lucide:refresh-cw" class="mr-1 h-3 w-3" />
                        {{ t('mcp.prompts.resetToDefault') }}
                      </Button>
                    </div>

                    <!-- 参数描述区域 -->
                    <div
                      v-if="promptArgsDescription.length > 0"
                      class="mb-2 p-2 bg-muted/50 rounded-md"
                    >
                      <div
                        v-for="arg in promptArgsDescription"
                        :key="arg.name"
                        class="text-xs text-muted-foreground mb-1 last:mb-0"
                      >
                        <span class="font-medium">{{ arg.name }}</span>
                        <span v-if="arg.required" class="ml-1 text-red-500">*</span>
                        <span class="ml-1">- {{ arg.description }}</span>
                      </div>
                    </div>

                    <div class="relative">
                      <textarea
                        v-model="promptParams"
                        class="flex h-48 w-full rounded-md border border-input bg-transparent px-2 py-1.5 text-xs shadow-sm transition-colors file:border-0 file:bg-transparent file:text-xs file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 font-mono"
                        placeholder="{}"
                        :class="{ 'border-red-500': jsonPromptError }"
                        @input="validatePromptJson(promptParams)"
                        @blur="promptParams = formatJson(promptParams)"
                      ></textarea>
                      <div
                        v-if="jsonPromptError"
                        class="absolute right-2 top-2 text-xs text-red-500"
                      >
                        {{ t('mcp.prompts.invalidJson') }}
                      </div>
                    </div>
                    <p class="text-xs text-muted-foreground">
                      {{ t('mcp.prompts.parametersHint') }}
                    </p>
                  </div>
                </div>

                <!-- 调用按钮和结果显示 -->
                <div class="space-y-3">
                  <Button
                    class="w-full"
                    :disabled="promptLoading || jsonPromptError"
                    @click="callPrompt(selectedPromptObj as PromptListEntry)"
                  >
                    <Icon
                      v-if="promptLoading"
                      icon="lucide:loader"
                      class="mr-2 h-4 w-4 animate-spin"
                    />
                    {{
                      promptLoading
                        ? t('mcp.prompts.runningPrompt')
                        : t('mcp.prompts.executeButton')
                    }}
                  </Button>

                  <div v-if="promptResult" class="mt-3 mb-4">
                    <div class="text-sm font-medium mb-1">{{ t('mcp.prompts.resultTitle') }}</div>
                    <pre class="bg-muted p-3 rounded-md text-sm overflow-auto">{{
                      promptResult
                    }}</pre>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>
      </div>

      <!-- 资源选项卡 -->
      <div
        v-if="activeTab === 'resources'"
        class="h-full w-full grid grid-cols-[200px_1fr] gap-2 overflow-hidden"
      >
        <!-- 左侧资源列表 -->
        <div class="h-full flex flex-col overflow-hidden border-r pr-2">
          <ScrollArea class="h-full w-full">
            <div v-if="mcpStore.toolsLoading" class="flex justify-center py-4">
              <Icon icon="lucide:loader" class="h-6 w-6 animate-spin" />
            </div>

            <div
              v-else-if="mcpStore.resources.length === 0"
              class="text-center py-4 text-sm text-muted-foreground"
            >
              {{ t('mcp.resources.noResourcesAvailable') }}
            </div>

            <div v-else class="space-y-1">
              <div
                v-for="resource in mcpStore.resources"
                :key="resource.uri"
                class="p-2 rounded-md cursor-pointer hover:bg-accent text-sm"
                :class="{ 'bg-accent': selectedResource === resource.uri }"
                @click="selectResource(resource)"
              >
                <div class="font-medium">{{ resource.name || resource.uri }}</div>
                <div class="text-xs text-muted-foreground mt-1">
                  {{ resource.client.name }}
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>

        <!-- 右侧操作区域 -->
        <div class="h-full flex flex-col overflow-hidden">
          <ScrollArea class="h-full w-full">
            <div class="px-4">
              <div v-if="!selectedResource" class="text-center text-sm text-muted-foreground py-8">
                {{ t('mcp.resources.selectResource') }}
              </div>

              <div v-else>
                <div class="mb-3">
                  <h3 class="text-sm font-medium">{{ selectedResource }}</h3>
                  <p class="text-xs text-muted-foreground">
                    {{ selectedResourceObj?.name || '' }}
                  </p>
                </div>

                <!-- 加载资源按钮 -->
                <Button
                  class="w-full mb-3"
                  :disabled="resourceLoading"
                  @click="loadResourceContent(selectedResourceObj as ResourceListEntry)"
                >
                  <Icon
                    v-if="resourceLoading"
                    icon="lucide:loader"
                    class="mr-2 h-4 w-4 animate-spin"
                  />
                  {{
                    resourceLoading ? t('mcp.resources.loading') : t('mcp.resources.loadContent')
                  }}
                </Button>

                <!-- 资源内容显示 -->
                <div class="resource-section mb-4">
                  <div class="resource-content-container">
                    <div v-if="resourceLoading" class="resource-loading">
                      <Icon icon="lucide:loader" class="h-8 w-8 animate-spin" />
                      <h3>{{ t('mcp.resources.loading') }}</h3>
                    </div>
                    <div v-else-if="resourceContent">
                      <div v-if="isJsonContent" class="json-viewer">
                        <span
                          v-for="(part, index) in jsonParts"
                          :key="index"
                          :class="getJsonPartClass(part.type)"
                          >{{ part.content }}</span
                        >
                      </div>
                      <pre v-else class="resource-raw-content">{{ resourceContent }}</pre>
                    </div>
                    <div v-else class="empty-content">
                      <h3>{{ t('mcp.resources.pleaseSelect') }}</h3>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  </div>

  <!-- 编辑服务器对话框 -->
  <Dialog v-model:open="isEditServerDialogOpen">
    <DialogContent class="w-[640px] px-0 h-[80vh] flex flex-col">
      <DialogHeader class="px-4 flex-shrink-0">
        <DialogTitle>{{ t('settings.mcp.editServerDialog.title') }}</DialogTitle>
      </DialogHeader>
      <McpServerForm
        v-if="selectedServer && mcpStore.config.mcpServers[selectedServer]"
        :server-name="selectedServer"
        :initial-config="mcpStore.config.mcpServers[selectedServer]"
        :edit-mode="true"
        @submit="(name, config) => handleEditServer(name, config)"
      />
    </DialogContent>
  </Dialog>

  <!-- 删除服务器确认对话框 -->
  <Dialog v-model:open="isRemoveConfirmDialogOpen">
    <DialogContent class="sm:max-w-[425px]">
      <DialogHeader>
        <DialogTitle>{{ t('settings.mcp.removeServerDialog.title') }}</DialogTitle>
        <DialogDescription>
          {{ t('settings.mcp.confirmRemoveServer', { name: selectedServer }) }}
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline" @click="isRemoveConfirmDialogOpen = false">
          {{ t('common.cancel') }}
        </Button>
        <Button variant="destructive" @click="confirmRemoveServer">
          {{ t('common.confirm') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<style scoped>
/* JSON查看器样式 */
.json-viewer {
  font-family: 'Fira Code', 'Courier New', monospace;
  background-color: var(--color-background-muted);
  border-radius: 8px;
  padding: 16px;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 400px;
  overflow-y: auto;
  line-height: 1.6;
  font-size: 14px;
  box-shadow: inset 0 0 6px rgba(0, 0, 0, 0.1);
  border: 1px solid var(--color-border);
}

.resource-raw-content {
  font-family: 'Fira Code', 'Courier New', monospace;
  background-color: var(--color-background-muted);
  border-radius: 8px;
  padding: 16px;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 400px;
  overflow-y: auto;
  line-height: 1.6;
  font-size: 14px;
  border: 1px solid var(--color-border);
}

.json-key {
  color: var(--color-primary);
  font-weight: 600;
}

.json-string {
  color: var(--color-success);
}

.json-number {
  color: var(--color-warning);
}

.json-boolean {
  color: var(--color-info);
}

.json-null {
  color: var(--color-destructive);
  font-style: italic;
}

.json-bracket {
  color: var(--color-foreground);
  font-weight: 600;
}

.resource-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 0;
}

.empty-content {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
  border: 1px dashed var(--color-border);
  border-radius: 8px;
  color: var(--color-muted-foreground);
}

.resource-section {
  margin-top: 16px;
}

.resource-content-container {
  margin-top: 8px;
}
</style>

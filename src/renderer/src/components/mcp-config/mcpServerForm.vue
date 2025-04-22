<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { MCPServerConfig } from '@shared/presenter'
import { EmojiPicker } from '@/components/ui/emoji-picker'
import { useToast } from '@/components/ui/toast'
import { Icon } from '@iconify/vue'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ChevronDown, X } from 'lucide-vue-next'
import { Badge } from '@/components/ui/badge'
import ModelSelect from '@/components/ModelSelect.vue'
import ModelIcon from '@/components/icons/ModelIcon.vue'
import { useSettingsStore } from '@/stores/settings'
import type { RENDERER_MODEL_META } from '@shared/presenter'

const { t } = useI18n()
const { toast } = useToast()
const settingsStore = useSettingsStore()

const props = defineProps<{
  serverName?: string
  initialConfig?: MCPServerConfig
  editMode?: boolean
  defaultJsonConfig?: string
}>()

const emit = defineEmits<{
  submit: [serverName: string, config: MCPServerConfig]
}>()

// 表单状态
const name = ref(props.serverName || '')
const command = ref(props.initialConfig?.command || 'npx')
const args = ref(props.initialConfig?.args?.join(' ') || '')
const env = ref(JSON.stringify(props.initialConfig?.env || {}, null, 2))
const descriptions = ref(props.initialConfig?.descriptions || '')
const icons = ref(props.initialConfig?.icons || '📁')
const type = ref<'sse' | 'stdio' | 'inmemory' | 'http'>(props.initialConfig?.type || 'stdio')
const baseUrl = ref(props.initialConfig?.baseUrl || '')
const customHeaders = ref('')

// 模型选择相关
const modelSelectOpen = ref(false)
const selectedImageModel = ref<RENDERER_MODEL_META | null>(null)
const selectedImageModelProvider = ref('')

// 判断是否是inmemory类型
const isInMemoryType = computed(() => type.value === 'inmemory')
// 判断是否是imageServer
const isImageServer = computed(() => isInMemoryType.value && name.value === 'imageServer')
// 判断是否是difyKnowledge
const isDifyKnowledge = computed(() => isInMemoryType.value && name.value === 'difyKnowledge')
// 判断字段是否只读(inmemory类型除了args和env外都是只读的)
const isFieldReadOnly = computed(() => props.editMode && isInMemoryType.value)

// 格式化 JSON 对象为 Key=Value 文本
const formatJsonHeaders = (headers: Record<string, string>): string => {
  return Object.entries(headers)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')
}
// 处理模型选择
const handleImageModelSelect = (model: RENDERER_MODEL_META, providerId: string) => {
  selectedImageModel.value = model
  selectedImageModelProvider.value = providerId
  // 将provider和modelId以空格分隔拼接成args的值
  args.value = `${providerId} ${model.id}`
  modelSelectOpen.value = false
}

// 获取内置服务器的本地化名称和描述
const getLocalizedName = computed(() => {
  const name = props.serverName
  if (isInMemoryType.value && name) {
    return t(`mcp.inmemory.${name}.name`, name)
  }
  return name
})

const getLocalizedDesc = computed(() => {
  if (isInMemoryType.value && name.value) {
    return t(`mcp.inmemory.${name.value}.desc`, descriptions.value)
  }
  return descriptions.value
})

// 权限设置
const autoApproveAll = ref(props.initialConfig?.autoApprove?.includes('all') || false)
const autoApproveRead = ref(
  props.initialConfig?.autoApprove?.includes('read') ||
    props.initialConfig?.autoApprove?.includes('all') ||
    false
)
const autoApproveWrite = ref(
  props.initialConfig?.autoApprove?.includes('write') ||
    props.initialConfig?.autoApprove?.includes('all') ||
    false
)

// difyKnowledge环境变量配置列表
const difyConfigs = ref<
  Array<{ apiKey: string; datasetId: string; endpoint: string; description: string }>
>([])

// 当前编辑的dify配置
const currentDifyConfig = ref<{
  apiKey: string
  datasetId: string
  endpoint: string
  description: string
}>({ apiKey: '', datasetId: '', endpoint: 'https://api.dify.ai/v1', description: '' })

// 解析difyKnowledge的环境变量
const parseDifyEnv = () => {
  try {
    if (isDifyKnowledge.value && env.value.trim()) {
      const parsedEnv = JSON.parse(env.value)
      if (Array.isArray(parsedEnv)) {
        difyConfigs.value = parsedEnv.map((item) => ({
          apiKey: item.apiKey || '',
          datasetId: item.datasetId || '',
          endpoint: item.endpoint || 'https://api.dify.ai/v1',
          description: item.description || ''
        }))
      }
    }
  } catch (error) {
    console.error('解析Dify环境变量失败:', error)
  }
}

// 更新difyKnowledge的环境变量到env
const updateDifyEnvToJson = () => {
  if (isDifyKnowledge.value) {
    env.value = JSON.stringify(difyConfigs.value, null, 2)
  }
}

// 简单表单状态
const currentStep = ref(props.editMode ? 'detailed' : 'simple')
const jsonConfig = ref('')

// 当type变更时处理baseUrl的显示逻辑
const showBaseUrl = computed(() => type.value === 'sse' || type.value === 'http')
// 添加计算属性来控制命令相关字段的显示
const showCommandFields = computed(() => type.value === 'stdio')
// 控制参数输入框的显示 (stdio 或 非imageServer的inmemory)
const showArgsInput = computed(
  () => showCommandFields.value || (isInMemoryType.value && !isImageServer.value)
)

// 当选择 all 时，自动选中其他权限
const handleAutoApproveAllChange = (checked: boolean) => {
  if (checked) {
    autoApproveRead.value = true
    autoApproveWrite.value = true
  }
}

// JSON配置解析
const parseJsonConfig = () => {
  try {
    const parsedConfig = JSON.parse(jsonConfig.value)
    if (!parsedConfig.mcpServers || typeof parsedConfig.mcpServers !== 'object') {
      throw new Error('Invalid MCP server configuration format')
    }

    // 获取第一个服务器的配置
    const serverEntries = Object.entries(parsedConfig.mcpServers)
    if (serverEntries.length === 0) {
      throw new Error('No MCP servers found in configuration')
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [serverName, serverConfig] = serverEntries[0] as [string, any]

    // 填充表单数据
    name.value = serverName
    command.value = serverConfig.command || 'npx'
    args.value = serverConfig.args?.join(' ') || ''
    env.value = JSON.stringify(serverConfig.env || {}, null, 2)
    descriptions.value = serverConfig.descriptions || ''
    icons.value = serverConfig.icons || '📁'
    type.value = serverConfig.type || ''
    baseUrl.value = serverConfig.url || ''
    console.log('type', type.value, baseUrl.value)
    if (type.value !== 'stdio' && type.value !== 'sse' && type.value !== 'http') {
      if (baseUrl.value) {
        type.value = 'http'
      } else {
        type.value = 'stdio'
      }
    }

    // 填充 customHeaders (如果存在)
    if (serverConfig.customHeaders) {
      customHeaders.value = formatJsonHeaders(serverConfig.customHeaders) // 加载时格式化为 Key=Value
    } else {
      customHeaders.value = '' // 默认空字符串
    }

    // 权限设置
    autoApproveAll.value = serverConfig.autoApprove?.includes('all') || false
    autoApproveRead.value =
      serverConfig.autoApprove?.includes('read') ||
      serverConfig.autoApprove?.includes('all') ||
      false
    autoApproveWrite.value =
      serverConfig.autoApprove?.includes('write') ||
      serverConfig.autoApprove?.includes('all') ||
      false

    // 切换到详细表单
    currentStep.value = 'detailed'

    toast({
      title: t('settings.mcp.serverForm.parseSuccess'),
      description: t('settings.mcp.serverForm.configImported')
    })
  } catch (error) {
    console.error('解析JSON配置失败:', error)
    toast({
      title: t('settings.mcp.serverForm.parseError'),
      description: error instanceof Error ? error.message : String(error),
      variant: 'destructive'
    })
  }
}

// 切换到详细表单
const goToDetailedForm = () => {
  currentStep.value = 'detailed'
}

// 验证
const isNameValid = computed(() => name.value.trim().length > 0)
const isCommandValid = computed(() => {
  // 对于SSE类型，命令不是必需的
  if (type.value === 'sse' || type.value === 'http') return true
  // 对于STDIO 或 inmemory 类型，命令是必需的 (排除内置 server)
  if (type.value === 'stdio' || (isInMemoryType.value && !isImageServer.value)) {
    return command.value.trim().length > 0
  }
  return true // 其他情况（如 imageServer）默认有效
})
const isEnvValid = computed(() => {
  try {
    if (!env.value.trim()) return true // Allow empty env
    JSON.parse(env.value)
    return true
  } catch (error) {
    return false
  }
})
const isBaseUrlValid = computed(() => {
  if (type.value !== 'sse' && type.value !== 'http') return true
  return baseUrl.value.trim().length > 0
})

// 新增：验证 Key=Value 格式的函数
const validateKeyValueHeaders = (text: string): boolean => {
  if (!text.trim()) return true // 允许为空
  const lines = text.split('\n')
  for (const line of lines) {
    const trimmedLine = line.trim()
    if (trimmedLine === '') {
      // 只允许空行
      continue
    }
    // 简单的检查，确保包含 = 并且 key 不为空
    const parts = trimmedLine.split('=')
    if (parts.length < 2 || !parts[0].trim()) {
      return false
    }
  }
  return true
}

// 新增：计算属性用于验证 Key=Value 格式
const isCustomHeadersFormatValid = computed(() => validateKeyValueHeaders(customHeaders.value))

const isFormValid = computed(() => {
  // 基本验证：名称必须有效
  if (!isNameValid.value) return false

  // 对于SSE类型，只需要名称和baseUrl有效
  if (type.value === 'sse' || type.value === 'http') {
    return isNameValid.value && isBaseUrlValid.value && isCustomHeadersFormatValid.value
  }

  // 对于STDIO类型，需要名称和命令有效，以及环境变量格式正确
  return isNameValid.value && isCommandValid.value && isEnvValid.value
})

// 参数输入相关状态 (用于标签式输入)
const argumentsList = ref<string[]>([])
const currentArgumentInput = ref('')
const argsInputRef = ref<HTMLInputElement | null>(null) // 用于聚焦输入框

// 监听外部 args 变化，更新内部列表
watch(
  args,
  (newArgs) => {
    if (newArgs) {
      argumentsList.value = newArgs.split(/\s+/).filter(Boolean)
    } else {
      argumentsList.value = []
    }
  },
  { immediate: true }
)

// 监听内部列表变化，更新外部 args 字符串
watch(
  argumentsList,
  (newList) => {
    args.value = newList.join(' ')
  },
  { deep: true }
)

// 添加参数到列表
const addArgument = () => {
  const value = currentArgumentInput.value.trim()
  if (value) {
    argumentsList.value.push(value)
  }
  currentArgumentInput.value = '' // 清空输入框
}

// 移除指定索引的参数
const removeArgument = (index: number) => {
  argumentsList.value.splice(index, 1)
}

// 处理输入框键盘事件
const handleArgumentInputKeydown = (event: KeyboardEvent) => {
  switch (event.key) {
    case 'Enter':
    case ' ': // 按下空格也添加
      event.preventDefault() // 阻止默认行为 (如换行或输入空格)
      addArgument()
      break
    case 'Backspace':
      // 如果输入框为空，且参数列表不为空，则将最后一个tag的内容移回输入框，并从列表中移除
      if (currentArgumentInput.value === '' && argumentsList.value.length > 0) {
        event.preventDefault() // 阻止默认的退格行为
        currentArgumentInput.value = argumentsList.value.pop() || ''
      }
      break
  }
}

// 点击容器时聚焦输入框
const focusArgsInput = () => {
  argsInputRef.value?.focus()
}

// 提交表单
const handleSubmit = () => {
  if (!isFormValid.value) return

  // 处理自动授权设置
  const autoApprove: string[] = []
  if (autoApproveAll.value) {
    autoApprove.push('all')
  } else {
    if (autoApproveRead.value) autoApprove.push('read')
    if (autoApproveWrite.value) autoApprove.push('write')
  }

  // 创建基本配置（必需的字段）
  const baseConfig = {
    descriptions: descriptions.value.trim(),
    icons: icons.value.trim(),
    autoApprove,
    type: type.value
  }

  // 创建符合MCPServerConfig接口的配置对象
  let serverConfig: MCPServerConfig

  // 解析 env
  let parsedEnv = {}
  try {
    if ((type.value === 'stdio' || isInMemoryType.value) && env.value.trim()) {
      parsedEnv = JSON.parse(env.value)
    }
  } catch (error) {
    toast({
      title: t('settings.mcp.serverForm.jsonParseError'),
      description: String(error),
      variant: 'destructive'
    })
    // 阻止提交或根据需要处理错误
    return
  }

  // 解析 customHeaders
  let parsedCustomHeaders = {}
  try {
    if ((type.value === 'sse' || type.value === 'http') && customHeaders.value.trim()) {
      parsedCustomHeaders = parseKeyValueHeaders(customHeaders.value)
    }
  } catch (error) {
    toast({
      title: t('settings.mcp.serverForm.parseError'),
      description: t('settings.mcp.serverForm.customHeadersParseError') + ': ' + String(error),
      variant: 'destructive'
    })
    return
  }

  if (type.value === 'sse' || type.value === 'http') {
    // SSE 或 HTTP 类型的服务器
    serverConfig = {
      ...baseConfig,
      command: '', // 提供空字符串作为默认值
      args: [], // 提供空数组作为默认值
      env: {}, // 提供空对象作为默认值
      baseUrl: baseUrl.value.trim(),
      customHeaders: parsedCustomHeaders // 使用解析后的 Key=Value
    }
  } else {
    // STDIO 或 inmemory 类型的服务器
    serverConfig = {
      ...baseConfig,
      command: command.value.trim(),
      // args 从 argumentsList 更新，所以直接使用 split 即可，或者直接使用 argumentsList.value
      args: args.value.split(/\s+/).filter(Boolean),
      env: parsedEnv,
      baseUrl: baseUrl.value.trim()
    }
  }

  // 填充 customHeaders (如果存在)
  if (serverConfig.customHeaders) {
    customHeaders.value = formatJsonHeaders(serverConfig.customHeaders) // 加载时格式化为 Key=Value
  } else {
    customHeaders.value = '' // 默认空字符串
  }

  emit('submit', name.value.trim(), serverConfig)
}

const placeholder = `mcp配置示例
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        ...
      ]
    },
    "sseServer":{
      "url": "https://your-sse-server-url"
    }
  },

}`

// 监听 defaultJsonConfig 变化
watch(
  () => props.defaultJsonConfig,
  (newConfig) => {
    if (newConfig) {
      jsonConfig.value = newConfig
      parseJsonConfig()
    }
  },
  { immediate: true }
)

// 初始化时解析args中的provider和modelId（针对imageServer）
watch(
  [() => name.value, () => args.value, () => type.value],
  ([newName, newArgs, newType]) => {
    if (newType === 'inmemory' && newName === 'imageServer' && newArgs) {
      // 从args中解析出provider和modelId
      const argsParts = newArgs.split(/\s+/)
      if (argsParts.length >= 2) {
        const providerId = argsParts[0]
        const modelId = argsParts[1]
        // 查找对应的模型
        const foundModel = settingsStore.findModelByIdOrName(modelId)
        if (foundModel && foundModel.providerId === providerId) {
          selectedImageModel.value = foundModel.model
          selectedImageModelProvider.value = providerId
        } else {
          console.warn(`未找到匹配的模型: ${providerId} ${modelId}`)
        }
      }
    }
  },
  { immediate: true }
)

// Watch for initial config changes (primarily for edit mode)
watch(
  () => props.initialConfig,
  (newConfig) => {
    // Check if we are in edit mode and have a new valid config, but avoid overwriting if defaultJsonConfig was also provided and parsed
    if (newConfig && props.editMode && !props.defaultJsonConfig) {
      console.log('Applying initialConfig in edit mode:', newConfig)
      // Reset fields based on initialConfig
      // name.value = props.serverName || ''; // Name is usually passed separately and kept disabled
      command.value = newConfig.command || 'npx'
      args.value = newConfig.args?.join(' ') || ''
      env.value = JSON.stringify(newConfig.env || {}, null, 2)
      descriptions.value = newConfig.descriptions || ''
      icons.value = newConfig.icons || '📁'
      type.value = newConfig.type || 'stdio'
      baseUrl.value = newConfig.baseUrl || ''

      // 解析difyKnowledge的环境变量
      parseDifyEnv()

      // Format customHeaders from initialConfig
      if (newConfig.customHeaders) {
        customHeaders.value = formatJsonHeaders(newConfig.customHeaders)
      } else {
        customHeaders.value = ''
      }

      // Set autoApprove based on initialConfig
      autoApproveAll.value = newConfig.autoApprove?.includes('all') || false
      autoApproveRead.value =
        newConfig.autoApprove?.includes('read') || newConfig.autoApprove?.includes('all') || false
      autoApproveWrite.value =
        newConfig.autoApprove?.includes('write') || newConfig.autoApprove?.includes('all') || false

      // Ensure we are in the detailed view for edit mode
      currentStep.value = 'detailed'
    }
  },
  { immediate: true } // Run immediately on component mount
)

// 打开MCP Marketplace
const openMcpMarketplace = () => {
  window.open('https://mcp.deepchatai.cn', '_blank')
}

// --- 新增辅助函数 ---
// 解析 Key=Value 格式为 JSON 对象
const parseKeyValueHeaders = (text: string): Record<string, string> => {
  const headers: Record<string, string> = {}
  if (!text) return headers
  const lines = text.split('\n')
  for (const line of lines) {
    const trimmedLine = line.trim()
    if (trimmedLine === '') {
      // 跳过空行
      continue
    }
    const separatorIndex = trimmedLine.indexOf('=')
    if (separatorIndex > 0) {
      const key = trimmedLine.substring(0, separatorIndex).trim()
      const value = trimmedLine.substring(separatorIndex + 1).trim()
      if (key) {
        headers[key] = value
      }
    }
  }
  return headers
}

// --- 结束新增辅助函数 ---

// 定义 customHeaders 的 placeholder
const customHeadersPlaceholder = `Authorization=Bearer your_token
HTTP-Referer=deepchatai.cn`
// 监听 defaultJsonConfig 变化
watch(
  () => props.defaultJsonConfig,
  (newConfig) => {
    if (newConfig) {
      jsonConfig.value = newConfig
      parseJsonConfig()
    }
  },
  { immediate: true }
)

// 添加dify配置
const addDifyConfig = () => {
  if (
    currentDifyConfig.value.apiKey &&
    currentDifyConfig.value.datasetId &&
    currentDifyConfig.value.description
  ) {
    difyConfigs.value.push({
      ...currentDifyConfig.value
    })
    // 重置当前编辑的配置
    currentDifyConfig.value = {
      apiKey: '',
      datasetId: '',
      endpoint: 'https://api.dify.ai/v1',
      description: ''
    }
    // 更新到env
    updateDifyEnvToJson()
  }
}

// 移除dify配置
const removeDifyConfig = (index: number) => {
  difyConfigs.value.splice(index, 1)
  updateDifyEnvToJson()
}

// 验证dify配置是否有效
const isDifyConfigValid = computed(() => {
  return (
    currentDifyConfig.value.apiKey.trim() !== '' &&
    currentDifyConfig.value.datasetId.trim() !== '' &&
    currentDifyConfig.value.description.trim() !== ''
  )
})
</script>

<template>
  <!-- 简单表单 -->
  <form v-if="currentStep === 'simple'" class="space-y-4 h-full flex flex-col">
    <ScrollArea class="h-0 flex-grow">
      <div class="space-y-4 px-4 pb-4">
        <div class="text-sm">
          {{ t('settings.mcp.serverForm.jsonConfigIntro') }}
        </div>

        <!-- MCP Marketplace 入口 -->
        <div class="my-4">
          <Button
            variant="outline"
            class="w-full flex items-center justify-center gap-2"
            @click="openMcpMarketplace"
          >
            <Icon icon="lucide:shopping-bag" class="w-4 h-4" />
            <span>{{ t('settings.mcp.serverForm.browseMarketplace') }}</span>
            <Icon icon="lucide:external-link" class="w-3.5 h-3.5 text-muted-foreground" />
          </Button>
        </div>

        <div class="space-y-2">
          <Label class="text-xs text-muted-foreground" for="json-config">
            {{ t('settings.mcp.serverForm.jsonConfig') }}
          </Label>
          <Textarea id="json-config" v-model="jsonConfig" rows="10" :placeholder="placeholder" />
        </div>
      </div>
    </ScrollArea>

    <div class="flex justify-between pt-2 border-t px-4">
      <Button type="button" variant="outline" size="sm" @click="goToDetailedForm">
        {{ t('settings.mcp.serverForm.skipToManual') }}
      </Button>
      <Button type="button" size="sm" @click="parseJsonConfig">
        {{ t('settings.mcp.serverForm.parseAndContinue') }}
      </Button>
    </div>
  </form>

  <!-- 详细表单 -->
  <form v-else class="space-y-2 h-full flex flex-col" @submit.prevent="handleSubmit">
    <ScrollArea class="h-0 flex-grow">
      <div class="space-y-2 px-4 pb-4">
        <!-- 服务器名称 -->
        <!-- 本地化名称 (针对inmemory类型) -->
        <div v-if="isInMemoryType && name" class="space-y-2">
          <Label class="text-xs text-muted-foreground" for="localized-name">{{
            t('settings.mcp.serverForm.name')
          }}</Label>

          <div
            class="flex h-9 items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background opacity-50"
          >
            {{ getLocalizedName }}
          </div>
        </div>
        <div v-else class="space-y-2">
          <Label class="text-xs text-muted-foreground" for="server-name">{{
            t('settings.mcp.serverForm.name')
          }}</Label>
          <Input
            id="server-name"
            v-model="name"
            :placeholder="t('settings.mcp.serverForm.namePlaceholder')"
            :disabled="editMode || isFieldReadOnly"
            required
          />
        </div>

        <!-- 图标 -->
        <div class="space-y-2">
          <Label class="text-xs text-muted-foreground" for="server-icon">{{
            t('settings.mcp.serverForm.icons')
          }}</Label>
          <div class="flex items-center space-x-2">
            <EmojiPicker v-model="icons" :disabled="isFieldReadOnly" />
          </div>
        </div>

        <!-- 服务器类型 -->
        <div class="space-y-2">
          <Label class="text-xs text-muted-foreground" for="server-type">{{
            t('settings.mcp.serverForm.type')
          }}</Label>
          <Select v-model="type" :disabled="isFieldReadOnly">
            <SelectTrigger class="w-full">
              <SelectValue :placeholder="t('settings.mcp.serverForm.typePlaceholder')" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="stdio">{{ t('settings.mcp.serverForm.typeStdio') }}</SelectItem>
              <SelectItem value="sse">{{ t('settings.mcp.serverForm.typeSse') }}</SelectItem>
              <SelectItem value="http">{{ t('settings.mcp.serverForm.typeHttp') }}</SelectItem>
              <SelectItem
                v-if="props.editMode && props.initialConfig?.type === 'inmemory'"
                value="inmemory"
                >{{ t('settings.mcp.serverForm.typeInMemory') }}</SelectItem
              >
            </SelectContent>
          </Select>
        </div>

        <!-- 基础URL，仅在类型为SSE或HTTP时显示 -->
        <div v-if="showBaseUrl" class="space-y-2">
          <Label class="text-xs text-muted-foreground" for="server-base-url">{{
            t('settings.mcp.serverForm.baseUrl')
          }}</Label>
          <Input
            id="server-base-url"
            v-model="baseUrl"
            :placeholder="t('settings.mcp.serverForm.baseUrlPlaceholder')"
            :disabled="isFieldReadOnly"
            required
          />
        </div>

        <!-- 命令 -->
        <div v-if="showCommandFields" class="space-y-2">
          <Label class="text-xs text-muted-foreground" for="server-command">{{
            t('settings.mcp.serverForm.command')
          }}</Label>
          <Input
            id="server-command"
            v-model="command"
            :placeholder="t('settings.mcp.serverForm.commandPlaceholder')"
            :disabled="isFieldReadOnly"
            required
          />
        </div>

        <!-- 参数 (特殊处理 imageServer) -->
        <div v-if="isImageServer" class="space-y-2">
          <Label class="text-xs text-muted-foreground" for="server-model">
            {{ t('settings.mcp.serverForm.imageModel') || '模型选择' }}
          </Label>
          <Popover v-model:open="modelSelectOpen">
            <PopoverTrigger as-child>
              <Button variant="outline" class="w-full justify-between">
                <div class="flex items-center gap-2">
                  <ModelIcon :model-id="selectedImageModel?.id || ''" class="h-4 w-4" />
                  <span class="truncate">{{
                    selectedImageModel?.name || t('settings.common.selectModel')
                  }}</span>
                </div>
                <ChevronDown class="h-4 w-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent class="w-80 p-0">
              <ModelSelect @update:model="handleImageModelSelect" />
            </PopoverContent>
          </Popover>
        </div>
        <!-- 参数 (标签式输入 for stdio/inmemory) -->
        <div v-else-if="showArgsInput" class="space-y-2">
          <Label class="text-xs text-muted-foreground" for="server-args">{{
            t('settings.mcp.serverForm.args')
          }}</Label>
          <div
            class="flex flex-wrap items-center gap-1 p-2 border border-input rounded-md min-h-[40px] cursor-text"
            @click="focusArgsInput"
          >
            <Badge
              v-for="(arg, index) in argumentsList"
              :key="index"
              variant="outline"
              class="flex items-center gap-1 whitespace-nowrap"
            >
              <span>{{ arg }}</span>
              <button
                type="button"
                class="rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
                :aria-label="`Remove ${arg}`"
                @click.stop="removeArgument(index)"
              >
                <X class="h-3 w-3 text-muted-foreground hover:text-foreground" />
              </button>
            </Badge>
            <input
              id="server-args-input"
              ref="argsInputRef"
              v-model="currentArgumentInput"
              :placeholder="
                argumentsList.length === 0 ? t('settings.mcp.serverForm.argsPlaceholder') : ''
              "
              class="flex-1 bg-transparent outline-none text-sm min-w-[60px]"
              @keydown="handleArgumentInputKeydown"
            />
          </div>
          <!-- 隐藏原始Input，但保留v-model绑定以利用其验证状态或原有逻辑(如果需要) -->
          <Input id="server-args" v-model="args" class="hidden" />
        </div>

        <!-- 环境变量 -->
        <!-- Dify知识库配置界面 -->
        <div v-if="isDifyKnowledge" class="space-y-4">
          <Label class="text-xs text-muted-foreground">{{ t('settings.mcp.serverForm.difyConfigs') || 'Dify知识库配置' }}</Label>

          <!-- 已添加的配置列表 -->
          <div v-if="difyConfigs.length > 0" class="space-y-3">
            <div v-for="(config, index) in difyConfigs" :key="index" class="p-3 border rounded-md relative">
              <button
                type="button"
                class="absolute top-2 right-2 text-muted-foreground hover:text-destructive"
                @click="removeDifyConfig(index)"
              >
                <X class="h-4 w-4" />
              </button>

              <div class="grid gap-2">
                <div class="flex items-center">
                  <span class="font-medium text-sm">{{ config.description }}</span>
                </div>
                <div class="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div>
                    <span class="font-medium">API Key:</span>
                    <span>{{ config.apiKey.substring(0, 4) + '****' }}</span>
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

          <!-- 添加新配置表单 -->
          <div class="space-y-3 p-3 border rounded-md border-dashed">
            <h4 class="text-sm font-medium">{{ t('settings.mcp.serverForm.addDifyConfig') || '添加知识库配置' }}</h4>

            <div class="space-y-2">
              <Label class="text-xs text-muted-foreground" for="dify-description">{{ t('settings.mcp.serverForm.difyDescription') || '知识库描述' }}</Label>
              <Input
                id="dify-description"
                v-model="currentDifyConfig.description"
                placeholder="例如：公司产品文档知识库"
              />
            </div>

            <div class="space-y-2">
              <Label class="text-xs text-muted-foreground" for="dify-api-key">{{ t('settings.mcp.serverForm.difyApiKey') || 'API Key' }}</Label>
              <Input
                id="dify-api-key"
                v-model="currentDifyConfig.apiKey"
                type="password"
                placeholder="Dify API Key"
              />
            </div>

            <div class="space-y-2">
              <Label class="text-xs text-muted-foreground" for="dify-dataset-id">{{ t('settings.mcp.serverForm.difyDatasetId') || '数据集ID' }}</Label>
              <Input
                id="dify-dataset-id"
                v-model="currentDifyConfig.datasetId"
                placeholder="Dify Dataset ID"
              />
            </div>

            <div class="space-y-2">
              <Label class="text-xs text-muted-foreground" for="dify-endpoint">{{ t('settings.mcp.serverForm.difyEndpoint') || 'API端点' }}</Label>
              <Input
                id="dify-endpoint"
                v-model="currentDifyConfig.endpoint"
                placeholder="https://api.dify.ai/v1"
              />
            </div>

            <Button
              type="button"
              size="sm"
              class="w-full mt-2"
              variant="outline"
              :disabled="!isDifyConfigValid"
              @click="addDifyConfig"
            >
              {{ t('settings.mcp.serverForm.addConfig') || '添加配置' }}
            </Button>
          </div>

          <!-- 隐藏原始env输入框，但保留v-model绑定 -->
          <Textarea
            id="server-env"
            v-model="env"
            class="hidden"
            :class="{ 'border-red-500': !isEnvValid }"
          />
        </div>

        <!-- 标准环境变量输入框 (非Dify知识库) -->
        <div v-else-if="showCommandFields || isInMemoryType" class="space-y-2">
          <Label class="text-xs text-muted-foreground" for="server-env">{{
            t('settings.mcp.serverForm.env')
          }}</Label>
          <Textarea
            id="server-env"
            v-model="env"
            rows="5"
            :placeholder="t('settings.mcp.serverForm.envPlaceholder')"
            :class="{ 'border-red-500': !isEnvValid }"
          />
        </div>

        <!-- 描述 -->
        <!-- 本地化描述 (针对inmemory类型) -->
        <div v-if="isInMemoryType && name" class="space-y-2">
          <Label class="text-xs text-muted-foreground" for="localized-desc">{{
            t('settings.mcp.serverForm.descriptions')
          }}</Label>
          <div
            class="flex h-9 items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background opacity-50"
          >
            {{ getLocalizedDesc }}
          </div>
        </div>
        <div v-else class="space-y-2">
          <Label class="text-xs text-muted-foreground" for="server-description">{{
            t('settings.mcp.serverForm.descriptions')
          }}</Label>
          <Input
            id="server-description"
            v-model="descriptions"
            :placeholder="t('settings.mcp.serverForm.descriptionsPlaceholder')"
            :disabled="isFieldReadOnly"
          />
        </div>

        <!-- 自动授权选项 -->
        <div class="space-y-3">
          <Label class="text-xs text-muted-foreground">{{
            t('settings.mcp.serverForm.autoApprove')
          }}</Label>
          <div class="flex flex-col space-y-2">
            <div class="flex items-center space-x-2">
              <Checkbox
                id="auto-approve-all"
                v-model:checked="autoApproveAll"
                @update:checked="handleAutoApproveAllChange"
              />
              <label
                for="auto-approve-all"
                class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                {{ t('settings.mcp.serverForm.autoApproveAll') }}
              </label>
            </div>

            <div class="flex items-center space-x-2">
              <Checkbox
                id="auto-approve-read"
                v-model:checked="autoApproveRead"
                :disabled="autoApproveAll"
              />
              <label
                for="auto-approve-read"
                class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                {{ t('settings.mcp.serverForm.autoApproveRead') }}
              </label>
            </div>

            <div class="flex items-center space-x-2">
              <Checkbox
                id="auto-approve-write"
                v-model:checked="autoApproveWrite"
                :disabled="autoApproveAll"
              />
              <label
                for="auto-approve-write"
                class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                {{ t('settings.mcp.serverForm.autoApproveWrite') }}
              </label>
            </div>
          </div>
        </div>

        <!-- Custom Headers，仅在类型为SSE或HTTP时显示 -->
        <div v-if="showBaseUrl" class="space-y-2">
          <Label class="text-xs text-muted-foreground" for="server-custom-headers">{{
            t('settings.mcp.serverForm.customHeaders')
          }}</Label>
          <Textarea
            id="server-custom-headers"
            v-model="customHeaders"
            rows="5"
            :placeholder="customHeadersPlaceholder"
            :class="{ 'border-red-500': !isCustomHeadersFormatValid }"
            :disabled="isFieldReadOnly"
          />
          <p v-if="!isCustomHeadersFormatValid" class="text-xs text-red-500">
            {{ t('settings.mcp.serverForm.invalidKeyValueFormat') }}
          </p>
        </div>
      </div>
    </ScrollArea>

    <!-- 提交按钮 -->
    <div class="flex justify-end pt-2 border-t px-4">
      <Button type="submit" size="sm" :disabled="!isFormValid">
        {{ t('settings.mcp.serverForm.submit') }}
      </Button>
    </div>
  </form>
</template>

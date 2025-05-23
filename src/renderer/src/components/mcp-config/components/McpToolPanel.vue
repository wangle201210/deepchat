<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { Icon } from '@iconify/vue'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useMcpStore } from '@/stores/mcp'
import { useI18n } from 'vue-i18n'
import McpJsonViewer from './McpJsonViewer.vue'
import type { MCPToolDefinition } from '@shared/presenter'

const mcpStore = useMcpStore()
const { t } = useI18n()

// 本地状态
const selectedTool = ref<MCPToolDefinition | null>(null)
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

// 选择工具
const selectTool = (tool: MCPToolDefinition) => {
  selectedTool.value = tool
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

// 格式化JSON输入
const formatToolInput = (toolName: string) => {
  try {
    const formatted = JSON.stringify(JSON.parse(localToolInputs.value[toolName]), null, 2)
    localToolInputs.value[toolName] = formatted
  } catch (e) {
    // 忽略格式化错误
  }
}

// 计算属性：获取工具参数描述
const toolParametersDescription = computed(() => {
  if (!selectedTool.value?.function.parameters?.properties) return []

  const properties = selectedTool.value.function.parameters.properties
  const required = selectedTool.value.function.parameters.required || []

  return Object.entries(properties).map(([key, prop]) => ({
    name: key,
    description: prop.description || '',
    type: prop.type || 'unknown',
    required: required.includes(key),
    annotations: prop.annotations
  }))
})
</script>

<template>
  <div class="h-full grid grid-cols-[280px_1fr] gap-6 overflow-hidden">
    <!-- 左侧工具列表 -->
    <div class="h-full flex flex-col overflow-hidden">
      <div class="mb-4">
        <h3 class="text-sm font-medium text-foreground mb-2">
          {{ t('mcp.tools.availableTools') }}
        </h3>
        <p class="text-xs text-muted-foreground">{{ t('mcp.tools.selectToolToDebug') }}</p>
      </div>

      <ScrollArea class="flex-1">
        <div v-if="mcpStore.toolsLoading" class="flex justify-center py-8">
          <Icon icon="lucide:loader" class="h-6 w-6 animate-spin text-muted-foreground" />
        </div>

        <div v-else-if="mcpStore.tools.length === 0" class="text-center py-8">
          <div
            class="mx-auto w-16 h-16 bg-muted/30 rounded-full flex items-center justify-center mb-3"
          >
            <Icon icon="lucide:wrench" class="h-6 w-6 text-muted-foreground" />
          </div>
          <p class="text-sm text-muted-foreground">{{ t('mcp.tools.noToolsAvailable') }}</p>
        </div>

        <div v-else class="space-y-2">
          <div
            v-for="tool in mcpStore.tools"
            :key="tool.function.name"
            class="group p-3 rounded-lg cursor-pointer transition-all duration-200 border border-transparent hover:border-border hover:bg-accent/50"
            :class="{
              'bg-accent border-border': selectedTool?.function.name === tool.function.name
            }"
            @click="selectTool(tool)"
          >
            <div class="flex items-start space-x-2">
              <Icon
                icon="lucide:function-square"
                class="h-4 w-4 text-primary mt-0.5 flex-shrink-0"
              />
              <div class="flex-1 min-w-0">
                <h4 class="text-sm font-medium text-foreground truncate">
                  {{ tool.function.name }}
                </h4>
                <p class="text-xs text-muted-foreground line-clamp-2 mt-1">
                  {{ tool.function.description || t('mcp.tools.noDescription') }}
                </p>
                <div class="flex items-center mt-2 space-x-1">
                  <Badge variant="outline" class="text-xs">
                    {{ tool.server.name }}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>

    <!-- 右侧操作区域 -->
    <div class="h-full flex flex-col overflow-hidden">
      <div v-if="!selectedTool" class="flex items-center justify-center h-full">
        <div class="text-center">
          <div
            class="mx-auto w-20 h-20 bg-muted/30 rounded-full flex items-center justify-center mb-4"
          >
            <Icon icon="lucide:mouse-pointer-click" class="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 class="text-lg font-medium text-foreground mb-2">{{ t('mcp.tools.selectTool') }}</h3>
          <p class="text-sm text-muted-foreground">{{ t('mcp.tools.selectToolDescription') }}</p>
        </div>
      </div>

      <div v-else class="h-full flex flex-col overflow-hidden">
        <!-- 工具信息头部 -->
        <div class="flex-shrink-0 pb-4 border-b">
          <div class="flex items-start space-x-3">
            <div class="p-2 bg-primary/10 rounded-lg">
              <Icon icon="lucide:function-square" class="h-5 w-5 text-primary" />
            </div>
            <div class="flex-1 min-w-0">
              <h2 class="text-lg font-semibold text-foreground">
                {{ selectedTool.function.name }}
              </h2>
              <p class="text-sm text-muted-foreground mt-1">
                {{ selectedTool.function.description || t('mcp.tools.noDescription') }}
              </p>
              <div class="flex items-center mt-2 space-x-2">
                <Badge variant="outline">{{ selectedTool.server.name }}</Badge>
              </div>
            </div>
          </div>
        </div>

        <ScrollArea class="flex-1 mt-4">
          <div class="space-y-6">
            <!-- 工具参数说明 -->
            <div v-if="toolParametersDescription.length > 0">
              <h3 class="text-sm font-medium text-foreground mb-3">
                {{ t('mcp.tools.parameters') }}
              </h3>
              <div class="space-y-3">
                <div
                  v-for="param in toolParametersDescription"
                  :key="param.name"
                  class="p-3 bg-muted/30 rounded-lg border border-border/30"
                >
                  <div class="flex items-center space-x-2 mb-1">
                    <code class="text-sm font-mono font-medium text-foreground">{{
                      param.name
                    }}</code>
                    <Badge v-if="param.required" variant="destructive" class="text-xs">
                      {{ t('mcp.tools.required') }}
                    </Badge>
                    <Badge variant="outline" class="text-xs">{{ param.type }}</Badge>
                  </div>
                  <p v-if="param.description" class="text-xs text-muted-foreground mb-2">
                    {{ param.description }}
                  </p>
                  <div v-if="param.annotations" class="text-xs text-muted-foreground">
                    <strong>{{ t('mcp.tools.annotations') }}:</strong>
                    {{ JSON.stringify(param.annotations) }}
                  </div>
                </div>
              </div>
            </div>

            <!-- 工具参数输入 -->
            <div>
              <div class="flex items-center justify-between mb-3">
                <h3 class="text-sm font-medium text-foreground">{{ t('mcp.tools.input') }}</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  class="h-7 text-xs"
                  @click="formatToolInput(selectedTool.function.name)"
                >
                  <Icon icon="lucide:align-left" class="mr-1 h-3 w-3" />
                  {{ t('common.format') }}
                </Button>
              </div>

              <div class="relative">
                <textarea
                  v-model="localToolInputs[selectedTool.function.name]"
                  class="flex h-32 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  :class="{ 'border-destructive': jsonError[selectedTool.function.name] }"
                  placeholder="{}"
                  @input="
                    validateJson(
                      localToolInputs[selectedTool.function.name],
                      selectedTool.function.name
                    )
                  "
                />
                <div
                  v-if="jsonError[selectedTool.function.name]"
                  class="absolute right-3 top-3 text-xs text-destructive"
                >
                  {{ t('mcp.tools.invalidJson') }}
                </div>
              </div>
              <p class="text-xs text-muted-foreground mt-2">
                {{ t('mcp.tools.inputHint') }}
              </p>
            </div>

            <!-- 执行按钮 -->
            <div>
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
                <Icon v-else icon="lucide:play" class="mr-2 h-4 w-4" />
                {{
                  mcpStore.toolLoadingStates[selectedTool.function.name]
                    ? t('mcp.tools.runningTool')
                    : t('mcp.tools.executeButton')
                }}
              </Button>
            </div>

            <!-- 结果显示 -->
            <div v-if="localToolResults[selectedTool.function.name]">
              <McpJsonViewer
                :content="localToolResults[selectedTool.function.name]"
                :title="t('mcp.tools.resultTitle')"
                readonly
              />
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useMcpStore } from '@/stores/mcp'
import { useI18n } from 'vue-i18n'
import McpJsonViewer from './McpJsonViewer.vue'
import type { PromptListEntry } from '@shared/presenter'

const mcpStore = useMcpStore()
const { t } = useI18n()

// 本地状态
const selectedPrompt = ref<string>('')
const promptResult = ref<string>('')
const promptParams = ref<string>('{}')
const promptLoading = ref(false)
const jsonPromptError = ref(false)

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

// 选择Prompt
const selectPrompt = (prompt: PromptListEntry) => {
  selectedPrompt.value = prompt.name
  promptResult.value = ''
}

// 调用Prompt
const callPrompt = async (prompt: PromptListEntry) => {
  if (!prompt) return
  if (!validatePromptJson(promptParams.value)) return

  try {
    promptLoading.value = true
    const params = JSON.parse(promptParams.value)
    const result = await mcpStore.getPrompt(prompt, params)

    // 处理返回结果
    if (result && typeof result === 'object') {
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

// 格式化JSON
const formatJson = (input: string): string => {
  try {
    const obj = JSON.parse(input)
    return JSON.stringify(obj, null, 2)
  } catch (e) {
    return input
  }
}

// 格式化提示参数
const formatPromptParams = () => {
  promptParams.value = formatJson(promptParams.value)
}

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
  <div class="h-full grid grid-cols-[280px_1fr] gap-6 overflow-hidden">
    <!-- 左侧提示模板列表 -->
    <div class="h-full flex flex-col overflow-hidden">
      <div class="mb-4">
        <h3 class="text-sm font-medium text-foreground mb-2">
          {{ t('mcp.prompts.availablePrompts') }}
        </h3>
        <p class="text-xs text-muted-foreground">{{ t('mcp.prompts.selectPromptToTest') }}</p>
      </div>

      <ScrollArea class="flex-1">
        <div v-if="mcpStore.toolsLoading" class="flex justify-center py-8">
          <Icon icon="lucide:loader" class="h-6 w-6 animate-spin text-muted-foreground" />
        </div>

        <div v-else-if="mcpStore.prompts.length === 0" class="text-center py-8">
          <div
            class="mx-auto w-16 h-16 bg-muted/30 rounded-full flex items-center justify-center mb-3"
          >
            <Icon icon="lucide:message-square" class="h-6 w-6 text-muted-foreground" />
          </div>
          <p class="text-sm text-muted-foreground">{{ t('mcp.prompts.noPromptsAvailable') }}</p>
        </div>

        <div v-else class="space-y-2">
          <div
            v-for="prompt in mcpStore.prompts"
            :key="prompt.name"
            class="group p-3 rounded-lg cursor-pointer transition-all duration-200 border border-transparent hover:border-border hover:bg-accent/50"
            :class="{ 'bg-accent border-border': selectedPrompt === prompt.name }"
            @click="selectPrompt(prompt)"
          >
            <div class="flex items-start space-x-2">
              <Icon
                icon="lucide:message-square-text"
                class="h-4 w-4 text-primary mt-0.5 flex-shrink-0"
              />
              <div class="flex-1 min-w-0">
                <h4 class="text-sm font-medium text-foreground truncate">{{ prompt.name }}</h4>
                <p class="text-xs text-muted-foreground line-clamp-2 mt-1">
                  {{ prompt.description || t('mcp.prompts.noDescription') }}
                </p>
                <div class="flex items-center mt-2 space-x-1">
                  <Badge variant="outline" class="text-xs">
                    {{ prompt.client.name }}
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
      <div v-if="!selectedPrompt" class="flex items-center justify-center h-full">
        <div class="text-center">
          <div
            class="mx-auto w-20 h-20 bg-muted/30 rounded-full flex items-center justify-center mb-4"
          >
            <Icon icon="lucide:mouse-pointer-click" class="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 class="text-lg font-medium text-foreground mb-2">
            {{ t('mcp.prompts.selectPrompt') }}
          </h3>
          <p class="text-sm text-muted-foreground">
            {{ t('mcp.prompts.selectPromptDescription') }}
          </p>
        </div>
      </div>

      <div v-else class="h-full flex flex-col overflow-hidden">
        <!-- 提示模板信息头部 -->
        <div class="flex-shrink-0 pb-4 border-b">
          <div class="flex items-start space-x-3">
            <div class="p-2 bg-primary/10 rounded-lg">
              <Icon icon="lucide:message-square-text" class="h-5 w-5 text-primary" />
            </div>
            <div class="flex-1 min-w-0">
              <h2 class="text-lg font-semibold text-foreground">{{ selectedPrompt }}</h2>
              <p v-if="selectedPromptObj?.description" class="text-sm text-muted-foreground mt-1">
                {{ selectedPromptObj.description }}
              </p>
              <div class="flex items-center mt-2 space-x-2">
                <Badge variant="outline">{{ selectedPromptObj?.client.name }}</Badge>
              </div>
            </div>
          </div>
        </div>

        <ScrollArea class="flex-1 mt-4">
          <div class="space-y-6">
            <!-- 参数描述区域 -->
            <div v-if="promptArgsDescription.length > 0">
              <h3 class="text-sm font-medium text-foreground mb-3">
                {{ t('mcp.prompts.parameters') }}
              </h3>
              <div class="space-y-3">
                <div
                  v-for="arg in promptArgsDescription"
                  :key="arg.name"
                  class="p-3 bg-muted/30 rounded-lg border border-border/30"
                >
                  <div class="flex items-center space-x-2 mb-1">
                    <code class="text-sm font-mono font-medium text-foreground">{{
                      arg.name
                    }}</code>
                    <Badge v-if="arg.required" variant="destructive" class="text-xs">
                      {{ t('mcp.prompts.required') }}
                    </Badge>
                  </div>
                  <p v-if="arg.description" class="text-xs text-muted-foreground">
                    {{ arg.description }}
                  </p>
                </div>
              </div>
            </div>

            <!-- 提示参数输入 -->
            <div>
              <div class="flex items-center justify-between mb-3">
                <h3 class="text-sm font-medium text-foreground">
                  {{ t('mcp.prompts.parameters') }}
                </h3>
                <div class="flex space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    class="h-7 text-xs"
                    @click="promptParams = defaultPromptParams"
                  >
                    <Icon icon="lucide:refresh-cw" class="mr-1 h-3 w-3" />
                    {{ t('mcp.prompts.resetToDefault') }}
                  </Button>
                  <Button variant="ghost" size="sm" class="h-7 text-xs" @click="formatPromptParams">
                    <Icon icon="lucide:align-left" class="mr-1 h-3 w-3" />
                    {{ t('common.format') }}
                  </Button>
                </div>
              </div>

              <div class="relative">
                <textarea
                  v-model="promptParams"
                  class="flex h-48 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  :class="{ 'border-destructive': jsonPromptError }"
                  placeholder="{}"
                  @input="validatePromptJson(promptParams)"
                  @blur="promptParams = formatJson(promptParams)"
                />
                <div v-if="jsonPromptError" class="absolute right-3 top-3 text-xs text-destructive">
                  {{ t('mcp.prompts.invalidJson') }}
                </div>
              </div>
              <p class="text-xs text-muted-foreground mt-2">
                {{ t('mcp.prompts.parametersHint') }}
              </p>
            </div>

            <!-- 执行按钮 -->
            <div>
              <Button
                class="w-full"
                :disabled="promptLoading || jsonPromptError"
                @click="callPrompt(selectedPromptObj as PromptListEntry)"
              >
                <Icon v-if="promptLoading" icon="lucide:loader" class="mr-2 h-4 w-4 animate-spin" />
                <Icon v-else icon="lucide:play" class="mr-2 h-4 w-4" />
                {{
                  promptLoading ? t('mcp.prompts.runningPrompt') : t('mcp.prompts.executeButton')
                }}
              </Button>
            </div>

            <!-- 结果显示 -->
            <div v-if="promptResult">
              <McpJsonViewer
                :content="promptResult"
                :title="t('mcp.prompts.resultTitle')"
                readonly
              />
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  </div>
</template>

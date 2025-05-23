<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { useI18n } from 'vue-i18n'
import { computed, ref } from 'vue'

interface ServerInfo {
  name: string
  icons: string
  descriptions: string
  command: string
  args: string[]
  isRunning: boolean
  isDefault: boolean
  type?: string
  baseUrl?: string
  errorMessage?: string
}

interface Props {
  server: ServerInfo
  isBuiltIn?: boolean
  isLoading?: boolean
  disabled?: boolean
}

interface Emits {
  (e: 'toggle'): void
  (e: 'toggleDefault'): void
  (e: 'edit'): void
  (e: 'remove'): void
  (e: 'viewLogs'): void
  (e: 'restart'): void
}

const props = defineProps<Props>()
defineEmits<Emits>()

const { t } = useI18n()
const isDetailsOpen = ref(false)

const getLocalizedServerName = (serverName: string) => {
  return t(`mcp.inmemory.${serverName}.name`, serverName)
}

const getLocalizedServerDesc = (serverName: string, fallbackDesc: string) => {
  return t(`mcp.inmemory.${serverName}.desc`, fallbackDesc)
}

// 计算服务器状态
const serverStatus = computed(() => {
  if (props.isLoading) return 'loading'
  if (props.server.errorMessage) return 'error'
  if (props.server.isRunning) return 'running'
  return 'stopped'
})
</script>

<template>
  <div
    class="bg-card border rounded-lg overflow-hidden transition-all duration-200 hover:shadow-md hover:border-input"
  >
    <!-- 主要内容 -->
    <div class="p-3">
      <div class="flex items-start justify-between">
        <!-- 左侧：服务器信息 -->
        <div class="flex items-start space-x-3 flex-1 min-w-0">
          <!-- 图标 -->
          <div class="text-xl flex-shrink-0 mt-0.5">{{ server.icons }}</div>

          <!-- 信息 -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center space-x-2 mb-1">
              <h3 class="text-sm font-medium truncate">
                {{ isBuiltIn ? getLocalizedServerName(server.name) : server.name }}
              </h3>

              <!-- 标识徽章 -->
              <div class="flex items-center space-x-1">
                <Badge v-if="isBuiltIn" variant="outline" class="text-xs h-4 px-1.5">
                  {{ t('settings.mcp.builtIn') }}
                </Badge>
                <TooltipProvider v-if="server.isDefault">
                  <Tooltip>
                    <TooltipTrigger>
                      <Icon icon="lucide:star" class="w-3.5 h-3.5 text-orange-500" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p class="text-xs">{{ t('settings.mcp.default') }}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>

            <!-- 描述 -->
            <p class="text-xs text-muted-foreground line-clamp-2 mb-2">
              {{
                isBuiltIn
                  ? getLocalizedServerDesc(server.name, server.descriptions)
                  : server.descriptions
              }}
            </p>

            <!-- 状态 -->
            <div class="flex items-center space-x-2">
              <div class="flex items-center space-x-1.5">
                <div
                  :class="[
                    'w-2 h-2 rounded-full',
                    serverStatus === 'running'
                      ? 'bg-green-500'
                      : serverStatus === 'loading'
                        ? 'bg-blue-500 animate-pulse'
                        : serverStatus === 'error'
                          ? 'bg-red-500'
                          : 'bg-gray-400'
                  ]"
                />
                <span
                  class="text-xs"
                  :class="[
                    serverStatus === 'running'
                      ? 'text-green-600 dark:text-green-400'
                      : serverStatus === 'loading'
                        ? 'text-blue-600 dark:text-blue-400'
                        : serverStatus === 'error'
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-muted-foreground'
                  ]"
                >
                  {{
                    serverStatus === 'running'
                      ? t('settings.mcp.running')
                      : serverStatus === 'loading'
                        ? t('settings.mcp.starting')
                        : serverStatus === 'error'
                          ? t('settings.mcp.error')
                          : t('settings.mcp.stopped')
                  }}
                </span>
              </div>

              <!-- 错误提示 -->
              <TooltipProvider v-if="server.errorMessage">
                <Tooltip>
                  <TooltipTrigger>
                    <Icon icon="lucide:alert-circle" class="w-3.5 h-3.5 text-red-500" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p class="text-xs max-w-xs">{{ server.errorMessage }}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </div>

        <!-- 右侧：控制区域 -->
        <div class="flex items-center space-x-2 shrink-0 ml-3">
          <!-- 启用开关 -->
          <div class="flex items-center space-x-1.5">
            <Switch
              :checked="server.isRunning"
              :disabled="disabled || isLoading"
              @update:checked="$emit('toggle')"
            />
          </div>

          <!-- 设为默认按钮 -->
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  variant="ghost"
                  size="icon"
                  class="h-7 w-7"
                  :class="
                    server.isDefault
                      ? 'text-orange-500 hover:text-orange-600'
                      : 'text-muted-foreground hover:text-foreground'
                  "
                  :disabled="disabled"
                  @click="$emit('toggleDefault')"
                >
                  <Icon
                    :icon="server.isDefault ? 'lucide:star' : 'lucide:star-off'"
                    class="h-3.5 w-3.5"
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p class="text-xs">
                  {{
                    server.isDefault
                      ? t('settings.mcp.removeDefault')
                      : t('settings.mcp.setAsDefault')
                  }}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <!-- 更多操作菜单 -->
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <Button variant="ghost" size="icon" class="h-7 w-7">
                <Icon icon="lucide:more-horizontal" class="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem @click="$emit('edit')" :disabled="disabled">
                <Icon icon="lucide:edit-3" class="h-4 w-4 mr-2" />
                {{ t('settings.mcp.editServer') }}
              </DropdownMenuItem>
              <DropdownMenuItem
                v-if="server.isRunning"
                @click="$emit('restart')"
                :disabled="disabled || isLoading"
              >
                <Icon icon="lucide:rotate-cw" class="h-4 w-4 mr-2" />
                {{ t('settings.mcp.restartServer') }}
              </DropdownMenuItem>
              <DropdownMenuItem @click="$emit('viewLogs')" :disabled="disabled">
                <Icon icon="lucide:file-text" class="h-4 w-4 mr-2" />
                {{ t('settings.mcp.viewLogs') }}
              </DropdownMenuItem>
              <DropdownMenuSeparator v-if="!isBuiltIn" />
              <DropdownMenuItem
                v-if="!isBuiltIn"
                @click="$emit('remove')"
                :disabled="disabled"
                class="text-destructive focus:text-destructive"
              >
                <Icon icon="lucide:trash-2" class="h-4 w-4 mr-2" />
                {{ t('settings.mcp.removeServer') }}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>

    <!-- 可展开的技术详情 -->
    <Collapsible v-model:open="isDetailsOpen">
      <div class="border-t border-border bg-muted">
        <CollapsibleTrigger
          class="w-full px-3 py-2 flex items-center justify-between text-xs text-muted-foreground hover:bg-muted/30 transition-colors"
        >
          <span>{{ t('settings.mcp.technicalDetails') }}</span>
          <Icon
            icon="lucide:chevron-down"
            class="h-3 w-3 transition-transform"
            :class="isDetailsOpen ? 'rotate-180' : ''"
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div class="px-3 pb-3 space-y-2">
            <!-- 服务器类型 -->
            <div class="flex items-center space-x-2 text-xs">
              <Icon
                :icon="server.type === 'http' ? 'lucide:globe' : 'lucide:terminal'"
                class="h-3 w-3 text-muted-foreground"
              />
              <span class="text-muted-foreground">
                {{
                  server.type === 'http'
                    ? t('settings.mcp.httpServer')
                    : t('settings.mcp.localProcess')
                }}
              </span>
            </div>

            <!-- 命令/URL -->
            <div class="bg-secondary rounded-md p-2">
              <code class="text-xs font-mono text-secondary-foreground break-all">
                {{
                  server.type === 'http'
                    ? server.baseUrl
                    : `${server.command} ${server.args.join(' ')}`
                }}
              </code>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  </div>
</template>

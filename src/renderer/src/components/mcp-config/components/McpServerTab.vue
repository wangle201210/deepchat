<script setup lang="ts">
import { ref, computed } from 'vue'
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
import { useMcpStore } from '@/stores/mcp'
import { useSettingsStore } from '@/stores/settings'
import { useI18n } from 'vue-i18n'
import { useToast } from '@/components/ui/toast'
import { useRouter } from 'vue-router'
import McpServerCard from './McpServerCard.vue'
import McpServerForm from '../mcpServerForm.vue'
import type { MCPServerConfig } from '@shared/presenter'

const mcpStore = useMcpStore()
const settingsStore = useSettingsStore()
const { t } = useI18n()
const { toast } = useToast()
const router = useRouter()

// 对话框状态
const isAddServerDialogOpen = ref(false)
const isEditServerDialogOpen = ref(false)
const isResetConfirmDialogOpen = ref(false)
const isRemoveConfirmDialogOpen = ref(false)
const selectedServer = ref<string>('')

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

// 事件处理函数
const handleAddServer = async (serverName: string, serverConfig: MCPServerConfig) => {
  const result = await mcpStore.addServer(serverName, serverConfig)
  if (result.success) {
    isAddServerDialogOpen.value = false
  }
}

const handleEditServer = async (serverName: string, serverConfig: Partial<MCPServerConfig>) => {
  const success = await mcpStore.updateServer(serverName, serverConfig)
  if (success) {
    isEditServerDialogOpen.value = false
    selectedServer.value = ''
  }
}

const handleRemoveServer = async (serverName: string) => {
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

const confirmRemoveServer = async () => {
  const serverName = selectedServer.value
  await mcpStore.removeServer(serverName)
  isRemoveConfirmDialogOpen.value = false
}

const handleToggleDefaultServer = async (serverName: string) => {
  const isDefault = mcpStore.config.defaultServers.includes(serverName)
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

const handleToggleServer = async (serverName: string) => {
  if (mcpStore.serverLoadingStates[serverName]) {
    return
  }
  const success = await mcpStore.toggleServer(serverName)
  if (!success) {
    const isRunning = mcpStore.serverStatuses[serverName]
    toast({
      title: t('common.error.operationFailed'),
      description: `${serverName} ${isRunning ? t('settings.mcp.stopped') : t('settings.mcp.running')}${t('common.error.requestFailed')}`,
      variant: 'destructive'
    })
  }
}

const handleResetToDefaultServers = async () => {
  const success = await mcpStore.resetToDefaultServers()
  if (success) {
    isResetConfirmDialogOpen.value = false
  } else {
    toast({
      title: t('common.error.operationFailed'),
      description: t('common.error.requestFailed'),
      variant: 'destructive'
    })
  }
}

const openEditServerDialog = (serverName: string) => {
  // 特殊服务器跳转到对应设置页面
  const specialServers = {
    difyKnowledge: 'dify',
    ragflowKnowledge: 'ragflow',
    fastGptKnowledge: 'fastgpt'
  }

  if (specialServers[serverName]) {
    router.push({
      name: 'settings-knowledge-base',
      query: { subtab: specialServers[serverName] }
    })
    return
  }

  selectedServer.value = serverName
  isEditServerDialogOpen.value = true
}
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- 服务器列表 - 占满主要空间 -->
    <ScrollArea class="flex-1 px-3 pt-2">
      <div v-if="mcpStore.configLoading" class="flex justify-center py-8">
        <div class="text-center">
          <Icon
            icon="lucide:loader"
            class="h-6 w-6 animate-spin mx-auto mb-2 text-muted-foreground"
          />
          <p class="text-xs text-muted-foreground">{{ t('common.loading') }}</p>
        </div>
      </div>

      <div v-else-if="mcpStore.serverList.length === 0" class="text-center py-8">
        <div
          class="mx-auto w-16 h-16 bg-muted/30 rounded-full flex items-center justify-center mb-3"
        >
          <Icon icon="lucide:server-off" class="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 class="text-base font-medium text-foreground mb-2">
          {{ t('settings.mcp.noServersFound') }}
        </h3>
        <p class="text-xs text-muted-foreground mb-3 px-4">
          {{ t('settings.mcp.noServersDescription') }}
        </p>
      </div>

      <div v-else class="space-y-3 pb-3">
        <!-- 内置服务 -->
        <div v-if="inMemoryServers.length > 0">
          <div class="flex items-center space-x-2 mb-2">
            <Icon icon="lucide:shield-check" class="h-3 w-3 text-blue-600" />
            <h3 class="text-xs font-medium text-foreground">
              {{ t('settings.mcp.builtInServers') }}
            </h3>
            <div
              class="text-xs text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded-full text-[10px]"
            >
              {{ inMemoryServers.length }}
            </div>
          </div>
          <div class="grid gap-2">
            <McpServerCard
              v-for="server in inMemoryServers"
              :key="server.name"
              :server="server"
              :is-built-in="true"
              :is-loading="mcpStore.serverLoadingStates[server.name]"
              :disabled="mcpStore.configLoading"
              @toggle="handleToggleServer(server.name)"
              @toggle-default="handleToggleDefaultServer(server.name)"
              @edit="openEditServerDialog(server.name)"
            />
          </div>
        </div>

        <!-- 自定义服务 -->
        <div v-if="regularServers.length > 0">
          <div class="flex items-center space-x-2 mb-2">
            <Icon icon="lucide:settings" class="h-3 w-3 text-green-600" />
            <h3 class="text-xs font-medium text-foreground">
              {{ t('settings.mcp.customServers') }}
            </h3>
            <div
              class="text-xs text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded-full text-[10px]"
            >
              {{ regularServers.length }}
            </div>
          </div>
          <div class="grid gap-2">
            <McpServerCard
              v-for="server in regularServers"
              :key="server.name"
              :server="server"
              :is-built-in="false"
              :is-loading="mcpStore.serverLoadingStates[server.name]"
              :disabled="mcpStore.configLoading"
              @toggle="handleToggleServer(server.name)"
              @toggle-default="handleToggleDefaultServer(server.name)"
              @edit="openEditServerDialog(server.name)"
              @remove="handleRemoveServer(server.name)"
            />
          </div>
        </div>
      </div>
    </ScrollArea>

    <!-- 底部操作栏 -->
    <div
      class="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
    >
      <div class="flex items-center justify-between p-3">
        <!-- 左侧：服务器统计信息 -->
        <div class="flex items-center space-x-3">
          <div class="flex items-center space-x-1">
            <Icon icon="lucide:server" class="h-3 w-3 text-muted-foreground" />
            <span class="text-xs text-muted-foreground">
              {{ t('settings.mcp.totalServers') }}: {{ mcpStore.serverList.length }}
            </span>
          </div>
          <div class="flex items-center space-x-1" v-if="mcpStore.serverList.length > 0">
            <Icon icon="lucide:play" class="h-3 w-3 text-green-600" />
            <span class="text-xs text-green-600">
              {{ mcpStore.serverList.filter((s) => s.isRunning).length }}
            </span>
          </div>
        </div>

        <!-- 右侧：操作按钮 -->
        <div class="flex space-x-2">
          <Dialog v-model:open="isResetConfirmDialogOpen">
            <DialogTrigger as-child>
              <Button variant="outline" size="sm" class="h-8 px-3 text-xs">
                <Icon icon="lucide:refresh-cw" class="mr-1.5 h-3 w-3" />
                {{ t('common.reset') }}
              </Button>
            </DialogTrigger>
            <DialogContent class="w-[90vw] max-w-[400px]">
              <DialogHeader>
                <DialogTitle class="text-base">{{
                  t('settings.mcp.resetConfirmTitle')
                }}</DialogTitle>
                <DialogDescription class="text-sm">
                  {{ t('settings.mcp.resetConfirmDescription') }}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter class="flex-row gap-2 justify-end">
                <Button variant="outline" size="sm" @click="isResetConfirmDialogOpen = false">
                  {{ t('common.cancel') }}
                </Button>
                <Button variant="default" size="sm" @click="handleResetToDefaultServers">
                  {{ t('settings.mcp.resetConfirm') }}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog v-model:open="isAddServerDialogOpen">
            <DialogTrigger as-child>
              <Button size="sm" class="h-8 px-3 text-xs">
                <Icon icon="lucide:plus" class="mr-1.5 h-3 w-3" />
                {{ t('common.add') }}
              </Button>
            </DialogTrigger>
            <DialogContent class="w-[95vw] max-w-[500px] px-0 h-[85vh] max-h-[500px] flex flex-col">
              <DialogHeader class="px-3 flex-shrink-0 pb-2">
                <DialogTitle class="text-base">{{
                  t('settings.mcp.addServerDialog.title')
                }}</DialogTitle>
              </DialogHeader>
              <McpServerForm
                :default-json-config="settingsStore.mcpInstallCache || undefined"
                @submit="handleAddServer"
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>

    <!-- 编辑服务器对话框 -->
    <Dialog v-model:open="isEditServerDialogOpen">
      <DialogContent class="w-[95vw] max-w-[500px] px-0 h-[85vh] max-h-[500px] flex flex-col">
        <DialogHeader class="px-3 flex-shrink-0 pb-2">
          <DialogTitle class="text-base">{{
            t('settings.mcp.editServerDialog.title')
          }}</DialogTitle>
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
      <DialogContent class="w-[90vw] max-w-[380px]">
        <DialogHeader>
          <DialogTitle class="text-base">{{
            t('settings.mcp.removeServerDialog.title')
          }}</DialogTitle>
          <DialogDescription class="text-sm">
            {{ t('settings.mcp.confirmRemoveServer', { name: selectedServer }) }}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter class="flex-row gap-2 justify-end">
          <Button variant="outline" size="sm" @click="isRemoveConfirmDialogOpen = false">
            {{ t('common.cancel') }}
          </Button>
          <Button variant="destructive" size="sm" @click="confirmRemoveServer">
            {{ t('common.confirm') }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

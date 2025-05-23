<script setup lang="ts">
import { ref, computed } from 'vue'
import { Icon } from '@iconify/vue'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useMcpStore } from '@/stores/mcp'
import { useI18n } from 'vue-i18n'
import McpJsonViewer from './McpJsonViewer.vue'
import type { ResourceListEntry } from '@shared/presenter'

const mcpStore = useMcpStore()
const { t } = useI18n()

// 本地状态
const selectedResource = ref<string>('')
const resourceContent = ref<string>('')
const resourceLoading = ref(false)

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
    const result = await mcpStore.readResource(resource)

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

// 添加计算属性：获取当前选中的资源对象
const selectedResourceObj = computed(() => {
  return mcpStore.resources.find((r) => r.uri === selectedResource.value)
})

// 获取资源类型图标
const getResourceIcon = (uri: string) => {
  if (uri.endsWith('.json')) return 'lucide:file-json'
  if (uri.endsWith('.txt')) return 'lucide:file-text'
  if (uri.endsWith('.md')) return 'lucide:file-text'
  if (uri.endsWith('.csv')) return 'lucide:file-spreadsheet'
  if (uri.endsWith('.xml')) return 'lucide:file-code'
  if (uri.startsWith('http')) return 'lucide:globe'
  return 'lucide:file'
}

// 获取资源类型
const getResourceType = (uri: string) => {
  if (uri.endsWith('.json')) return 'JSON'
  if (uri.endsWith('.txt')) return 'Text'
  if (uri.endsWith('.md')) return 'Markdown'
  if (uri.endsWith('.csv')) return 'CSV'
  if (uri.endsWith('.xml')) return 'XML'
  if (uri.startsWith('http')) return 'URL'
  return 'File'
}
</script>

<template>
  <div class="h-full grid grid-cols-[280px_1fr] gap-6 overflow-hidden">
    <!-- 左侧资源列表 -->
    <div class="h-full flex flex-col overflow-hidden">
      <div class="mb-4">
        <h3 class="text-sm font-medium text-foreground mb-2">
          {{ t('mcp.resources.availableResources') }}
        </h3>
        <p class="text-xs text-muted-foreground">{{ t('mcp.resources.selectResourceToView') }}</p>
      </div>

      <ScrollArea class="flex-1">
        <div v-if="mcpStore.toolsLoading" class="flex justify-center py-8">
          <Icon icon="lucide:loader" class="h-6 w-6 animate-spin text-muted-foreground" />
        </div>

        <div v-else-if="mcpStore.resources.length === 0" class="text-center py-8">
          <div
            class="mx-auto w-16 h-16 bg-muted/30 rounded-full flex items-center justify-center mb-3"
          >
            <Icon icon="lucide:folder" class="h-6 w-6 text-muted-foreground" />
          </div>
          <p class="text-sm text-muted-foreground">{{ t('mcp.resources.noResourcesAvailable') }}</p>
        </div>

        <div v-else class="space-y-2">
          <div
            v-for="resource in mcpStore.resources"
            :key="resource.uri"
            class="group p-3 rounded-lg cursor-pointer transition-all duration-200 border border-transparent hover:border-border hover:bg-accent/50"
            :class="{ 'bg-accent border-border': selectedResource === resource.uri }"
            @click="selectResource(resource)"
          >
            <div class="flex items-start space-x-2">
              <Icon
                :icon="getResourceIcon(resource.uri)"
                class="h-4 w-4 text-primary mt-0.5 flex-shrink-0"
              />
              <div class="flex-1 min-w-0">
                <h4 class="text-sm font-medium text-foreground truncate">
                  {{ resource.name || resource.uri }}
                </h4>
                <p class="text-xs text-muted-foreground truncate mt-1">
                  {{ resource.uri }}
                </p>
                <div class="flex items-center mt-2 space-x-1">
                  <Badge variant="outline" class="text-xs">
                    {{ resource.client.name }}
                  </Badge>
                  <Badge variant="secondary" class="text-xs">
                    {{ getResourceType(resource.uri) }}
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
      <div v-if="!selectedResource" class="flex items-center justify-center h-full">
        <div class="text-center">
          <div
            class="mx-auto w-20 h-20 bg-muted/30 rounded-full flex items-center justify-center mb-4"
          >
            <Icon icon="lucide:mouse-pointer-click" class="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 class="text-lg font-medium text-foreground mb-2">
            {{ t('mcp.resources.selectResource') }}
          </h3>
          <p class="text-sm text-muted-foreground">
            {{ t('mcp.resources.selectResourceDescription') }}
          </p>
        </div>
      </div>

      <div v-else class="h-full flex flex-col overflow-hidden">
        <!-- 资源信息头部 -->
        <div class="flex-shrink-0 pb-4 border-b">
          <div class="flex items-start space-x-3">
            <div class="p-2 bg-primary/10 rounded-lg">
              <Icon :icon="getResourceIcon(selectedResource)" class="h-5 w-5 text-primary" />
            </div>
            <div class="flex-1 min-w-0">
              <h2 class="text-lg font-semibold text-foreground truncate">
                {{ selectedResourceObj?.name || selectedResource }}
              </h2>
              <p class="text-sm text-muted-foreground mt-1 truncate">
                {{ selectedResource }}
              </p>
              <div class="flex items-center mt-2 space-x-2">
                <Badge variant="outline">{{ selectedResourceObj?.client.name }}</Badge>
                <Badge variant="secondary">{{ getResourceType(selectedResource) }}</Badge>
              </div>
            </div>
          </div>
        </div>

        <ScrollArea class="flex-1 mt-4">
          <div class="space-y-6">
            <!-- 加载资源按钮 -->
            <div>
              <Button
                class="w-full"
                :disabled="resourceLoading"
                @click="loadResourceContent(selectedResourceObj as ResourceListEntry)"
              >
                <Icon
                  v-if="resourceLoading"
                  icon="lucide:loader"
                  class="mr-2 h-4 w-4 animate-spin"
                />
                <Icon v-else icon="lucide:download" class="mr-2 h-4 w-4" />
                {{ resourceLoading ? t('mcp.resources.loading') : t('mcp.resources.loadContent') }}
              </Button>
            </div>

            <!-- 资源内容显示 -->
            <div v-if="resourceContent || resourceLoading">
              <McpJsonViewer
                :content="resourceContent"
                :loading="resourceLoading"
                :title="t('mcp.resources.contentTitle')"
                readonly
              />
            </div>

            <!-- 空状态 -->
            <div v-else class="text-center py-12">
              <div
                class="mx-auto w-16 h-16 bg-muted/30 rounded-full flex items-center justify-center mb-4"
              >
                <Icon icon="lucide:file-text" class="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 class="text-sm font-medium text-foreground mb-2">
                {{ t('mcp.resources.noContentLoaded') }}
              </h3>
              <p class="text-xs text-muted-foreground">{{ t('mcp.resources.clickLoadToView') }}</p>
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useMcpStore } from '@/stores/mcp'
import {
  McpTabHeader,
  McpServerTab,
  McpToolPanel,
  McpPromptPanel,
  McpResourceViewer
} from './components'

// 使用MCP Store
const mcpStore = useMcpStore()
// 使用路由
const route = useRoute()

// 本地UI状态
const activeTab = ref<'servers' | 'tools' | 'prompts' | 'resources'>('servers')

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

// 监听URL查询参数，设置活动标签页
watch(
  () => route.query.subtab,
  (newSubtab) => {
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
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- 标签头部 -->
    <McpTabHeader v-model:active-tab="activeTab" />

    <!-- 内容区域 -->
    <div class="flex-1 overflow-hidden">
      <!-- 服务器配置选项卡 -->
      <McpServerTab v-if="activeTab === 'servers'" />

      <!-- 工具调试选项卡 -->
      <McpToolPanel v-if="activeTab === 'tools'" />

      <!-- 提示模板选项卡 -->
      <McpPromptPanel v-if="activeTab === 'prompts'" />

      <!-- 资源选项卡 -->
      <McpResourceViewer v-if="activeTab === 'resources'" />
    </div>
  </div>
</template>

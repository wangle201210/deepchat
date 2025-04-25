<template>
  <div
    class="flex flex-col overflow-hidden w-full h-full rounded-t-lg rounded-b-md border border-zinc-500/10 dark:border-zinc-100/10"
  >
    <keep-alive>
      <component
        :is="nodeComponents[currentTab?.viewType ?? ''] || fallbackComponent"
        :key="currentTab?.id"
      />
    </keep-alive>
  </div>
</template>
<script setup lang="ts">
import { useTabStore } from '@/stores/tab'
import { computed, h } from 'vue'
import ChatTabView from '@/views/ChatTabView.vue'
import SettingsTabView from '@/views/SettingsTabView.vue'

const tabStore = useTabStore()

const currentTab = computed(() => {
  return tabStore.tabs.find((tab) => tab.id === tabStore.currentTabId)
})

const nodeComponents = {
  chat: ChatTabView,
  settings: SettingsTabView
}

const fallbackComponent = () => {
  return h('div', 'No component found')
}
</script>

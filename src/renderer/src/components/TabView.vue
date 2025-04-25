<template>
  <div class="flex flex-col overflow-hidden w-full h-full">
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

const tabStore = useTabStore()

const currentTab = computed(() => {
  return tabStore.tabs.find((tab) => tab.id === tabStore.currentTabId)
})

const nodeComponents = {
  chat: ChatTabView
}

const fallbackComponent = () => {
  return h('div', 'No component found')
}
</script>

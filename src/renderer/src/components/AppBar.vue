<template>
  <div class="h-10 flex-shrink-0 w-full flex items-center justify-between select-none">
    <!-- App title/content in center -->
    <div
      :class="[
        'flex-1 text-center text-sm font-medium h-full flex flex-row items-center justify-start',
        isMacOS ? 'pl-20 pr-2' : 'px-4'
      ]"
    >
      <AppBarTabItem
        v-for="tab in tabStore.tabs"
        :key="tab.id"
        :active="tab.id === tabStore.currentTabId"
        @click="tabStore.setCurrentTabId(tab.id)"
      >
        <img src="@/assets/logo.png" class="w-4 h-4 mr-2 rounded-sm" />DeepChat</AppBarTabItem
      >
      <Button
        variant="ghost"
        class="text-xs ml-2 font-medium px-2 h-6 bg-transparent rounded-md flex items-center justify-center"
        @click="openNewTab"
      >
        <Icon icon="lucide:plus" class="w-4 h-4" />
      </Button>
      <div class="flex-1 window-drag-region w-0 h-full">&nbsp;</div>
      <Button
        variant="ghost"
        class="text-xs font-medium px-2 h-7 bg-transparent rounded-md flex items-center justify-center"
      >
        <Icon icon="lucide:settings" class="w-4 h-4" />
      </Button>
    </div>

    <!-- Windows/Linux window controls (only shown on Windows/Linux) -->
    <div v-if="!isMacOS" class="flex h-10">
      <button
        class="inline-flex items-center justify-center h-full w-12 hover:bg-muted"
        @click="minimizeWindow"
      >
        <MinusIcon class="h-4 w-4" />
      </button>
      <button
        class="inline-flex items-center justify-center h-full w-12 hover:bg-muted"
        @click="toggleMaximize"
      >
        <MaximizeIcon v-if="!isMaximized" class="h-4 w-4" />
        <RestoreIcon v-else class="h-4 w-4" />
      </button>
      <button
        class="inline-flex items-center justify-center h-full w-12 hover:bg-destructive hover:text-destructive-foreground"
        @click="closeWindow"
      >
        <XIcon class="h-4 w-4" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { MinusIcon, XIcon } from 'lucide-vue-next'
import MaximizeIcon from './icons/MaximizeIcon.vue'
import RestoreIcon from './icons/RestoreIcon.vue'
import { usePresenter } from '@/composables/usePresenter'
import { Button } from './ui/button'
import { Icon } from '@iconify/vue'
import AppBarTabItem from './app-bar/AppBarTabItem.vue'
import { useTabStore } from '@/stores/tab'
const tabStore = useTabStore()
const windowPresenter = usePresenter('windowPresenter')
const devicePresenter = usePresenter('devicePresenter')

const isMacOS = ref(false)
const isMaximized = ref(false)

const { ipcRenderer } = window.electron

onMounted(() => {
  // Listen for window maximize/unmaximize events
  devicePresenter.getDeviceInfo().then((deviceInfo) => {
    isMacOS.value = deviceInfo.platform === 'darwin'
  })
  ipcRenderer?.on('window-maximized', () => {
    isMaximized.value = true
  })
  ipcRenderer?.on('window-unmaximized', () => {
    isMaximized.value = false
  })
})

const openNewTab = () => {
  tabStore.addTab({
    name: 'New Tab',
    icon: 'lucide:plus',
    viewType: 'chat'
  })
}

const minimizeWindow = () => {
  windowPresenter.minimize()
}

const toggleMaximize = () => {
  windowPresenter.maximize()
}

const closeWindow = () => {
  windowPresenter.close()
}
</script>

<style scoped>
.window-drag-region {
  -webkit-app-region: drag;
}

button {
  -webkit-app-region: no-drag;
}
</style>

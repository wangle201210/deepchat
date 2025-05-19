<template>
  <div class="h-10 flex-shrink-0 w-full flex items-center justify-between select-none">
    <!-- App title/content in center -->
    <div
      :class="[
        'flex-1 text-center text-sm font-medium h-full flex flex-row items-center justify-start gap-1 ',
        isMacOS ? (isFullscreened ? 'pl-2 pr-2' : 'pl-20 pr-2') : 'px-2'
      ]"
    >
      <AppBarTabItem
        v-for="(tab, idx) in tabStore.tabs"
        :key="tab.id"
        :active="tab.id === tabStore.currentTabId"
        :size="tabStore.tabs.length"
        :index="idx"
        @click="tabStore.setCurrentTabId(tab.id)"
        @close="tabStore.removeTab(tab.id)"
        @dragstart="onTabDragStart(tab.id, $event)"
      >
        <img src="@/assets/logo.png" class="w-4 h-4 mr-2 rounded-sm" />
        {{ tab.title ?? 'DeepChat' }}
      </AppBarTabItem>
      <Button
        variant="ghost"
        class="text-xs ml-1 font-medium px-2 h-6 bg-transparent rounded-md flex items-center justify-center hover:bg-zinc-500/20"
        @click="openNewTab"
      >
        <Icon icon="lucide:plus" class="w-4 h-4" />
      </Button>
      <div class="flex-1 window-drag-region w-0 h-full">&nbsp;</div>
      <Button
        variant="ghost"
        class="text-xs font-medium px-2 h-7 bg-transparent rounded-md flex items-center justify-center"
        @click="onThemeClick"
      >
        <Icon v-if="themeStore.themeMode === 'dark'" icon="lucide:moon" class="w-4 h-4" />
        <Icon v-else-if="themeStore.themeMode === 'light'" icon="lucide:sun" class="w-4 h-4" />
        <Icon v-else icon="lucide:monitor" class="w-4 h-4" />
      </Button>
      <Button
        variant="ghost"
        class="text-xs font-medium px-2 h-7 bg-transparent rounded-md flex items-center justify-center"
        @click="openSettings"
      >
        <Icon icon="lucide:settings" class="w-4 h-4" />
      </Button>
      <Button
        class="text-xs font-medium px-2 h-7 bg-transparent rounded-md flex items-center justify-center"
        @click="openNewWindow"
      >
        <Icon v-if="isMacOS" icon="lucide:app-window-mac" class="w-4 h-4" />
        <Icon v-else icon="lucide:app-window" class="w-4 h-4" />
      </Button>
    </div>

    <div v-if="!isMacOS" class="flex h-10">
      <button
        class="inline-flex items-center justify-center h-full w-12 hover:bg-secondary"
        @click="minimizeWindow"
      >
        <MinusIcon class="h-4 w-4" />
      </button>
      <button
        class="inline-flex items-center justify-center h-full w-12 hover:bg-secondary"
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

    <div v-else class="px-4"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { MinusIcon, XIcon } from 'lucide-vue-next'
import MaximizeIcon from './icons/MaximizeIcon.vue'
import RestoreIcon from './icons/RestoreIcon.vue'
import { usePresenter } from '@/composables/usePresenter'
import { Button } from '@/components/ui/button'
import { Icon } from '@iconify/vue'
import AppBarTabItem from './app-bar/AppBarTabItem.vue'
import { useTabStore } from '@shell/stores/tab'
import { useThemeStore } from '@/stores/theme'
const tabStore = useTabStore()
const windowPresenter = usePresenter('windowPresenter')
const devicePresenter = usePresenter('devicePresenter')
const tabPresenter = usePresenter('tabPresenter')

const isMacOS = ref(false)
const isMaximized = ref(false)
const isFullscreened = ref(false)

const { ipcRenderer } = window.electron

const themeStore = useThemeStore()

let draggedTabId: number | null = null

const onTabDragStart = (tabId: number, event: DragEvent) => {
  const tab = tabStore.tabs.find((t) => t.id === tabId)
  if (!tab) {
    console.warn(`Tab with id ${tabId} not found for drag start.`)
    return
  }

  if (event.dataTransfer) {
    event.dataTransfer.setData('text/plain', tabId.toString())
    event.dataTransfer.effectAllowed = 'none'
    draggedTabId = tabId
    console.log('onTabDragStart - Tab ID:', tabId, 'Name:', tab.title)

    // Create the drag preview element
    const preview = document.createElement('div')
    preview.style.position = 'absolute'
    preview.style.top = '-1000px'
    preview.style.left = '-1000px'
    preview.style.backgroundColor = 'hsl(var(--background))'
    preview.style.color = 'hsl(var(--foreground))'
    preview.style.border = `1px solid hsl(var(--border))`
    preview.style.borderRadius = '6px'
    preview.style.padding = '48px'
    preview.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1), 0 4px 8px rgba(0,0,0,0.1)'
    preview.style.fontSize = '13px'
    preview.style.fontFamily = 'inherit'
    preview.style.display = 'inline-block'
    preview.style.whiteSpace = 'nowrap'
    preview.style.zIndex = '9999'

    preview.textContent = tab.title || 'Untitled Tab'

    document.body.appendChild(preview)
    event.dataTransfer.setDragImage(preview, 10, 10)

    setTimeout(() => {
      if (preview.parentNode === document.body) {
        document.body.removeChild(preview)
      }
    }, 0)
  }
}

const handleDragOver = (event: DragEvent) => {
  event.preventDefault()
}

const handleDragEnd = async (event: DragEvent) => {
  console.log('handleDragEnd', event.clientX, event.clientY, window.innerWidth, window.innerHeight)
  if (tabStore.tabs.length <= 1) {
    event.preventDefault()
    return
  }
  if (draggedTabId && event.dataTransfer?.dropEffect === 'none') {
    // Check if the mouse is outside the window bounds
    // This is a simplified check; more robust checking might be needed
    const isOutsideWindow =
      event.clientX <= 0 ||
      event.clientY <= 0 ||
      event.clientX >= window.innerWidth ||
      event.clientY >= window.innerHeight

    if (isOutsideWindow) {
      console.log('Tab dragged outside window:', draggedTabId)
      // Call main process to move tab to new window
      await tabPresenter.moveTabToNewWindow(draggedTabId, event.clientX, event.clientY)
    }
  }
  draggedTabId = null
}

const onThemeClick = () => {
  console.log('onThemeClick')
  themeStore.cycleTheme()
}

onMounted(() => {
  console.log('onMounted', tabStore.tabs)
  // Listen for window maximize/unmaximize events
  devicePresenter.getDeviceInfo().then((deviceInfo) => {
    isMacOS.value = deviceInfo.platform === 'darwin'
  })
  ipcRenderer?.on('window:maximized', () => {
    isMaximized.value = true
  })
  ipcRenderer?.on('window-fullscreened', () => {
    isFullscreened.value = true
  })
  ipcRenderer?.on('window:unmaximized', () => {
    isMaximized.value = false
  })
  ipcRenderer?.on('window-unfullscreened', () => {
    isFullscreened.value = false
  })

  window.addEventListener('dragover', handleDragOver)
  window.addEventListener('dragend', handleDragEnd)
})

const openNewTab = () => {
  tabStore.addTab({
    name: 'New Tab',
    icon: 'lucide:plus',
    viewType: 'chat'
  })
}

const openNewWindow = () => {
  windowPresenter.createShellWindow({
    initialTab: {
      url: 'local://chat'
    }
  })
}

const minimizeWindow = () => {
  const id = window.api.getWindowId()
  if (id != null) {
    windowPresenter.minimize(id)
  }
}

const toggleMaximize = () => {
  const id = window.api.getWindowId()
  if (id != null) {
    windowPresenter.maximize(id)
  }
}

const closeWindow = () => {
  const id = window.api.getWindowId()
  if (id != null) {
    windowPresenter.close(id)
  }
}

const openSettings = () => {
  tabStore.addTab({
    name: 'Settings',
    icon: 'lucide:settings',
    viewType: 'settings'
  })
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

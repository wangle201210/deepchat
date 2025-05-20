<template>
  <div class="flex flex-row h-10">
    <div
      class="h-10 flex-shrink-0 w-0 flex-1 flex select-none text-center text-sm font-medium flex-row items-center justify-start gap-1"
      :class="['', isMacOS ? (isFullscreened ? 'pl-2 pr-2' : 'pl-20 pr-2') : 'px-2']"
    >
      <!-- App title/content in center -->

      <div
        class="flex-1 h-full flex flex-row items-center justify-start gap-1 overflow-x-auto scrollbar-hide window-drag-region"
      >
        <AppBarTabItem
          v-for="(tab, idx) in tabStore.tabs"
          :key="tab.id"
          :active="tab.id === tabStore.currentTabId"
          :size="tabStore.tabs.length"
          :index="idx"
          class="window-no-drag-region"
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
        <div ref="endOfTabs" class="w-1 flex-shrink-0 h-full"></div>
      </div>

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
      <!-- <Button
        class="text-xs font-medium px-2 h-7 bg-transparent rounded-md flex items-center justify-center"
        @click="openNewWindow"
      >
        <Icon v-if="isMacOS" icon="lucide:app-window-mac" class="w-4 h-4" />
        <Icon v-else icon="lucide:app-window" class="w-4 h-4" />
      </Button> -->
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
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
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
const endOfTabs = ref<HTMLElement | null>(null)

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
  setTimeout(() => {
    nextTick(() => {
      if (endOfTabs.value) {
        console.log('newTabButton', endOfTabs.value)
        endOfTabs.value.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    })
  }, 100)
}

// const openNewWindow = () => {
//   windowPresenter.createShellWindow({
//     initialTab: {
//       url: 'local://chat'
//     }
//   })
// }

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

.window-no-drag-region {
  -webkit-app-region: no-drag;
}

button {
  -webkit-app-region: no-drag;
}

/* For Webkit-based browsers (Chrome, Safari, newer versions of Edge) */
.overflow-x-auto::-webkit-scrollbar {
  height: 4px; /* Adjust as needed for thickness */
}

.overflow-x-auto::-webkit-scrollbar-track {
  background: transparent; /* Or a very subtle color like #f1f1f1 or theme background */
}

.overflow-x-auto::-webkit-scrollbar-thumb {
  background: #a1a1aa; /* Scrollbar thumb color - zinc-400 */
  border-radius: 2px; /* Rounded corners for the thumb */
}

.overflow-x-auto::-webkit-scrollbar-thumb:hover {
  background: #71717a; /* Scrollbar thumb color on hover - zinc-500 */
}

/* For Firefox - already handled by inline style for simplicity, can also be moved here */
/*
.overflow-x-auto {
  scrollbar-width: thin;
  scrollbar-color: #a1a1aa transparent;
}
*/
</style>

<template>
  <ScrollArea class="w-full h-full p-2">
    <div class="w-full h-full flex flex-col gap-1.5">
      <!-- 快捷键列表 -->
      <div class="flex flex-col gap-2">
        <div
          v-for="shortcut in shortcuts"
          :key="shortcut.id"
          class="flex flex-row p-2 items-center gap-2 px-2"
        >
          <span class="flex flex-row items-center gap-2 flex-grow w-full">
            <Icon :icon="shortcut.icon" class="w-4 h-4 text-muted-foreground" />
            <span class="text-sm font-medium">{{ t(shortcut.label) }}</span>
          </span>
          <div class="flex-shrink-0 min-w-32">
            <Button variant="outline" class="w-full justify-between">
              <span class="text-sm">{{ formatShortcut(shortcut.key) }}</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  </ScrollArea>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Icon } from '@iconify/vue'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'

const { t } = useI18n()

const shortcuts = ref([
  {
    id: 'new_conversation',
    icon: 'lucide:plus-square',
    label: 'settings.shortcuts.newConversation',
    key: 'CommandOrControl+N'
  },
  {
    id: 'new_window',
    icon: 'lucide:app-window',
    label: 'settings.shortcuts.newWindow',
    key: 'CommandOrControl+Shift+N'
  },
  {
    id: 'new_tab',
    icon: 'lucide:plus',
    label: 'settings.shortcuts.newTab',
    key: 'CommandOrControl+T'
  },
  {
    id: 'close_tab',
    icon: 'lucide:x',
    label: 'settings.shortcuts.closeTab',
    key: 'CommandOrControl+W'
  },
  {
    id: 'next_tab',
    icon: 'lucide:arrow-right',
    label: 'settings.shortcuts.nextTab',
    key: 'Control+Tab'
  },
  {
    id: 'previous_tab',
    icon: 'lucide:arrow-left',
    label: 'settings.shortcuts.previousTab',
    key: 'Control+Shift+Tab'
  },
  {
    id: 'number_tabs',
    icon: 'lucide:list-ordered',
    label: 'settings.shortcuts.specificTab',
    key: 'CommandOrControl+1...8'
  },
  {
    id: 'last_tab',
    icon: 'lucide:move-horizontal',
    label: 'settings.shortcuts.lastTab',
    key: 'CommandOrControl+9'
  },
  {
    id: 'zoom_in',
    icon: 'lucide:zoom-in',
    label: 'settings.shortcuts.zoomIn',
    key: 'CommandOrControl++'
  },
  {
    id: 'zoom_out',
    icon: 'lucide:zoom-out',
    label: 'settings.shortcuts.zoomOut',
    key: 'CommandOrControl+-'
  },
  {
    id: 'zoom_reset',
    icon: 'lucide:rotate-ccw',
    label: 'settings.shortcuts.zoomReset',
    key: 'CommandOrControl+0'
  },
  {
    id: 'go_settings',
    icon: 'lucide:settings',
    label: 'settings.shortcuts.goSettings',
    key: 'CommandOrControl+,'
  },
  {
    id: 'clean_history',
    icon: 'lucide:trash-2',
    label: 'settings.shortcuts.cleanHistory',
    key: 'CommandOrControl+L'
  },
  {
    id: 'quit_app',
    icon: 'lucide:log-out',
    label: 'settings.shortcuts.quitApp',
    key: 'CommandOrControl+Q'
  }
])

const formatShortcut = (shortcut: string) => {
  return shortcut
    .replace(
      'CommandOrControl',
      /Mac|iPod|iPhone|iPad/.test(window.navigator.platform) ? '⌘' : 'Ctrl'
    )
    .replace('Command', '⌘')
    .replace('Control', 'Ctrl')
    .replace('Alt', '⌥')
    .replace('Shift', '⇧')
    .replace(/\+/g, ' + ')
}
</script>

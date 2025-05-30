<template>
  <div class="w-full h-full p-4 flex flex-col">
    <div class="pb-4 flex flex-row items-center justify-between">
      <div class="flex items-center gap-2">
        <Icon icon="lucide:keyboard" class="w-5 h-5 text-primary" />
        <span class="text-lg font-semibold">{{ t('settings.shortcuts.title') }}</span>
      </div>
      <div class="flex items-center gap-2">
        <Button variant="outline" size="sm" @click="resetShortcutKeys()">
          <Loader2 v-if="resetLoading" class="mr-1 h-4 w-4 animate-spin" />
          <Icon v-else icon="lucide:refresh-cw" class="w-4 h-4 mr-1" />
          {{ t('common.resetData') }}
        </Button>
      </div>
    </div>
    <ScrollArea class="flex-1 w-full h-full">
      <div class="w-full h-full flex flex-col gap-1.5">
        <!-- 快捷键列表 -->
        <div class="flex flex-col gap-2">
          <div v-for="shortcut in shortcuts" :key="shortcut.id" class="flex flex-row p-2 items-center gap-2 px-2">
            <span class="flex flex-row items-center gap-2 flex-grow w-full">
              <Icon :icon="shortcut.icon" class="w-4 h-4 text-muted-foreground" />
              <span class="text-sm font-medium">{{ t(shortcut.label) }}</span>
            </span>
            <div class="flex-shrink-0 min-w-32">
              <div class="relative w-full">
                <Button 
                  variant="outline" 
                  class="w-full justify-between relative ring-offset-background" 
                  @click="startRecording(shortcut.id)" 
                  :class="{'ring-2 ring-primary': recordingShortcutId === shortcut.id}"
                >
                  <span v-if="recordingShortcutId === shortcut.id" class="text-sm text-primary">
                    <span v-if="tempShortcut">
                      {{ tempShortcut }} <span class="text-xs text-muted-foreground">{{ t('settings.shortcuts.pressEnterToSave') }}</span>
                    </span>
                    <span v-else>{{ t('settings.shortcuts.pressKeys') }}</span>
                  </span>
                  <span v-else class="text-sm">{{ shortcut.key }}</span>
                  <Icon v-if="recordingShortcutId !== shortcut.id" icon="lucide:pencil" class="w-3.5 h-3.5 text-muted-foreground" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ScrollArea>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { Icon } from '@iconify/vue'
import { Loader2 } from 'lucide-vue-next'

import { useShortcutKeyStore } from '@/stores/shortcutKey'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { ShortcutKey } from '@shared/presenter'

const { t } = useI18n()
const shortcutKeyStore = useShortcutKeyStore()
const { shortcutKeys } = storeToRefs(shortcutKeyStore)

const resetLoading = ref(false)
const recordingShortcutId = ref<string | null>(null)
const tempShortcut = ref('')

const shortcutMapping: Record<ShortcutKey, { icon: string; label: string }> = {
  NewConversation: {
    icon: 'lucide:plus-square',
    label: 'settings.shortcuts.newConversation',
  },
  NewWindow: {
    icon: 'lucide:app-window',
    label: 'settings.shortcuts.newWindow',
  },
  NewTab: {
    icon: 'lucide:plus',
    label: 'settings.shortcuts.newTab',
  },
  CloseTab: {
    icon: 'lucide:x',
    label: 'settings.shortcuts.closeTab',
  },
  SwitchNextTab: {
    icon: 'lucide:arrow-right',
    label: 'settings.shortcuts.nextTab',
  },
  SwitchPrevTab: {
    icon: 'lucide:arrow-left',
    label: 'settings.shortcuts.previousTab',
  },
  // NumberTabs: {
  //   icon: 'lucide:list-ordered',
  //   label: 'settings.shortcuts.specificTab',
  // },
  SwtichToLastTab: {
    icon: 'lucide:move-horizontal',
    label: 'settings.shortcuts.lastTab',
  },
  ZoomIn: {
    icon: 'lucide:zoom-in',
    label: 'settings.shortcuts.zoomIn',
  },
  ZoomOut: {
    icon: 'lucide:zoom-out',
    label: 'settings.shortcuts.zoomOut',
  },
  ZoomResume: {
    icon: 'lucide:rotate-ccw',
    label: 'settings.shortcuts.zoomReset',
  },
  GoSettings: {
    icon: 'lucide:settings',
    label: 'settings.shortcuts.goSettings',
  },
  CleanChatHistory: {
    icon: 'lucide:trash-2',
    label: 'settings.shortcuts.cleanHistory',
  },
  Quit: {
    icon: 'lucide:log-out',
    label: 'settings.shortcuts.quitApp',
  }
}

const shortcuts = computed(() => {
  if (!shortcutKeys.value || Object.keys(shortcutKeys.value).length === 0) {
    return []
  }

  try {
    return Object.entries(shortcutMapping).map(([key, value]) => ({
      id: key,
      icon: value.icon,
      label: value.label,
      key: formatShortcut(shortcutKeys.value[key])
    }))
  } catch (error) {
    console.error('Parse shortcut key error', error)
    return []
  }
})

const formatShortcut = (_shortcut: string) => {
  return _shortcut
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

const resetShortcutKeys = async () => {
  resetLoading.value = true
  await shortcutKeyStore.resetShortcutKeys()
  resetLoading.value = false
}

// 开始录制快捷键
const startRecording = (shortcutId: string) => {
  // 停止之前的录制
  if (recordingShortcutId.value && recordingShortcutId.value !== shortcutId) {
    stopRecording()
  }
  
  recordingShortcutId.value = shortcutId
  tempShortcut.value = ''
  
  // 添加键盘事件监听
  window.addEventListener('keydown', handleKeyDown, { capture: true })
  
  // 阻止页面滑动和其他默认行为
  document.body.style.overflow = 'hidden'
}

// 处理键盘按下事件
const handleKeyDown = (event: KeyboardEvent) => {
  if (!recordingShortcutId.value) return
  
  event.preventDefault()
  
  // 如果按下 Esc 键，取消录制
  if (event.key === 'Escape') {
    cancelRecording()
    return
  }
  
  // 如果按下 Enter 键并且已经有临时快捷键，保存并停止录制
  if (event.key === 'Enter' && tempShortcut.value) {
    saveAndStopRecording()
    return
  }
  
  const keys: string[] = []
  
  // 添加修饰键
  if (event.ctrlKey) keys.push('Control')
  if (event.metaKey) keys.push('Command')
  if (event.altKey) keys.push('Alt')
  if (event.shiftKey) keys.push('Shift')
  
  // 添加主键
  const key = event.key
  if (!['Control', 'Alt', 'Shift', 'Meta', 'Enter', 'Escape'].includes(key)) {
    keys.push(key.length === 1 ? key.toUpperCase() : key)
  }
  
  if (keys.length > 0) {
    tempShortcut.value = keys.join('+')
  }
}

// 取消录制
const cancelRecording = () => {
  tempShortcut.value = ''
  stopRecording()
}

// 保存并停止录制
const saveAndStopRecording = () => {
  if (shortcutKeys.value && recordingShortcutId.value && tempShortcut.value) {
    const shortcutKey = recordingShortcutId.value as keyof typeof shortcutKeys.value
    shortcutKeys.value[shortcutKey] = tempShortcut.value
    saveChanges()
  }
  stopRecording()
}

// 停止录制
const stopRecording = () => {
  if (recordingShortcutId.value) {
    recordingShortcutId.value = null
    window.removeEventListener('keydown', handleKeyDown, { capture: true })
    
    // 恢复默认行为
    document.body.style.overflow = ''
  }
}

// 保存更改
const saveChanges = async () => {
  try {
    await shortcutKeyStore.saveShortcutKeys()
  } catch (error) {
    console.error('Save shortcut keys error:', error)
  }
}
</script>

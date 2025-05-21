import { usePresenter } from '@/composables/usePresenter'
import { useDark, useToggle } from '@vueuse/core'
import { defineStore } from 'pinia'
import { ref, onMounted, onUnmounted } from 'vue'
import type { IpcRendererEvent } from 'electron'

export type ThemeMode = 'dark' | 'light' | 'system'

export const useThemeStore = defineStore('theme', () => {
  const isDark = useDark()
  const toggleDark = useToggle(isDark)
  const configPresenter = usePresenter('configPresenter')

  // 存储当前主题模式
  const themeMode = ref<ThemeMode>('system')

  // 初始化主题
  const initTheme = async () => {
    const currentTheme = (await configPresenter.getTheme()) as ThemeMode
    themeMode.value = currentTheme

    // 如果是系统主题模式，则根据系统实际深色/浅色设置来设置界面
    if (currentTheme === 'system') {
      const systemIsDark = await configPresenter.toggleTheme('system')
      console.log('initTheme', systemIsDark)
      toggleDark(systemIsDark)
    } else {
      toggleDark(currentTheme === 'dark')
    }
  }

  initTheme()

  // 监听系统主题变化事件
  const handleSystemThemeChange = (_event: IpcRendererEvent, isDarkMode: boolean) => {
    // 只有在系统模式下才跟随系统主题变化
    if (themeMode.value === 'system') {
      toggleDark(isDarkMode)
    }
  }

  // 注册和清理主题变化监听器
  onMounted(() => {
    window.electron.ipcRenderer.on('system-theme-updated', handleSystemThemeChange)
  })

  onUnmounted(() => {
    window.electron.ipcRenderer.removeListener('system-theme-updated', handleSystemThemeChange)
  })

  // 监听深色模式变化
  // watch(isDark, (value) => {
  //   // 只有在非系统模式下，才直接切换主题
  //   if (themeMode.value !== 'system') {
  //     windowPresenter.toggleTheme(value ? 'dark' : 'light')
  //     themeMode.value = value ? 'dark' : 'light'
  //   }
  // })

  // 设置主题模式
  const setThemeMode = async (mode: ThemeMode) => {
    themeMode.value = mode
    const isDarkMode = await configPresenter.toggleTheme(mode)

    // 如果不是系统模式，直接设置深色/浅色状态
    // 如果是系统模式，toggleTheme 会返回系统当前的深色状态
    toggleDark(isDarkMode)
  }

  // 循环切换主题：light -> dark -> system -> light
  const cycleTheme = () => {
    console.log('cycleTheme', themeMode.value)
    if (themeMode.value === 'light') setThemeMode('dark')
    else if (themeMode.value === 'dark') setThemeMode('system')
    else setThemeMode('light')
  }

  return {
    isDark,
    toggleDark,
    themeMode,
    setThemeMode,
    cycleTheme
  }
})

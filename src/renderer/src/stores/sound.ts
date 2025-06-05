import { usePresenter } from '@/composables/usePresenter'
import { CONFIG_EVENTS } from '@/events'
import { defineStore } from 'pinia'
import { ref, onMounted } from 'vue'

export const useSoundStore = defineStore('sound', () => {
  const soundEnabled = ref<boolean>(false) // 声音是否启用，默认禁用
  const configPresenter = usePresenter('configPresenter')

  // 初始化设置
  const initSound = async () => {
    try {
      soundEnabled.value = await configPresenter.getSoundEnabled()
      setupSoundEnabledListener()
    } catch (error) {
      console.error('初始化音效失败:', error)
    }
  }

  // 设置音效开关状态
  const setSoundEnabled = async (enabled: boolean) => {
    // 更新本地状态
    soundEnabled.value = Boolean(enabled)

    // 调用ConfigPresenter设置值
    await configPresenter.setSoundEnabled(enabled)
  }

  // 获取音效开关状态
  const getSoundEnabled = async (): Promise<boolean> => {
    return await configPresenter.getSoundEnabled()
  }

  // 设置音效开关监听器
  const setupSoundEnabledListener = () => {
    // 监听音效开关变更事件
    window.electron.ipcRenderer.on(
      CONFIG_EVENTS.SOUND_ENABLED_CHANGED,
      (_event, enabled: boolean) => {
        soundEnabled.value = enabled
      }
    )
  }

  // 在 store 创建时初始化
  onMounted(async () => {
    await initSound()
  })

  return {
    soundEnabled,
    initSound,
    setSoundEnabled,
    getSoundEnabled,
    setupSoundEnabledListener
  }
})

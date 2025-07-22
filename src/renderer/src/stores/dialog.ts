import { usePresenter } from '@/composables/usePresenter'
import { DIALOG_EVENTS } from '@/events'
import { DialogRequest } from '@shared/presenter'
import { defineStore } from 'pinia'
import { onMounted, ref } from 'vue'

export const useDialogStore = defineStore('dialog', () => {
  const dialogP = usePresenter('dialogPresenter')
  const dialogRequest = ref<DialogRequest | null>(null)
  const showDialog = ref(false)
  const timeoutMilliseconds = ref(0)
  let timer: NodeJS.Timeout | null = null

  // 清理定时器
  const clearTimer = () => {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  // 启动倒计时
  const startCountdown = (timeout: number, defaultButton: string) => {
    timeoutMilliseconds.value = timeout
    clearTimer()
    timer = setInterval(() => {
      if (timeoutMilliseconds.value > 0) {
        timeoutMilliseconds.value -= 100
      } else {
        clearTimer()
        handleResponse(defaultButton)
      }
    }, 100)
  }

  // 监听对话框请求事件
  const setupUpdateListener = () => {
    window.electron.ipcRenderer.on(DIALOG_EVENTS.REQUEST, async (_, event: DialogRequest) => {
      if(dialogRequest.value) {
        // 如果已有对话框请求，清理之前的定时器
        clearTimer()
        await handleResponse(null)
      }
      dialogRequest.value = event
      showDialog.value = true
      const { timeout, defaultId, buttons } = event
      if (timeout && timeout > 0 && buttons && buttons[Number(defaultId)]) {
        startCountdown(timeout, buttons[Number(defaultId)])
      } else {
        console.warn('default params is missing or invalid:', event)
        clearTimer()
      }
    })
  }

  // 响应对话框
  const handleResponse = async (response: string | null) => {
    clearTimer()
    if (!dialogRequest.value) {
      console.warn('No dialog request to respond')
      return
    }
    await dialogP.handleDialogResponse({
      id: dialogRequest.value.id,
      button: response
    })
    dialogRequest.value = null
    showDialog.value = false
  }

  onMounted(setupUpdateListener)

  return {
    timeoutMilliseconds,
    dialogRequest,
    showDialog,
    handleResponse
  }
})

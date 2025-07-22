import { usePresenter } from '@/composables/usePresenter'
import { DIALOG_EVENTS } from '@/events'
import { DialogRequest, DialogResponse } from '@shared/presenter'
import { defineStore } from 'pinia'
import { onMounted, ref } from 'vue'

export const useDialogStore = defineStore('dialog', () => {
  const dialogP = usePresenter('dialogPresenter')
  const dialogRequest = ref<DialogRequest | null>(null)
  const showDialog = ref(false)
  const timeoutMilliseconds = ref(0)
  let timer: NodeJS.Timeout | null = null

  // Clear the timer
  const clearTimer = () => {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  // Start countdown
  const startCountdown = (timeout: number, defaultResponse: DialogResponse) => {
    timeoutMilliseconds.value = timeout
    clearTimer()
    timer = setInterval(() => {
      if (timeoutMilliseconds.value > 0) {
        timeoutMilliseconds.value -= 100
      } else {
        clearTimer()
        handleResponse(defaultResponse)
      }
    }, 100)
  }

  // Listen for dialog request events
  const setupUpdateListener = () => {
    window.electron.ipcRenderer.on(DIALOG_EVENTS.REQUEST, async (_, event: DialogRequest) => {
      try {
        if (!event || !event.id || !event.title) {
          console.error('[DialogStore] Invalid dialog request:', event)
          return
        }

        if (dialogRequest.value) {
          // If a dialog request already exists, clear the previous timer
          clearTimer()
          await handleError(event.id)
        }

        dialogRequest.value = event
        showDialog.value = true
        const { timeout, defaultId, buttons } = event

        if (timeout > 0 && buttons && buttons[defaultId]) {
          startCountdown(timeout, {
            id: event.id,
            button: buttons[defaultId]
          })
        } else {
          // Use proper logging infrastructure
          clearTimer()
        }
      } catch (error) {
        console.error('[DialogStore] Error processing dialog request:', error)
      }
    })
  }

  // Respond to dialog
  const handleResponse = async (response: DialogResponse) => {
    try {
      clearTimer()
      if (!dialogRequest.value) {
        console.warn('No dialog request to respond')
        return
      }

      await dialogP.handleDialogResponse(response)

      dialogRequest.value = null
      showDialog.value = false
    } catch (error) {
      console.error('[DialogStore] Error handling dialog response:', error)
      // Reset state even on error to prevent stuck dialogs
      dialogRequest.value = null
      showDialog.value = false
    }
  }

  // Handle dialog error
  const handleError = async (id: string) => {
    try {
      await dialogP.handleDialogError(id)
    } catch (error) {
      console.error('[DialogStore] Error handling dialog error:', error)
    }
  }

  onMounted(setupUpdateListener)

  return {
    timeoutMilliseconds,
    dialogRequest,
    showDialog,
    handleResponse
  }
})

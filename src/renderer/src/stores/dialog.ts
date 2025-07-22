import { DIALOG_EVENTS } from '@/events'
import { DialogRequest } from '@shared/presenter'
import { defineStore } from 'pinia'
import { onMounted, ref } from 'vue'

export const useDialogStore = defineStore('dialog', () => {
  const dialogRequest = ref<DialogRequest | null>(null)
  const showDialog = ref(false)

  // 监听更新状态
  const setupUpdateListener = () => {
    console.log('setupUpdateListener')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    window.electron.ipcRenderer.on(DIALOG_EVENTS.REQUEST, (_, event: DialogRequest) => {
      console.log(DIALOG_EVENTS.REQUEST, event)
      dialogRequest.value = event
      showDialog.value = true
    })
  }

  const handleResponse = (response: string) => {
    window.electron.ipcRenderer.sendSync(DIALOG_EVENTS.RESPONSE, response)
    dialogRequest.value = null
    showDialog.value = false
  }

  onMounted(() => {
    setupUpdateListener()
  })

  return {
    dialogRequest,
    showDialog,
    handleResponse
  }
})

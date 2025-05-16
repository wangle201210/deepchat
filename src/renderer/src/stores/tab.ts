import { defineStore } from 'pinia'
import { ref } from 'vue'
import { usePresenter } from '@/composables/usePresenter'

export const useTabStore = defineStore('tab', () => {
  const tabPresenter = usePresenter('tabPresenter')
  const tabs = ref<
    {
      id: number
      name: string
      icon: string
      closable: boolean
      order: number
      viewType: string
      viewId: number | null
    }[]
  >([])

  const currentTabId = ref<number | null>(null)

  const addTab = async (tab: { name: string; icon: string; viewType: string }) => {
    // if (tabs.value.find((t) => t.viewType === tab.viewType)) {
    //   return
    // }
    const windowId = window.api.getWindowId()
    console.log('windowId', windowId)
    const viewId = await tabPresenter.createTab(windowId ?? 1, `local://${tab.viewType}`)
    console.log('viewId', viewId)
    const newTab = {
      id: viewId ?? 0,
      name: tab.name,
      icon: tab.icon,
      closable: true,
      order: tabs.value.length,
      viewType: tab.viewType,
      viewId: viewId ?? null
    }
    tabs.value.push(newTab)
    setCurrentTabId(newTab.id)
    return newTab
  }

  const removeTab = async (id: number) => {
    await tabPresenter.closeTab(tabs.value.find((tab) => tab.id === id)?.viewId ?? 0)
    tabs.value = tabs.value.filter((tab) => tab.id !== id)
  }

  const setCurrentTabId = async (id: number) => {
    await tabPresenter.switchTab(tabs.value.find((tab) => tab.id === id)?.viewId ?? 0)
    currentTabId.value = id
  }

  const init = async () => {
    const windowId = window.api.getWindowId()
    const tabsData = await tabPresenter.getWindowTabsData(windowId ?? 1)
    console.log('tabsData', tabsData)
    if (tabsData.length <= 0) {
      await addTab({
        name: 'New Tab',
        icon: 'lucide:plus',
        viewType: 'chat'
      })
    }
  }

  init()

  // addTab({
  //   name: 'New Tab',
  //   icon: 'lucide:plus',
  //   viewType: 'chat'
  // })

  // setCurrentTabId(tabs.value[0].id)

  return {
    tabs,
    currentTabId,
    addTab,
    removeTab,
    setCurrentTabId
  }
})

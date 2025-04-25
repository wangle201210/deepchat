import { defineStore } from 'pinia'
import { ref } from 'vue'
import { v4 as uuidv4 } from 'uuid'

export const useTabStore = defineStore('tab', () => {
  const tabs = ref<
    {
      id: string
      name: string
      icon: string
      closable: boolean
      order: number
      viewType: string
      viewId: string
    }[]
  >([])

  const currentTabId = ref<string>('')

  const addTab = (tab: { name: string; icon: string; viewType: string }) => {
    // if (tabs.value.find((t) => t.viewType === tab.viewType)) {
    //   return
    // }
    const newTab = {
      id: uuidv4(),
      name: tab.name,
      icon: tab.icon,
      closable: true,
      order: tabs.value.length,
      viewType: tab.viewType,
      viewId: ''
    }
    tabs.value.push(newTab)
    setCurrentTabId(newTab.id)
    return newTab
  }

  const removeTab = (id: string) => {
    tabs.value = tabs.value.filter((tab) => tab.id !== id)
  }

  const setCurrentTabId = (id: string) => {
    currentTabId.value = id
  }

  tabs.value.push({
    id: uuidv4(),
    name: 'New Tab',
    icon: 'asset://logo.png',
    closable: false,
    order: tabs.value.length,
    viewType: 'chat',
    viewId: ''
  })

  setCurrentTabId(tabs.value[0].id)

  return {
    tabs,
    currentTabId,
    addTab,
    removeTab,
    setCurrentTabId
  }
})

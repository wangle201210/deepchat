import { defineStore } from 'pinia'
import { ref } from 'vue'
import { usePresenter } from '@/composables/usePresenter'
import { Prompt } from '@shared/presenter'

export const usePromptsStore = defineStore('prompts', () => {
  const configP = usePresenter('configPresenter')
  const prompts = ref<Prompt[]>([])

  // 加载自定义 prompts
  const loadPrompts = async () => {
    try {
      prompts.value = await configP.getCustomPrompts()
    } catch (error) {
      console.error('Failed to load custom prompts:', error)
    }
  }

  // 保存自定义 prompts
  const savePrompts = async (newPrompts: Prompt[]) => {
    try {
      await configP.setCustomPrompts(newPrompts)
      prompts.value = newPrompts
    } catch (error) {
      console.error('Failed to save custom prompts:', error)
      throw error
    }
  }

  // 添加单个 prompt
  const addPrompt = async (prompt: Prompt) => {
    try {
      await configP.addCustomPrompt(prompt)
      await loadPrompts()
    } catch (error) {
      console.error('Failed to add custom prompt:', error)
      throw error
    }
  }

  // 更新单个 prompt
  const updatePrompt = async (promptId: string, updates: Partial<Prompt>) => {
    try {
      await configP.updateCustomPrompt(promptId, updates)
      await loadPrompts()
    } catch (error) {
      console.error('Failed to update custom prompt:', error)
      throw error
    }
  }

  // 删除单个 prompt
  const deletePrompt = async (promptId: string) => {
    try {
      await configP.deleteCustomPrompt(promptId)
      await loadPrompts()
    } catch (error) {
      console.error('Failed to delete custom prompt:', error)
      throw error
    }
  }

  return {
    prompts,
    loadPrompts,
    savePrompts,
    addPrompt,
    updatePrompt,
    deletePrompt
  }
})

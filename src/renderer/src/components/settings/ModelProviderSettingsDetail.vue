<template>
  <section class="w-full h-full">
    <div class="w-full h-full p-2 flex flex-col gap-2 overflow-y-auto">
      <div class="flex flex-col items-start p-2 gap-2">
        <div class="flex justify-between items-center w-full">
          <Label :for="`${provider.id}-url`" class="flex-1 cursor-pointer">API URL</Label>
          <Button
            v-if="provider.custom"
            variant="destructive"
            size="sm"
            class="text-xs rounded-lg"
            @click="showDeleteProviderDialog = true"
          >
            <Icon icon="lucide:trash-2" class="w-4 h-4 mr-1" />{{ t('settings.provider.delete') }}
          </Button>
        </div>
        <Input
          :id="`${provider.id}-url`"
          v-model="apiHost"
          :placeholder="t('settings.provider.urlPlaceholder')"
          @blur="handleApiHostChange(String($event.target.value))"
          @keyup.enter="handleApiHostChange(apiHost)"
        />
        <div class="text-xs text-secondary-foreground">
          {{
            t('settings.provider.urlFormat', {
              defaultUrl: providerWebsites?.defaultBaseUrl || ''
            })
          }}
        </div>
      </div>
      <div class="flex flex-col items-start p-2 gap-2">
        <Label :for="`${provider.id}-apikey`" class="flex-1 cursor-pointer">API Key</Label>
        <Input
          :id="`${provider.id}-apikey`"
          v-model="apiKey"
          type="password"
          :placeholder="t('settings.provider.keyPlaceholder')"
          @blur="handleApiKeyChange(String($event.target.value))"
          @keyup.enter="handleApiKeyEnter(apiKey)"
        />
        <div class="flex flex-row gap-2">
          <Button
            variant="outline"
            size="xs"
            class="text-xs text-normal rounded-lg"
            @click="validateApiKey"
          >
            <Icon icon="lucide:check-check" class="w-4 h-4 text-muted-foreground" />{{
              t('settings.provider.verifyKey')
            }}
          </Button>
          <Button
            variant="outline"
            size="xs"
            class="text-xs text-normal rounded-lg"
            v-if="!provider.custom && provider.id !== 'doubao'"
            @click="openProviderWebsite"
          >
            <Icon icon="lucide:hand-helping" class="w-4 h-4 text-muted-foreground" />{{
              t('settings.provider.howToGet')
            }}
          </Button>
        </div>
        <div class="text-xs text-secondary-foreground" v-if="!provider.custom">
          {{ t('settings.provider.getKeyTip') }}
          <a :href="providerWebsites?.apiKey" target="_blank" class="text-primary">{{
            provider.name
          }}</a>
          {{ t('settings.provider.getKeyTipEnd') }}
        </div>
      </div>
      <div class="flex flex-col items-start p-2 gap-2">
        <Label :for="`${provider.id}-model`" class="flex-1 cursor-pointer">{{
          t('settings.provider.modelList')
        }}</Label>
        <div class="flex flex-row gap-2 items-center">
          <Button
            variant="outline"
            size="xs"
            class="text-xs text-normal rounded-lg"
            @click="showModelListDialog = true"
          >
            <Icon icon="lucide:list-check" class="w-4 h-4 text-muted-foreground" />{{
              t('settings.provider.enableModels')
            }}
          </Button>
          <Button
            variant="outline"
            size="xs"
            class="text-xs text-normal rounded-lg"
            @click="disableAllModelsConfirm"
            :disabled="enabledModels.length === 0"
          >
            <Icon icon="lucide:x-circle" class="w-4 h-4 text-muted-foreground" />{{
              t('settings.provider.disableAllModels')
            }}
          </Button>
          <span class="text-xs text-secondary-foreground">
            {{ enabledModels.length }}/{{ providerModels.length + customModels.length }}
            {{ t('settings.provider.modelsEnabled') }}
          </span>
        </div>
        <div class="flex flex-col w-full border overflow-hidden rounded-lg">
          <ModelConfigItem
            v-for="model in enabledModels"
            :key="model.id"
            :model-name="model.name"
            :model-id="model.id"
            :group="model.group"
            :enabled="model.enabled ?? false"
            :vision="model.vision ?? false"
            :function-call="model.functionCall ?? false"
            :reasoning="model.reasoning ?? false"
            @enabled-change="handleModelEnabledChange(model, $event)"
          />
        </div>
      </div>
    </div>

    <Dialog v-model:open="showConfirmDialog">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ t('settings.provider.dialog.disableModel.title') }}</DialogTitle>
        </DialogHeader>
        <div class="py-4">
          {{ t('settings.provider.dialog.disableModel.content', { name: modelToDisable?.name }) }}
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showConfirmDialog = false">{{
            t('dialog.cancel')
          }}</Button>
          <Button variant="destructive" @click="confirmDisable">{{
            t('settings.provider.dialog.disableModel.confirm')
          }}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="showModelListDialog">
      <DialogContent class="max-w-2xl p-0 pb-4 gap-2 flex flex-col">
        <DialogHeader class="p-0">
          <DialogTitle class="p-4">{{
            t('settings.provider.dialog.configModels.title')
          }}</DialogTitle>
        </DialogHeader>
        <div class="px-4 py-2 flex-1 h-0 max-h-80 overflow-y-auto">
          <ProviderModelList
            :provider-models="[{ providerId: provider.id, models: providerModels }]"
            :custom-models="customModels"
            :providers="[{ id: provider.id, name: provider.name }]"
            @enabled-change="handleModelEnabledChange"
          />
        </div>
      </DialogContent>
    </Dialog>
    <Dialog v-model:open="showCheckModelDialog">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{
            t(
              checkResult
                ? 'settings.provider.dialog.verify.success'
                : 'settings.provider.dialog.verify.failed'
            )
          }}</DialogTitle>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="showCheckModelDialog = false">{{
            t('dialog.close')
          }}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="showDisableAllConfirmDialog">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ t('settings.provider.dialog.disableAllModels.title') }}</DialogTitle>
        </DialogHeader>
        <div class="py-4">
          {{ t('settings.provider.dialog.disableAllModels.content', { name: provider.name }) }}
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showDisableAllConfirmDialog = false">{{
            t('dialog.cancel')
          }}</Button>
          <Button variant="destructive" @click="confirmDisableAll">{{
            t('settings.provider.dialog.disableAllModels.confirm')
          }}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="showDeleteProviderDialog">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ t('settings.provider.dialog.deleteProvider.title') }}</DialogTitle>
        </DialogHeader>
        <div class="py-4">
          {{ t('settings.provider.dialog.deleteProvider.content', { name: provider.name }) }}
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showDeleteProviderDialog = false">{{
            t('dialog.cancel')
          }}</Button>
          <Button variant="destructive" @click="confirmDeleteProvider">{{
            t('settings.provider.dialog.deleteProvider.confirm')
          }}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </section>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { computed, ref, watch } from 'vue'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Icon } from '@iconify/vue'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog'
import ProviderModelList from './ProviderModelList.vue'
import { useSettingsStore } from '@/stores/settings'
import type { LLM_PROVIDER, RENDERER_MODEL_META } from '@shared/presenter'
import ModelConfigItem from './ModelConfigItem.vue'

interface ProviderWebsites {
  official: string
  apiKey: string
  docs: string
  models: string
  defaultBaseUrl: string
}

const { t } = useI18n()

const props = defineProps<{
  provider: LLM_PROVIDER
}>()

const settingsStore = useSettingsStore()
const apiKey = ref(props.provider.apiKey || '')
const apiHost = ref(props.provider.baseUrl || '')

const providerModels = ref<RENDERER_MODEL_META[]>([])
const customModels = ref<RENDERER_MODEL_META[]>([])

const modelToDisable = ref<RENDERER_MODEL_META | null>(null)
const showConfirmDialog = ref(false)
const showModelListDialog = ref(false)
const showDisableAllConfirmDialog = ref(false)
const showDeleteProviderDialog = ref(false)
const enabledModels = computed(() => {
  const enabledModelsList = [
    ...customModels.value.filter((m) => m.enabled),
    ...providerModels.value.filter((m) => m.enabled)
  ]
  const uniqueModels = new Map<string, RENDERER_MODEL_META>()

  enabledModelsList.forEach((model) => {
    if (!uniqueModels.has(model.id)) {
      uniqueModels.set(model.id, model)
    }
  })

  return Array.from(uniqueModels.values())
})
const checkResult = ref<boolean>(false)
const showCheckModelDialog = ref(false)

const providerWebsites = computed<ProviderWebsites | undefined>(() => {
  const providerConfig = settingsStore.defaultProviders.find((provider) => {
    return provider.id === props.provider.id
  })
  if (providerConfig && providerConfig.websites) {
    return providerConfig.websites as ProviderWebsites
  }
  return undefined
})

const validateApiKey = async () => {
  try {
    const resp = await settingsStore.checkProvider(props.provider.id)
    if (resp.isOk) {
      console.log('验证成功')
      checkResult.value = true
      showCheckModelDialog.value = true
      // 验证成功后刷新当前provider的模型列表
      await settingsStore.refreshProviderModels(props.provider.id)
    } else {
      console.log('验证失败', resp.errorMsg)
      checkResult.value = false
      showCheckModelDialog.value = true
    }
  } catch (error) {
    console.error('Failed to validate API key:', error)
    checkResult.value = false
    showCheckModelDialog.value = true
  }
}

const initData = async () => {
  console.log('initData', settingsStore.allProviderModels)
  const providerData = settingsStore.allProviderModels.find(
    (p) => p.providerId === props.provider.id
  )
  if (providerData) {
    providerModels.value = providerData.models
  }
  const customModelData = settingsStore.customModels.find((p) => p.providerId === props.provider.id)
  if (customModelData) {
    customModels.value = customModelData.models
  }
}

watch(
  () => props.provider,
  () => {
    apiKey.value = props.provider.apiKey || ''
    apiHost.value = props.provider.baseUrl || ''
    initData()
  },
  { immediate: true }
)

const handleApiKeyEnter = async (value: string) => {
  const inputElement = document.getElementById(`${props.provider.id}-apikey`)
  if (inputElement) {
    inputElement.blur()
  }
  await settingsStore.updateProviderApi(props.provider.id, value, undefined)
  await validateApiKey()
}
const handleApiKeyChange = async (value: string) => {
  await settingsStore.updateProviderApi(props.provider.id, value, undefined)
}

const handleApiHostChange = async (value: string) => {
  await settingsStore.updateProviderApi(props.provider.id, undefined, value)
}

const handleModelEnabledChange = async (
  model: RENDERER_MODEL_META,
  enabled: boolean,
  comfirm: boolean = false
) => {
  if (!enabled && comfirm) {
    disableModel(model)
  } else {
    await settingsStore.updateModelStatus(props.provider.id, model.id, enabled)
  }
}

const disableModel = (model: RENDERER_MODEL_META) => {
  modelToDisable.value = model
  showConfirmDialog.value = true
}

const confirmDisable = async () => {
  if (modelToDisable.value) {
    try {
      await settingsStore.updateModelStatus(props.provider.id, modelToDisable.value.id, false)
    } catch (error) {
      console.error('Failed to disable model:', error)
    }
    showConfirmDialog.value = false
    modelToDisable.value = null
  }
}

const disableAllModelsConfirm = () => {
  showDisableAllConfirmDialog.value = true
}

const confirmDisableAll = async () => {
  try {
    await settingsStore.disableAllModels(props.provider.id)
    showDisableAllConfirmDialog.value = false
  } catch (error) {
    console.error('Failed to disable all models:', error)
  }
}

const confirmDeleteProvider = async () => {
  try {
    await settingsStore.removeProvider(props.provider.id)
    showDeleteProviderDialog.value = false
  } catch (error) {
    console.error('删除供应商失败:', error)
  }
}
const openProviderWebsite = () => {
  const url = providerWebsites.value?.apiKey
  if (url) {
    window.open(url, '_blank')
  }
}

watch(
  () => settingsStore.allProviderModels,
  () => {
    initData()
  },
  { deep: true }
)

watch(
  () => settingsStore.customModels,
  () => {
    initData()
  },
  { deep: true }
)
</script>

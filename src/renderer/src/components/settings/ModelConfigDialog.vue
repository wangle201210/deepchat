<template>
  <Dialog :open="open" @update:open="$emit('update:open', $event)">
    <DialogContent class="sm:max-w-[600px] max-h-[80vh] overflow-hidden flex flex-col">
      <DialogHeader>
        <DialogTitle>{{ t('settings.model.modelConfig.title') }} - {{ modelName }}</DialogTitle>
        <p class="text-sm text-muted-foreground">
          {{ t('settings.model.modelConfig.description') }}
        </p>
      </DialogHeader>

      <div class="overflow-y-auto flex-1 pr-2 -mr-2">
        <form @submit.prevent="handleSave" class="space-y-6">
          <!-- 最大输出长度 -->
          <div class="space-y-2">
            <Label for="maxTokens">{{ t('settings.model.modelConfig.maxTokens.label') }}</Label>
            <Input
              id="maxTokens"
              v-model.number="config.maxTokens"
              type="number"
              :min="1"
              :max="1000000"
              :placeholder="t('settings.model.modelConfig.maxTokens.label')"
              :class="{ 'border-destructive': errors.maxTokens }"
            />
            <p class="text-xs text-muted-foreground">
              {{ t('settings.model.modelConfig.maxTokens.description') }}
            </p>
            <p v-if="errors.maxTokens" class="text-xs text-destructive">
              {{ errors.maxTokens }}
            </p>
          </div>

          <!-- 上下文长度 -->
          <div class="space-y-2">
            <Label for="contextLength">{{ t('settings.model.modelConfig.contextLength.label') }}</Label>
            <Input
              id="contextLength"
              v-model.number="config.contextLength"
              type="number"
              :min="1"
              :max="10000000"
              :placeholder="t('settings.model.modelConfig.contextLength.label')"
              :class="{ 'border-destructive': errors.contextLength }"
            />
            <p class="text-xs text-muted-foreground">
              {{ t('settings.model.modelConfig.contextLength.description') }}
            </p>
            <p v-if="errors.contextLength" class="text-xs text-destructive">
              {{ errors.contextLength }}
            </p>
          </div>

          <!-- 温度 -->
          <div class="space-y-2">
            <Label for="temperature">{{ t('settings.model.modelConfig.temperature.label') }}</Label>
            <Input
              id="temperature"
              v-model.number="config.temperature"
              type="number"
              step="0.1"
              :min="0"
              :max="2"
              :placeholder="t('settings.model.modelConfig.temperature.label')"
              :class="{ 'border-destructive': errors.temperature }"
            />
            <p class="text-xs text-muted-foreground">
              {{ t('settings.model.modelConfig.temperature.description') }}
            </p>
            <p v-if="errors.temperature" class="text-xs text-destructive">
              {{ errors.temperature }}
            </p>
          </div>

          <!-- 模型类型 -->
          <div class="space-y-2">
            <Label for="type">{{ t('settings.model.modelConfig.type.label') }}</Label>
            <Select v-model="config.type">
              <SelectTrigger>
                <SelectValue :placeholder="t('settings.model.modelConfig.type.label')" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="chat">
                  {{ t('settings.model.modelConfig.type.options.chat') }}
                </SelectItem>
                <SelectItem value="embedding">
                  {{ t('settings.model.modelConfig.type.options.embedding') }}
                </SelectItem>
                <SelectItem value="rerank">
                  {{ t('settings.model.modelConfig.type.options.rerank') }}
                </SelectItem>
                <SelectItem value="imageGeneration">
                  {{ t('settings.model.modelConfig.type.options.imageGeneration') }}
                </SelectItem>
              </SelectContent>
            </Select>
            <p class="text-xs text-muted-foreground">
              {{ t('settings.model.modelConfig.type.description') }}
            </p>
          </div>

          <!-- 视觉能力 -->
          <div class="flex items-center justify-between">
            <div class="space-y-0.5">
              <Label>{{ t('settings.model.modelConfig.vision.label') }}</Label>
              <p class="text-xs text-muted-foreground">
                {{ t('settings.model.modelConfig.vision.description') }}
              </p>
            </div>
            <Switch v-model:checked="config.vision" />
          </div>

          <!-- 函数调用 -->
          <div class="flex items-center justify-between">
            <div class="space-y-0.5">
              <Label>{{ t('settings.model.modelConfig.functionCall.label') }}</Label>
              <p class="text-xs text-muted-foreground">
                {{ t('settings.model.modelConfig.functionCall.description') }}
              </p>
            </div>
            <Switch v-model:checked="config.functionCall" />
          </div>

          <!-- 推理能力 -->
          <div class="flex items-center justify-between">
            <div class="space-y-0.5">
              <Label>{{ t('settings.model.modelConfig.reasoning.label') }}</Label>
              <p class="text-xs text-muted-foreground">
                {{ t('settings.model.modelConfig.reasoning.description') }}
              </p>
            </div>
            <Switch v-model:checked="config.reasoning" />
          </div>
        </form>
      </div>

      <DialogFooter class="gap-2">
                <Button
          type="button"
          variant="outline"
          @click="handleReset"
        >
          {{ t('settings.model.modelConfig.resetToDefault') }}
        </Button>
        <Button type="button" variant="ghost" @click="$emit('update:open', false)">
          {{ t('settings.model.modelConfig.cancel') }}
        </Button>
        <Button type="button" @click="handleSave" :disabled="!isValid">
          {{ t('settings.model.modelConfig.saveConfig') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- 重置确认对话框 -->
  <Dialog :open="showResetConfirm" @update:open="showResetConfirm = $event">
    <DialogContent class="sm:max-w-[425px]">
      <DialogHeader>
        <DialogTitle>{{ t('settings.model.modelConfig.resetConfirm.title') }}</DialogTitle>
        <p class="text-sm text-muted-foreground">
          {{ t('settings.model.modelConfig.resetConfirm.message') }}
        </p>
      </DialogHeader>
      <DialogFooter>
        <Button variant="ghost" @click="showResetConfirm = false">
          {{ t('settings.model.modelConfig.cancel') }}
        </Button>
        <Button variant="destructive" @click="confirmReset">
          {{ t('settings.model.modelConfig.resetConfirm.confirm') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ModelType } from '@shared/model'
import type { ModelConfig } from '@shared/presenter'
import { useSettingsStore } from '@/stores/settings'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'

interface Props {
  open: boolean
  modelId: string
  modelName: string
  providerId: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:open': [boolean]
  saved: []
}>()

const { t } = useI18n()
const settingsStore = useSettingsStore()

// 配置数据
const config = ref<ModelConfig>({
  maxTokens: 4096,
  contextLength: 8192,
  temperature: 0.7,
  vision: false,
  functionCall: false,
  reasoning: false,
  type: ModelType.Chat
})

// 重置确认对话框
const showResetConfirm = ref(false)

// 错误信息
const errors = ref<Record<string, string>>({})

// 加载模型配置
const loadConfig = async () => {
  if (!props.modelId || !props.providerId) return

    try {
    const modelConfig = await settingsStore.getModelConfig(props.modelId, props.providerId)
    config.value = { ...modelConfig }
  } catch (error) {
    console.error('Failed to load model config:', error)
  }
}

// 验证表单
const validateForm = () => {
  errors.value = {}

  // 验证最大输出长度
  if (!config.value.maxTokens || config.value.maxTokens <= 0) {
    errors.value.maxTokens = t('settings.model.modelConfig.validation.maxTokensMin')
  } else if (config.value.maxTokens > 1000000) {
    errors.value.maxTokens = t('settings.model.modelConfig.validation.maxTokensMax')
  }

  // 验证上下文长度
  if (!config.value.contextLength || config.value.contextLength <= 0) {
    errors.value.contextLength = t('settings.model.modelConfig.validation.contextLengthMin')
  } else if (config.value.contextLength > 10000000) {
    errors.value.contextLength = t('settings.model.modelConfig.validation.contextLengthMax')
  }

  // 验证温度
  if (config.value.temperature < 0) {
    errors.value.temperature = t('settings.model.modelConfig.validation.temperatureMin')
  } else if (config.value.temperature > 2) {
    errors.value.temperature = t('settings.model.modelConfig.validation.temperatureMax')
  }
}

// 表单是否有效
const isValid = computed(() => {
  validateForm()
  return Object.keys(errors.value).length === 0
})

// 保存配置
const handleSave = async () => {
  if (!isValid.value) return

  try {
    await settingsStore.setModelConfig(props.modelId, props.providerId, config.value)
    emit('saved')
    emit('update:open', false)
  } catch (error) {
    console.error('Failed to save model config:', error)
  }
}

// 重置配置
const handleReset = () => {
  showResetConfirm.value = true
}

// 确认重置
const confirmReset = async () => {
  try {
    await settingsStore.resetModelConfig(props.modelId, props.providerId)
    await loadConfig() // 重新加载默认配置
    showResetConfirm.value = false
    emit('saved')
  } catch (error) {
    console.error('Failed to reset model config:', error)
  }
}

// 监听props变化，重新加载配置
watch(() => [props.modelId, props.providerId, props.open], () => {
  if (props.open) {
    loadConfig()
  }
}, { immediate: true })

onMounted(() => {
  if (props.open) {
    loadConfig()
  }
})
</script>

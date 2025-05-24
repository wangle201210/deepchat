<template>
  <div class="flex flex-col items-start gap-2 border rounded-lg p-2">
    <Accordion type="single" collapsible class="w-full">
      <AccordionItem value="safety-settings">
        <AccordionTrigger class="text-sm font-medium">{{
          t('settings.provider.safety.title', 'Safety Settings')
        }}</AccordionTrigger>
        <AccordionContent class="pt-4 px-1">
          <div class="flex flex-col gap-4">
            <div v-for="(setting, key) in safetyCategories" :key="key" class="flex flex-col gap-2">
              <div class="flex justify-between items-center">
                <Label :for="`${provider.id}-safety-${key}`" class="text-sm cursor-pointer">{{
                  t(setting.label, key.charAt(0).toUpperCase() + key.slice(1))
                }}</Label>
                <span class="text-sm text-muted-foreground">{{
                  t(levelLabels[safetyLevels[key]], `${levelToValueMap[safetyLevels[key]]}`)
                }}</span>
              </div>
              <Slider
                :id="`${provider.id}-safety-${key}`"
                :model-value="[safetyLevels[key]]"
                :min="0"
                :max="3"
                :step="1"
                class="w-full"
                @update:model-value="
                  (event) =>
                    event &&
                    event[0] !== undefined &&
                    handleSafetySettingChange(key as SafetyCategoryKey, event[0])
                "
              />
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  </div>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import {
  Accordion,
  AccordionItem,
  AccordionContent,
  AccordionTrigger
} from '@/components/ui/accordion'
import type { LLM_PROVIDER } from '@shared/presenter'
import {
  safetyCategories,
  SafetyCategoryKey,
  SafetySettingValue,
  levelToValueMap,
  levelLabels
} from '@/lib/gemini'

const { t } = useI18n()

const props = defineProps<{
  provider: LLM_PROVIDER
  initialSafetyLevels?: Record<string, number>
}>()

const emit = defineEmits<{
  'safety-setting-change': [key: SafetyCategoryKey, level: number, value: SafetySettingValue]
}>()

const safetyLevels = reactive<Record<string, number>>({})

// 初始化安全级别
watch(
  () => props.initialSafetyLevels,
  (newLevels) => {
    if (newLevels) {
      Object.assign(safetyLevels, newLevels)
    } else {
      // 使用默认值
      for (const key in safetyCategories) {
        safetyLevels[key] = safetyCategories[key as SafetyCategoryKey].defaultLevel
      }
    }
  },
  { immediate: true }
)

const handleSafetySettingChange = (key: SafetyCategoryKey, level: number) => {
  const value = levelToValueMap[level]
  if (value) {
    safetyLevels[key] = level
    emit('safety-setting-change', key, level, value)
  }
}
</script>

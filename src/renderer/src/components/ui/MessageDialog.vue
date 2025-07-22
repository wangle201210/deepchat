<template>
  <AlertDialog :open="showDialog">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>
          <div class="flex items-center space-x-2">
            <template v-if="dialogRequest?.type">
              <Icon v-bind="getIconProps(dialogRequest?.type)" class="h-6 w-6" />
            </template>
            <span>{{ dialogRequest?.i18n ? t(dialogRequest?.title) : dialogRequest?.title }}</span>
          </div>
        </AlertDialogTitle>
        <AlertDialogDescription v-if="dialogRequest?.description">
          <div class="space-y-2 text-secondary">
            {{ dialogRequest?.description }}
          </div>
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <template v-for="(button, index) in dialogRequest?.buttons">
          <AlertDialogAction v-if="index === dialogRequest?.defaultId" @click="handleClick(button)">
            {{ dialogRequest?.i18n ? t(button) : button }}
            <span
              v-if="timeoutSeconds && index === dialogRequest?.defaultId"
              class="inline-block min-w-8 text-right"
            >
              [{{ timeoutSeconds }}]
            </span>
          </AlertDialogAction>
          <AlertDialogCancel v-else @click="handleClick(button)">
            {{ dialogRequest?.i18n ? t(button) : button }}
          </AlertDialogCancel>
        </template>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogAction,
  AlertDialogCancel
} from '@/components/ui/alert-dialog'
import { Icon } from '@iconify/vue'
import { useDialogStore } from '@/stores/dialog'
import { computed } from 'vue'

const { t } = useI18n()
const dialog = useDialogStore()
const dialogRequest = computed(() => dialog.dialogRequest)
const showDialog = computed(() => dialog.showDialog)
const timeoutSeconds = computed(() => {
  if (dialog.timeoutMilliseconds > 0) {
    return perfectTime(dialog.timeoutMilliseconds)
  }
  return null
})
const handleClick = (button: string) => {
  dialog.handleResponse(button)
}
/**
 * 将时间转换为合适的单位，最小为1秒，最大单位为周
 * @param ms milliseconds
 */
const perfectTime = (ms) => {
  if (ms < 1000) return '1 s'
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds} s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} h`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} d`
  const weeks = Math.floor(days / 7)
  return `${weeks} w`
}

const getIconProps = (type: 'info' | 'warn' | 'error' | 'confirm') => {
  console.log('[Dialog] getIconProps called with type:', type)
  switch (type) {
    case 'warn':
      return { icon: 'lucide:circle-alert', class: "text-usage-mid" }
    case 'error':
      return { icon: 'lucide:circle-x', class: "text-usage-high" }
    case 'confirm':
      return { icon: 'lucide:circle-question-mark', class: 'text-usage-low font-size' }
    case 'info':
      return { icon: 'lucide:info', class: 'text-primary' }
  }
}
</script>

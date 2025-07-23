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
          <div class="space-y-2">
            {{ dialogRequest.i18n ? t(dialogRequest.description) : dialogRequest.description }}
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { useDialogStore } from '@/stores/dialog'
import { Icon } from '@iconify/vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

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
  if (!dialogRequest.value) return
  dialog.handleResponse({
    id: dialogRequest.value.id,
    button: button
  })
}

/**
 * convert milliseconds to human-readable format
 * @param ms milliseconds
 * @return string in the format of "1 s", "2 m", "3 h", etc. max is weeks
 */
const perfectTime = (ms: number) => {
  if (ms < 0 || !Number.isFinite(ms)) return '0 s'
  if (ms < 1000) return '1 s'
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds} s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} d`
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
      return { icon: 'lucide:circle-question-mark', class: 'text-usage-low' }
    case 'info':
      return { icon: 'lucide:info', class: 'text-primary' }
  }
}
</script>

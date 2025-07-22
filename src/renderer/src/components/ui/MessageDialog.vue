<template>
  <AlertDialog :open="showDialog">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>
        <component v-if="dialogRequest?.type" :is="getIconComponent(dialogRequest?.type)"/>
        {{
          dialogRequest?.i18n ? t(dialogRequest?.title) : dialogRequest?.title
        }}</AlertDialogTitle>
        <AlertDialogDescription v-if="dialogRequest?.description">
          <div class="space-y-2">
            {{ dialogRequest?.description }}
          </div>
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <template v-for="(button, index) in dialogRequest?.buttons">
          <AlertDialogAction
            v-if="index === dialogRequest?.defaultId"
            @click="handleClick(button)"
          >
            {{ dialogRequest?.i18n ? t(button) : button }}
            <span v-if="timeoutSeconds && index === dialogRequest?.defaultId" class="inline-block min-w-8 text-right">
              [{{ timeoutSeconds }}]
            </span>
          </AlertDialogAction>
          <AlertDialogCancel
            v-else
            @click="handleClick(button)"
          >
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

const getIconComponent = (type: 'info' | 'warning' | 'error' | 'question') => {
  switch (type) {
    case 'warning':
      return {
        component: Icon,
        props: {
          icon: 'lucide:circle-alert',
          color: 'var(--destructive)'
        }
      }
    case 'error':
      return {
        component: Icon,
        props: {
          icon: 'lucide:triangle-alert',
          color: 'var(--destructive)'
        }
      }
    case 'question':
      return {
        component: Icon,
        props: {
          icon: 'lucide:circle-question-mark',
          color: 'var(--primary)'
        }
      }
    case 'info':
    default:
      return {
        component: Icon,
        props: {
          icon: 'lucide:info',
          color: 'var(--primary)'
        }
      }
  }
}
</script>

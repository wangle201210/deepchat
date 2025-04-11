<template>
  <Dialog :open="settings.showUpdateDialog" @update:open="settings.closeUpdateDialog">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{{ t('update.newVersion') }}</DialogTitle>
        <DialogDescription>
          <div class="space-y-2">
            <p>{{ t('update.version') }}: {{ settings.updateInfo?.version }}</p>
            <p>{{ t('update.releaseDate') }}: {{ settings.updateInfo?.releaseDate }}</p>
            <p>{{ t('update.releaseNotes') }}:</p>
            <p
              class="whitespace-pre-line"
              v-html="renderMarkdown(getCommonMarkdown(), settings.updateInfo?.releaseNotes || '')"
            />

            <!-- 显示下载进度 -->
            <div v-if="settings.isDownloading && settings.updateProgress" class="mt-4">
              <p class="mb-2">
                {{ t('update.downloading') }}: {{ Math.round(settings.updateProgress.percent) }}%
              </p>
              <progress
                class="w-full"
                :value="settings.updateProgress.percent"
                max="100"
              ></progress>
              <p class="text-xs mt-1">
                {{ formatSize(settings.updateProgress.transferred) }} /
                {{ formatSize(settings.updateProgress.total) }}
                ({{ formatSpeed(settings.updateProgress.bytesPerSecond) }})
              </p>
            </div>
          </div>
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button
          variant="outline"
          @click="settings.closeUpdateDialog"
          :disabled="settings.isRestarting"
        >
          {{ t('update.later') }}
        </Button>

        <!-- 如果已下载完成，只显示"立即安装"按钮 -->
        <Button
          v-if="settings.isReadyToInstall"
          @click="handleUpdate('auto')"
          :disabled="settings.isRestarting"
        >
          {{ settings.isRestarting ? t('update.restarting') : t('update.installNow') }}
        </Button>

        <!-- 如果自动更新失败，显示手动下载按钮 -->
        <template v-else-if="settings.updateError">
          <Button @click="handleUpdate('github')">
            {{ t('update.githubDownload') }}
          </Button>
          <Button @click="handleUpdate('netdisk')">
            {{ t('update.netdiskDownload') }}
          </Button>
        </template>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { useSettingsStore } from '@/stores/settings'
import { renderMarkdown, getCommonMarkdown } from '@/lib/markdown.helper'

const { t } = useI18n()
const settings = useSettingsStore()

const handleUpdate = async (type: 'github' | 'netdisk' | 'auto') => {
  await settings.handleUpdate(type)
}

// 格式化文件大小
const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// 格式化下载速度
const formatSpeed = (bytesPerSecond: number): string => {
  if (bytesPerSecond < 1024) return `${bytesPerSecond.toFixed(0)} B/s`
  if (bytesPerSecond < 1024 * 1024) return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`
  return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`
}
</script>

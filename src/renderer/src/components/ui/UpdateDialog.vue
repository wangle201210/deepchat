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
          </div>
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline" @click="settings.closeUpdateDialog">
          {{ t('update.later') }}
        </Button>
        <Button @click="handleUpdate('github')">
          {{ t('update.githubDownload') }}
        </Button>
        <Button @click="handleUpdate('netdisk')">
          {{ t('update.netdiskDownload') }}
        </Button>
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

const handleUpdate = async (type: 'github' | 'netdisk') => {
  await settings.handleUpdate(type)
}
</script>

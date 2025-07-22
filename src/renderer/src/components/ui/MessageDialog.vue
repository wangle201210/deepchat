<template>
  <Dialog :open="dialog.showDialog">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{{
          dialogRequest?.i18n ? t(dialogRequest?.title) : dialogRequest?.title
        }}</DialogTitle>
        <DialogDescription v-if="dialogRequest?.description">
          <div class="space-y-2">
            {{ dialogRequest?.description }}
          </div>
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button
          v-for="(button, index) in dialogRequest?.buttons"
          :key="index"
          variant="outline"
          @click="handleClick(index)"
        >
          {{ dialogRequest?.i18n ? t(button) : button }}
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
import { useDialogStore } from '@/stores/dialog'
import { computed } from 'vue'

const { t } = useI18n()
const dialog = useDialogStore()
const dialogRequest = computed(() => dialog.dialogRequest)
const handleClick = (index) => {
  dialog.handleResponse(index)
}
</script>

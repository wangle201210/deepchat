<template>
  <TooltipProvider>
    <div
      class="w-full h-8 text-xs text-secondary-foreground items-center justify-between flex flex-row opacity-0 group-hover:opacity-100 transition-opacity"
      :class="[isAssistant ? '' : 'flex-row-reverse']"
    >
      <span v-show="!loading" class="flex flex-row gap-3">
        <!-- Edit mode buttons (save/cancel) -->
        <template v-if="isEditMode">
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="ghost"
                size="icon"
                class="w-4 h-4 text-muted-foreground hover:text-primary hover:bg-transparent"
                @click="emit('save')"
              >
                <Icon icon="lucide:check" class="w-3 h-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{{ t('thread.toolbar.save') }}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="ghost"
                size="icon"
                class="w-4 h-4 text-muted-foreground hover:text-primary hover:bg-transparent"
                @click="emit('cancel')"
              >
                <Icon icon="lucide:x" class="w-3 h-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{{ t('thread.toolbar.cancel') }}</TooltipContent>
          </Tooltip>
        </template>

        <!-- Normal mode buttons -->
        <template v-else>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                v-show="isAssistant && hasVariants"
                variant="ghost"
                size="icon"
                class="w-4 h-4 text-muted-foreground hover:text-primary hover:bg-transparent"
                @click="emit('prev')"
              >
                <Icon icon="lucide:chevron-left" class="w-3 h-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{{ t('thread.toolbar.previousVariant') }}</TooltipContent>
          </Tooltip>
          <span v-show="isAssistant && hasVariants">
            {{ currentVariantIndex !== undefined ? currentVariantIndex + 1 : 1 }} /
            {{ totalVariants }}
          </span>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                v-show="isAssistant && hasVariants"
                variant="ghost"
                size="icon"
                class="w-4 h-4 text-muted-foreground hover:text-primary hover:bg-transparent"
                @click="emit('next')"
              >
                <Icon icon="lucide:chevron-right" class="w-3 h-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{{ t('thread.toolbar.nextVariant') }}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="ghost"
                size="icon"
                class="w-4 h-4 text-muted-foreground hover:text-primary hover:bg-transparent"
                @click="emit('copy')"
              >
                <Icon icon="lucide:copy" class="w-3 h-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{{ t('thread.toolbar.copy') }}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="ghost"
                v-show="isAssistant"
                size="icon"
                class="w-4 h-4 text-muted-foreground hover:text-primary hover:bg-transparent"
                @click="emit('copyImage')"
              >
                <Icon icon="lucide:images" class="w-3 h-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{{ t('thread.toolbar.copyImage') }}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                v-show="isAssistant"
                variant="ghost"
                size="icon"
                class="w-4 h-4 text-muted-foreground hover:text-primary hover:bg-transparent"
                @click="emit('retry')"
              >
                <Icon icon="lucide:refresh-cw" class="w-3 h-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{{ t('thread.toolbar.retry') }}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                v-show="isAssistant && !loading && !isInGeneratingThread"
                variant="ghost"
                size="icon"
                class="w-4 h-4 text-muted-foreground hover:text-primary hover:bg-transparent"
                @click="emit('fork')"
              >
                <Icon icon="lucide:git-branch" class="w-3 h-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{{ t('thread.toolbar.fork') }}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                v-show="!isAssistant && !isEditMode"
                variant="ghost"
                size="icon"
                class="w-4 h-4 text-muted-foreground hover:text-primary hover:bg-transparent"
                @click="emit('edit')"
              >
                <Icon icon="lucide:edit" class="w-3 h-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{{ t('thread.toolbar.edit') }}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="ghost"
                size="icon"
                class="w-4 h-4 text-muted-foreground hover:text-primary hover:bg-transparent"
                @click="emit('delete')"
              >
                <Icon icon="lucide:trash-2" class="w-3 h-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{{ t('thread.toolbar.delete') }}</TooltipContent>
          </Tooltip>
        </template>
      </span>
      <span class="flex flex-row gap-2">
        <template v-if="usage.input_tokens > 0 || usage.output_tokens > 0">
          <span class="text-xs flex flex-row items-center">
            <Icon icon="lucide:arrow-up" class="w-3 h-3" />{{ usage.input_tokens }}
          </span>
          <span class="text-xs flex flex-row items-center">
            <Icon icon="lucide:arrow-down" class="w-3 h-3" />{{ usage.output_tokens }}
          </span>
        </template>
        <template v-if="hasTokensPerSecond">{{ usage.tokens_per_second?.toFixed(2) }}/s</template>
      </span>
    </div>
  </TooltipProvider>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { Button } from '@/components/ui/button'
import { computed } from 'vue'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps<{
  usage: {
    tokens_per_second: number
    total_tokens: number
    reasoning_start_time: number
    reasoning_end_time: number
    input_tokens: number
    output_tokens: number
  }
  loading: boolean
  isAssistant: boolean
  currentVariantIndex?: number
  totalVariants?: number
  isEditMode?: boolean
  isInGeneratingThread?: boolean
}>()
const emit = defineEmits<{
  (e: 'retry'): void
  (e: 'delete'): void
  (e: 'copy'): void
  (e: 'copyImage'): void
  (e: 'prev'): void
  (e: 'next'): void
  (e: 'edit'): void
  (e: 'save'): void
  (e: 'cancel'): void
  (e: 'fork'): void
}>()

const hasTokensPerSecond = computed(() => props.usage.tokens_per_second > 0)
const hasVariants = computed(() => (props.totalVariants || 0) > 1)
</script>

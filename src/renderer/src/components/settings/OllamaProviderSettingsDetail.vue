<template>
  <section class="w-full h-full">
    <div class="w-full h-full p-2 flex flex-col gap-2 overflow-y-auto">
      <div class="flex flex-col items-start p-2 gap-2">
        <div class="flex justify-between items-center w-full">
          <Label :for="`${provider.id}-url`" class="flex-1 cursor-pointer">API URL</Label>
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
              defaultUrl: 'http://127.0.0.1:11434'
            })
          }}
        </div>
      </div>

      <div class="flex flex-col items-start p-2 gap-2">
        <Label :for="`${provider.id}-model`" class="flex-1 cursor-pointer">
          {{ t('settings.provider.modelList') }}
        </Label>
        <div class="flex flex-row gap-2 items-center">
          <Button
            variant="outline"
            size="xs"
            class="text-xs text-normal rounded-lg"
            @click="showPullModelDialog = true"
          >
            <Icon icon="lucide:download" class="w-4 h-4 text-muted-foreground" />
            {{ t('settings.provider.pullModels') }}
          </Button>
          <Button
            variant="outline"
            size="xs"
            class="text-xs text-normal rounded-lg"
            @click="refreshModels"
          >
            <Icon icon="lucide:refresh-cw" class="w-4 h-4 text-muted-foreground" />
            {{ t('settings.provider.refreshModels') }}
          </Button>
          <span class="text-xs text-secondary-foreground">
            {{ runningModels.length }}/{{ localModels.length }}
            {{ t('settings.provider.modelsRunning') }}
          </span>
        </div>

        <!-- 运行中模型列表 -->
        <div class="flex flex-col w-full gap-2">
          <h3 class="text-sm font-medium text-secondary-foreground">
            {{ t('settings.provider.runningModels') }}
          </h3>
          <div class="flex flex-col w-full border overflow-hidden rounded-lg">
            <div
              v-if="runningModels.length === 0"
              class="p-4 text-center text-secondary-foreground"
            >
              {{ t('settings.provider.noRunningModels') }}
            </div>
            <div
              v-for="model in runningModels"
              :key="model.name"
              class="flex flex-row items-center justify-between p-2 border-b last:border-b-0 hover:bg-accent"
            >
              <div class="flex flex-col">
                <span class="text-sm font-medium">{{ model.name }}</span>
                <span class="text-xs text-secondary-foreground">{{
                  formatModelSize(model.size)
                }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 本地模型列表 -->
        <div class="flex flex-col w-full gap-2 mt-2">
          <h3 class="text-sm font-medium text-secondary-foreground">
            {{ t('settings.provider.localModels') }}
          </h3>
          <div class="flex flex-col w-full border overflow-hidden rounded-lg">
            <div
              v-if="localModels.length === 0 && pullingModels.size === 0"
              class="p-4 text-center text-secondary-foreground"
            >
              {{ t('settings.provider.noLocalModels') }}
            </div>
            <div
              v-for="model in displayLocalModels"
              :key="model.name"
              class="flex flex-row items-center justify-between p-2 border-b last:border-b-0 hover:bg-accent"
            >
              <div class="flex flex-col flex-grow">
                <div class="flex flex-row items-center gap-1">
                  <span class="text-sm font-medium">{{ model.name }}</span>
                  <span
                    v-if="model.pulling"
                    class="text-xs text-primary-foreground bg-primary px-1 py-0.5 rounded"
                  >
                    {{ t('settings.provider.pulling') }}
                  </span>
                  <span class="w-[50px]" v-if="model.pulling">
                    <Progress :modelValue="pullingModels.get(model.name)" class="h-1.5" />
                  </span>
                </div>
                <span class="text-xs text-secondary-foreground">{{
                  formatModelSize(model.size)
                }}</span>
              </div>
              <div class="flex flex-row gap-2">
                <Button
                  v-if="!model.pulling"
                  variant="destructive"
                  size="xs"
                  class="text-xs rounded-lg"
                  :disabled="isModelRunning(model.name)"
                  @click="showDeleteModelConfirm(model.name)"
                >
                  <Icon icon="lucide:trash-2" class="w-3.5 h-3.5 mr-1" />
                  {{ t('settings.provider.deleteModel') }}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 拉取模型对话框 -->
    <Dialog v-model:open="showPullModelDialog">
      <DialogContent class="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{{ t('settings.provider.dialog.pullModel.title') }}</DialogTitle>
        </DialogHeader>
        <div class="py-4 max-h-80 overflow-y-auto">
          <div class="grid grid-cols-1 gap-2">
            <div
              v-for="model in availableModels"
              :key="model.name"
              class="flex flex-row items-center justify-between p-2 border rounded-lg hover:bg-accent"
              :class="{ 'opacity-50': isModelLocal(model.name) }"
            >
              <div class="flex flex-col">
                <span class="text-sm font-medium">{{ model.name }}</span>
              </div>
              <Button
                variant="outline"
                size="xs"
                class="text-xs rounded-lg"
                :disabled="isModelLocal(model.name)"
                @click="pullModel(model.name)"
              >
                <Icon icon="lucide:download" class="w-3.5 h-3.5 mr-1" />
                {{ t('settings.provider.dialog.pullModel.pull') }}
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showPullModelDialog = false">
            {{ t('dialog.close') }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- 删除模型确认对话框 -->
    <Dialog v-model:open="showDeleteModelDialog">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ t('settings.provider.dialog.deleteModel.title') }}</DialogTitle>
        </DialogHeader>
        <div class="py-4">
          {{ t('settings.provider.dialog.deleteModel.content', { name: modelToDelete }) }}
        </div>
        <DialogFooter>
          <Button variant="outline" @click="showDeleteModelDialog = false">
            {{ t('dialog.cancel') }}
          </Button>
          <Button variant="destructive" @click="confirmDeleteModel">
            {{ t('settings.provider.dialog.deleteModel.confirm') }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </section>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { computed, ref, watch, onMounted } from 'vue'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Icon } from '@iconify/vue'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog'
import { useSettingsStore } from '@/stores/settings'
import type { LLM_PROVIDER } from '@shared/presenter'

const { t } = useI18n()

const props = defineProps<{
  provider: LLM_PROVIDER
}>()

const settingsStore = useSettingsStore()
const apiHost = ref(props.provider.baseUrl || '')

// 模型列表 - 从 settings store 获取
const runningModels = computed(() => settingsStore.ollamaRunningModels)
const localModels = computed(() => settingsStore.ollamaLocalModels)
const pullingModels = computed(() => settingsStore.ollamaPullingModels)

// 对话框状态
const showPullModelDialog = ref(false)
const showDeleteModelDialog = ref(false)
const modelToDelete = ref('')

// 预设可拉取的模型列表
const presetModels = [
  {
    name: 'gemma3:1b'
  },
  {
    name: 'gemma3:4b'
  },
  {
    name: 'gemma3:12b'
  },
  {
    name: 'gemma3:27b'
  },
  {
    name: 'qwq:32b'
  },
  {
    name: 'deepseek-r1:1.5b'
  },
  {
    name: 'deepseek-r1:7b'
  },
  {
    name: 'deepseek-r1:8b'
  },
  {
    name: 'deepseek-r1:14b'
  },
  {
    name: 'deepseek-r1:32b'
  },
  {
    name: 'deepseek-r1:70b'
  },
  {
    name: 'deepseek-r1:671b'
  },
  {
    name: 'llama3.3:70b'
  },
  {
    name: 'phi4:14b'
  },
  {
    name: 'llama3.2:1b'
  },
  {
    name: 'llama3.2:3b'
  },
  {
    name: 'llama3.1:8b'
  },
  {
    name: 'llama3.1:70b'
  },
  {
    name: 'llama3.1:405b'
  },
  {
    name: 'mistral:7b'
  },
  {
    name: 'llama3:8b'
  },
  {
    name: 'llama3:70b'
  },
  {
    name: 'qwen2.5:0.5b'
  },
  {
    name: 'qwen2.5:1.5b'
  },
  {
    name: 'qwen2.5:3b'
  },
  {
    name: 'qwen2.5:7b'
  },
  {
    name: 'qwen2.5:14b'
  },
  {
    name: 'qwen2.5:32b'
  },
  {
    name: 'qwen2.5:72b'
  },
  {
    name: 'qwen2.5-coder:0.5b'
  },
  {
    name: 'qwen2.5-coder:1.5b'
  },
  {
    name: 'qwen2.5-coder:3b'
  },
  {
    name: 'qwen2.5-coder:7b'
  },
  {
    name: 'qwen2.5-coder:14b'
  },
  {
    name: 'qwen2.5-coder:32b'
  },
  {
    name: 'llava:7b'
  },
  {
    name: 'llava:13b'
  },
  {
    name: 'llava:34b'
  },
  {
    name: 'qwen:0.5b'
  },
  {
    name: 'qwen:1.8b'
  },
  {
    name: 'qwen:4b'
  },
  {
    name: 'qwen:7b'
  },
  {
    name: 'qwen:14b'
  },
  {
    name: 'qwen:32b'
  },
  {
    name: 'qwen:72b'
  },
  {
    name: 'qwen:110b'
  },
  {
    name: 'gemma:2b'
  },
  {
    name: 'gemma:7b'
  },
  {
    name: 'qwen2:0.5b'
  },
  {
    name: 'qwen2:1.5b'
  },
  {
    name: 'qwen2:7b'
  },
  {
    name: 'qwen2:72b'
  },
  {
    name: 'gemma2:2b'
  },
  {
    name: 'gemma2:9b'
  },
  {
    name: 'gemma2:27b'
  },
  {
    name: 'llama2:7b'
  },
  {
    name: 'llama2:13b'
  },
  {
    name: 'llama2:70b'
  },
  {
    name: 'phi3:3.8b'
  },
  {
    name: 'phi3:14b'
  },
  {
    name: 'mxbai-embed-large:335m'
  },
  {
    name: 'codellama:7b'
  },
  {
    name: 'codellama:13b'
  },
  {
    name: 'codellama:34b'
  },
  {
    name: 'codellama:70b'
  },
  {
    name: 'llama3.2-vision:11b'
  },
  {
    name: 'llama3.2-vision:90b'
  },
  {
    name: 'mistral-nemo:12b'
  },
  {
    name: 'tinyllama:1.1b'
  },
  {
    name: 'deepseek-v3:671b'
  },
  {
    name: 'starcoder2:3b'
  },
  {
    name: 'starcoder2:7b'
  },
  {
    name: 'starcoder2:15b'
  },
  {
    name: 'llama2-uncensored:7b'
  },
  {
    name: 'llama2-uncensored:70b'
  },
  {
    name: 'minicpm-v:8b'
  },
  {
    name: 'bge-m3:567m'
  },
  {
    name: 'deepseek-coder-v2:16b'
  },
  {
    name: 'deepseek-coder-v2:236b'
  },
  {
    name: 'snowflake-arctic-embed:22m'
  },
  {
    name: 'snowflake-arctic-embed:33m'
  },
  {
    name: 'snowflake-arctic-embed:110m'
  },
  {
    name: 'snowflake-arctic-embed:137m'
  },
  {
    name: 'snowflake-arctic-embed:335m'
  },
  {
    name: 'dolphin3:8b'
  },
  {
    name: 'deepseek-coder:1.3b'
  },
  {
    name: 'deepseek-coder:6.7b'
  },
  {
    name: 'deepseek-coder:33b'
  },
  {
    name: 'mixtral:8x7b'
  },
  {
    name: 'mixtral:8x22b'
  },
  {
    name: 'olmo2:7b'
  },
  {
    name: 'olmo2:13b'
  },
  {
    name: 'llava-llama3:8b'
  },
  {
    name: 'codegemma:2b'
  },
  {
    name: 'codegemma:7b'
  },
  {
    name: 'dolphin-mixtral:8x7b'
  },
  {
    name: 'dolphin-mixtral:8x22b'
  },
  {
    name: 'openthinker:7b'
  },
  {
    name: 'openthinker:32b'
  },
  {
    name: 'smollm2:135m'
  },
  {
    name: 'smollm2:360m'
  },
  {
    name: 'smollm2:1.7b'
  },
  {
    name: 'phi:2.7b'
  },
  {
    name: 'mistral-small:22b'
  },
  {
    name: 'mistral-small:24b'
  },
  {
    name: 'wizardlm2:7b'
  },
  {
    name: 'wizardlm2:8x22b'
  },
  {
    name: 'all-minilm:22m'
  },
  {
    name: 'all-minilm:33m'
  },
  {
    name: 'dolphin-mistral:7b'
  },
  {
    name: 'orca-mini:3b'
  },
  {
    name: 'orca-mini:7b'
  },
  {
    name: 'orca-mini:13b'
  },
  {
    name: 'orca-mini:70b'
  },
  {
    name: 'dolphin-llama3:8b'
  },
  {
    name: 'dolphin-llama3:70b'
  },
  {
    name: 'command-r:35b'
  },
  {
    name: 'yi:6b'
  },
  {
    name: 'yi:9b'
  },
  {
    name: 'yi:34b'
  },
  {
    name: 'hermes3:3b'
  },
  {
    name: 'hermes3:8b'
  },
  {
    name: 'hermes3:70b'
  },
  {
    name: 'hermes3:405b'
  },
  {
    name: 'phi3.5:3.8b'
  },
  {
    name: 'zephyr:7b'
  },
  {
    name: 'zephyr:141b'
  },
  {
    name: 'codestral:22b'
  },
  {
    name: 'smollm:135m'
  },
  {
    name: 'smollm:360m'
  },
  {
    name: 'smollm:1.7b'
  },
  {
    name: 'granite-code:3b'
  },
  {
    name: 'granite-code:8b'
  },
  {
    name: 'granite-code:20b'
  },
  {
    name: 'granite-code:34b'
  },
  {
    name: 'wizard-vicuna-uncensored:7b'
  },
  {
    name: 'wizard-vicuna-uncensored:13b'
  },
  {
    name: 'wizard-vicuna-uncensored:30b'
  },
  {
    name: 'starcoder:1b'
  },
  {
    name: 'starcoder:3b'
  },
  {
    name: 'starcoder:7b'
  },
  {
    name: 'starcoder:15b'
  },
  {
    name: 'vicuna:7b'
  },
  {
    name: 'vicuna:13b'
  },
  {
    name: 'vicuna:33b'
  },
  {
    name: 'mistral-openorca:7b'
  },
  {
    name: 'moondream:1.8b'
  },
  {
    name: 'llama2-chinese:7b'
  },
  {
    name: 'llama2-chinese:13b'
  },
  {
    name: 'openchat:7b'
  },
  {
    name: 'codegeex4:9b'
  },
  {
    name: 'aya:8b'
  },
  {
    name: 'aya:35b'
  },
  {
    name: 'codeqwen:7b'
  },
  {
    name: 'deepseek-llm:7b'
  },
  {
    name: 'deepseek-llm:67b'
  },
  {
    name: 'deepseek-v2:16b'
  },
  {
    name: 'deepseek-v2:236b'
  },
  {
    name: 'mistral-large:123b'
  },
  {
    name: 'glm4:9b'
  },
  {
    name: 'stable-code:3b'
  },
  {
    name: 'tinydolphin:1.1b'
  },
  {
    name: 'nous-hermes2:10.7b'
  },
  {
    name: 'nous-hermes2:34b'
  },
  {
    name: 'qwen2-math:1.5b'
  },
  {
    name: 'qwen2-math:7b'
  },
  {
    name: 'qwen2-math:72b'
  },
  {
    name: 'command-r-plus:104b'
  },
  {
    name: 'wizardcoder:33b'
  },
  {
    name: 'bakllava:7b'
  },
  {
    name: 'stablelm2:1.6b'
  },
  {
    name: 'stablelm2:12b'
  },
  {
    name: 'neural-chat:7b'
  },
  {
    name: 'reflection:70b'
  },
  {
    name: 'wizard-math:7b'
  },
  {
    name: 'wizard-math:13b'
  },
  {
    name: 'wizard-math:70b'
  },
  {
    name: 'llama3-chatqa:8b'
  },
  {
    name: 'llama3-chatqa:70b'
  },
  {
    name: 'llama3-gradient:8b'
  },
  {
    name: 'llama3-gradient:70b'
  },
  {
    name: 'sqlcoder:7b'
  },
  {
    name: 'sqlcoder:15b'
  },
  {
    name: 'bge-large:335m'
  },
  {
    name: 'phi4-mini:3.8b'
  },
  {
    name: 'samantha-mistral:7b'
  },
  {
    name: 'granite3.1-dense:2b'
  },
  {
    name: 'granite3.1-dense:8b'
  },
  {
    name: 'dolphincoder:7b'
  },
  {
    name: 'dolphincoder:15b'
  },
  {
    name: 'xwinlm:7b'
  },
  {
    name: 'xwinlm:13b'
  },
  {
    name: 'llava-phi3:3.8b'
  },
  {
    name: 'nous-hermes:7b'
  },
  {
    name: 'nous-hermes:13b'
  },
  {
    name: 'phind-codellama:34b'
  },
  {
    name: 'starling-lm:7b'
  },
  {
    name: 'solar:10.7b'
  },
  {
    name: 'yarn-llama2:7b'
  },
  {
    name: 'yarn-llama2:13b'
  },
  {
    name: 'yi-coder:1.5b'
  },
  {
    name: 'yi-coder:9b'
  },
  {
    name: 'athene-v2:72b'
  },
  {
    name: 'internlm2:1m'
  },
  {
    name: 'internlm2:1.8b'
  },
  {
    name: 'internlm2:7b'
  },
  {
    name: 'internlm2:20b'
  },
  {
    name: 'nemotron-mini:4b'
  },
  {
    name: 'deepscaler:1.5b'
  },
  {
    name: 'falcon:7b'
  },
  {
    name: 'falcon:40b'
  },
  {
    name: 'falcon:180b'
  },
  {
    name: 'granite3-dense:2b'
  },
  {
    name: 'granite3-dense:8b'
  },
  {
    name: 'nemotron:70b'
  },
  {
    name: 'dolphin-phi:2.7b'
  },
  {
    name: 'orca2:7b'
  },
  {
    name: 'orca2:13b'
  },
  {
    name: 'wizardlm-uncensored:13b'
  },
  {
    name: 'stable-beluga:7b'
  },
  {
    name: 'stable-beluga:13b'
  },
  {
    name: 'stable-beluga:70b'
  },
  {
    name: 'llama3-groq-tool-use:8b'
  },
  {
    name: 'llama3-groq-tool-use:70b'
  },
  {
    name: 'granite3.2:2b'
  },
  {
    name: 'granite3.2:8b'
  },
  {
    name: 'paraphrase-multilingual:278m'
  },
  {
    name: 'snowflake-arctic-embed2:568m'
  },
  {
    name: 'deepseek-v2.5:236b'
  },
  {
    name: 'smallthinker:3b'
  },
  {
    name: 'aya-expanse:8b'
  },
  {
    name: 'aya-expanse:32b'
  },
  {
    name: 'meditron:7b'
  },
  {
    name: 'meditron:70b'
  },
  {
    name: 'medllama2:7b'
  },
  {
    name: 'granite3-moe:1b'
  },
  {
    name: 'granite3-moe:3b'
  },
  {
    name: 'falcon3:1b'
  },
  {
    name: 'falcon3:3b'
  },
  {
    name: 'falcon3:7b'
  },
  {
    name: 'falcon3:10b'
  },
  {
    name: 'yarn-mistral:7b'
  },
  {
    name: 'nexusraven:13b'
  },
  {
    name: 'codeup:13b'
  },
  {
    name: 'everythinglm:13b'
  },
  {
    name: 'nous-hermes2-mixtral:8x7b'
  },
  {
    name: 'granite3.1-moe:1b'
  },
  {
    name: 'granite3.1-moe:3b'
  },
  {
    name: 'shieldgemma:2b'
  },
  {
    name: 'shieldgemma:9b'
  },
  {
    name: 'shieldgemma:27b'
  },
  {
    name: 'reader-lm:0.5b'
  },
  {
    name: 'reader-lm:1.5b'
  },
  {
    name: 'granite3.2-vision:2b'
  },
  {
    name: 'marco-o1:7b'
  },
  {
    name: 'exaone3.5:2.4b'
  },
  {
    name: 'exaone3.5:7.8b'
  },
  {
    name: 'exaone3.5:32b'
  },
  {
    name: 'mathstral:7b'
  },
  {
    name: 'llama-guard3:1b'
  },
  {
    name: 'llama-guard3:8b'
  },
  {
    name: 'solar-pro:22b'
  },
  {
    name: 'falcon2:11b'
  },
  {
    name: 'stablelm-zephyr:3b'
  },
  {
    name: 'magicoder:7b'
  },
  {
    name: 'codebooga:34b'
  },
  {
    name: 'duckdb-nsql:7b'
  },
  {
    name: 'mistrallite:7b'
  },
  {
    name: 'wizard-vicuna:13b'
  },
  {
    name: 'command-r7b:7b'
  },
  {
    name: 'granite-embedding:30m'
  },
  {
    name: 'granite-embedding:278m'
  },
  {
    name: 'opencoder:1.5b'
  },
  {
    name: 'opencoder:8b'
  },
  {
    name: 'nuextract:3.8b'
  },
  {
    name: 'megadolphin:120b'
  },
  {
    name: 'bespoke-minicheck:7b'
  },
  {
    name: 'notux:8x7b'
  },
  {
    name: 'open-orca-platypus2:13b'
  },
  {
    name: 'notus:7b'
  },
  {
    name: 'exaone-deep:2.4b'
  },
  {
    name: 'exaone-deep:7.8b'
  },
  {
    name: 'exaone-deep:32b'
  },
  {
    name: 'tulu3:8b'
  },
  {
    name: 'tulu3:70b'
  },
  {
    name: 'r1-1776:70b'
  },
  {
    name: 'r1-1776:671b'
  },
  {
    name: 'firefunction-v2:70b'
  },
  {
    name: 'dbrx:132b'
  },
  {
    name: 'granite3-guardian:2b'
  },
  {
    name: 'granite3-guardian:8b'
  },
  {
    name: 'alfred:40b'
  },
  {
    name: 'sailor2:1b'
  },
  {
    name: 'sailor2:8b'
  },
  {
    name: 'sailor2:20b'
  },
  {
    name: 'command-a:111b'
  },
  {
    name: 'command-r7b-arabic:7b'
  }
]

// 可拉取的模型（排除已有的和正在拉取的）
const availableModels = computed(() => {
  const localModelNames = new Set(localModels.value.map((m) => m.name))
  const pullingModelNames = new Set(Array.from(pullingModels.value.keys()))
  return presetModels.filter((m) => !localModelNames.has(m.name) && !pullingModelNames.has(m.name))
})

// 显示的本地模型（包括正在拉取的）
const displayLocalModels = computed(() => {
  // 创建带有pulling状态和进度的模型列表
  const models = localModels.value.map((model) => ({
    ...model,
    pulling: pullingModels.value.has(model.name),
    progress: pullingModels.value.get(model.name) || 0
  }))

  // 添加正在拉取但尚未出现在本地列表中的模型
  for (const [modelName, progress] of pullingModels.value.entries()) {
    if (!models.some((m) => m.name === modelName)) {
      models.unshift({
        name: modelName,
        model: modelName, // 添加必需的字段
        modified_at: new Date(), // 添加必需的字段
        size: 0,
        digest: '', // 添加必需的字段
        details: {
          // 添加必需的字段
          format: '',
          family: '',
          families: [],
          parameter_size: '',
          quantization_level: ''
        },
        pulling: true,
        progress
      })
    }
  }

  // 排序: 正在拉取的放前面，其余按名称排序
  return models.sort((a, b) => {
    if (a.pulling && !b.pulling) return -1
    if (!a.pulling && b.pulling) return 1
    return a.name.localeCompare(b.name)
  })
})

// 初始化
onMounted(() => {
  refreshModels()
})

// 刷新模型列表 - 使用 settings store
const refreshModels = async () => {
  await settingsStore.refreshOllamaModels()
}

// 拉取模型 - 使用 settings store
const pullModel = async (modelName: string) => {
  try {
    // 开始拉取
    const success = await settingsStore.pullOllamaModel(modelName)

    // 成功开始拉取后关闭对话框
    if (success) {
      showPullModelDialog.value = false
    }
  } catch (error) {
    console.error(`Failed to pull model ${modelName}:`, error)
  }
}

// 显示删除模型确认对话框
const showDeleteModelConfirm = (modelName: string) => {
  modelToDelete.value = modelName
  showDeleteModelDialog.value = true
}

// 确认删除模型 - 使用 settings store
const confirmDeleteModel = async () => {
  if (!modelToDelete.value) return

  try {
    const success = await settingsStore.deleteOllamaModel(modelToDelete.value)
    if (success) {
      // 删除成功后模型列表会自动刷新，无需额外调用 refreshModels
    }
    showDeleteModelDialog.value = false
    modelToDelete.value = ''
  } catch (error) {
    console.error(`Failed to delete model ${modelToDelete.value}:`, error)
  }
}

// 工具函数
const formatModelSize = (sizeInBytes: number): string => {
  if (!sizeInBytes) return ''

  const GB = 1024 * 1024 * 1024
  if (sizeInBytes >= GB) {
    return `${(sizeInBytes / GB).toFixed(2)} GB`
  }

  const MB = 1024 * 1024
  if (sizeInBytes >= MB) {
    return `${(sizeInBytes / MB).toFixed(2)} MB`
  }

  const KB = 1024
  return `${(sizeInBytes / KB).toFixed(2)} KB`
}

// 使用 settings store 的辅助函数
const isModelRunning = (modelName: string): boolean => {
  return settingsStore.isOllamaModelRunning(modelName)
}

const isModelLocal = (modelName: string): boolean => {
  return settingsStore.isOllamaModelLocal(modelName)
}

// API URL 处理
const handleApiHostChange = async (value: string) => {
  await settingsStore.updateProviderApi(props.provider.id, undefined, value)
}

// 监听 provider 变化
watch(
  () => props.provider,
  () => {
    apiHost.value = props.provider.baseUrl || ''
    refreshModels()
  },
  { immediate: true }
)
</script>

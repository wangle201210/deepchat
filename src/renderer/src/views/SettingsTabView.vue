<template>
  <div class="w-full h-full flex flex-row">
    <div class="w-52 h-full border-r border-border p-2 space-y-2 flex-shrink-0 overflow-y-auto">
      <div v-for="setting in settings" :key="setting.name" :class="[
        'flex flex-row items-center hover:bg-accent gap-2 rounded-lg p-2 cursor-pointer',
        route.name === setting.name ? 'bg-accent' : ''
      ]" @click="handleClick(setting.path)">
        <Icon :icon="setting.icon" class="w-4 h-4 text-muted-foreground" />
        <span class="text-sm font-medium">{{ t(setting.title) }}</span>
      </div>
    </div>
    <RouterView />
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useRouter } from 'vue-router'
import { useRoute, RouterView } from 'vue-router'
import { onMounted, Ref, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const settings: Ref<
  {
    title: string
    name: string
    icon: string
    path: string
  }[]
> = ref([])

const routes = router.getRoutes()
onMounted(() => {
  routes.forEach((route) => {
    if (route.name === 'settings') {
      route.children?.forEach((child) => {
        settings.value.push({
          title: child.meta?.titleKey as string,
          icon: child.meta?.icon as string,
          path: `/settings/${child.path}`,
          name: child.name as string
        })
      })
    }
  })
})

const handleClick = (path: string) => {
  router.push(path)
}
</script>

<style></style>

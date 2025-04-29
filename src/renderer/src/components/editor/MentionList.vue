<template>
  <div
    class="z-50 min-w-[180px] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
  >
    <div v-if="isCategoryView" class="text-xs text-muted-foreground pb-1 px-1">
      {{ currentCategory }}
    </div>
    <template v-if="items.length">
      <button
        v-for="(item, index) in displayItems"
        :key="index"
        class="relative flex cursor-default hover:bg-accent select-none items-center rounded-sm gap-2 px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 w-full text-left"
        :class="[index === selectedIndex ? 'bg-accent' : '']"
        @click="selectItem(index)"
      >
        <Icon v-if="item.icon" :icon="item.icon" class="size-4 shrink-0" />
        <div class="font-medium flex-1 truncate">
          {{ item.label }}
        </div>
        <Icon v-if="isCategoryView" icon="lucide:chevron-right" class="size-4 shrink-0"></Icon>
      </button>
    </template>
    <div v-else class="p-1 text-sm text-muted-foreground">No result</div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { Icon } from '@iconify/vue'
import { CategorizedData } from './suggestion'

const props = defineProps<{
  items: CategorizedData[] // Allow items to be strings or objects
  command: (payload: { id: string; category?: string | null }) => void
  query: string // Declare the query prop
}>()
const selectedIndex = ref(0)
const currentCategory = ref<string | null>(null)
const isCategoryView = computed(() => currentCategory.value != null)

// Compute items to display based on the current category
const displayItems = computed<CategorizedData[]>(() => {
  if (props.query) {
    if (!isCategoryView.value) {
      return props.items
    } else {
      return props.items.filter(
        (item) => item.type === 'item' && item.category === currentCategory.value
      )
    }
  } else {
    if (!isCategoryView.value) {
      return props.items.filter((item) => item.type === 'category')
    } else {
      return props.items.filter(
        (item) => item.type === 'item' && item.category === currentCategory.value
      )
    }
  }
})

watch(
  () => props.items,
  () => {
    // Reset selection state when items change
    selectedIndex.value = 0
  },
  { immediate: true } // Run watcher immediately to set initial state
)

const upHandler = () => {
  if (displayItems.value.length === 0) return
  selectedIndex.value =
    (selectedIndex.value + displayItems.value.length - 1) % displayItems.value.length
}

const downHandler = () => {
  if (displayItems.value.length === 0) return
  selectedIndex.value = (selectedIndex.value + 1) % displayItems.value.length
}

const selectItem = (index: number) => {
  const selectedDisplayItem = displayItems.value[index]
  if (!selectedDisplayItem) return
  if (selectedDisplayItem.type === 'category') {
    currentCategory.value = selectedDisplayItem.label
    selectedIndex.value = 0
  } else {
    props.command({ id: selectedDisplayItem.label, category: currentCategory.value })
  }
}

const enterHandler = () => {
  selectItem(selectedIndex.value)
}

const backHandler = () => {
  if (currentCategory.value !== null) {
    currentCategory.value = null
    selectedIndex.value = 0
    return true
  } else {
    return false
  }
}

const cleanHandler = () => {
  currentCategory.value = null
  selectedIndex.value = 0
}

const onKeyDown = ({ event }: { event: KeyboardEvent }): boolean => {
  if (event.key === 'ArrowUp') {
    upHandler()
    return true
  }

  if (event.key === 'ArrowDown') {
    downHandler()
    return true
  }

  if (event.key === 'Enter') {
    enterHandler()
    // Prevent default form submission or other behavior
    event.preventDefault()
    return true
  }

  if (event.key === 'Escape') {
    cleanHandler()
    return true
  }

  if (event.key === 'Backspace') {
    if (backHandler()) {
      return true
    } else {
      return false
    }
  }

  // Use Escape or Backspace (if not in category view) to go back
  // if (event.key === 'Escape' || (event.key === 'Backspace' && !isCategoryView.value)) {
  //   if (backHandler()) {
  //     return true
  //   }
  // }

  return false
}

defineExpose({
  onKeyDown
})
</script>

<template>
  <div
    class="bg-white border border-gray-100 rounded-lg shadow-md flex flex-col gap-0.5 overflow-auto p-2 relative"
  >
    <template v-if="items.length">
      <button
        v-for="(item, index) in displayItems"
        :key="index"
        :class="{ 'bg-gray-200': index === selectedIndex, 'hover:bg-gray-300': true }"
        class="flex items-center gap-1 text-left w-full bg-transparent hover:bg-gray-300"
        @click="selectItem(index)"
      >
        <template v-if="isCategoryView">
          <span class="font-medium">{{ item }}</span>
        </template>
        <template v-else>
          <span>{{ item }}</span>
        </template>
      </button>
    </template>
    <div class="p-1 text-gray-500" v-else>No result</div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'

const props = defineProps({
  items: {
    type: Array,
    required: true
  },
  command: {
    type: Function,
    required: true
  },
  categorizedItems: {
    type: Object,
    default: () => ({})
  }
})

const selectedIndex = ref(0)
const currentCategory = ref(null)
const isCategoryView = computed(() => currentCategory.value === null)

// Compute items to display based on the current category
const displayItems = computed(() => {
  if (currentCategory.value === null) {
    // If in category view, return category names
    return Object.keys(props.categorizedItems)
  } else {
    // If in sub-item view, return items of the current category
    return props.categorizedItems[currentCategory.value] || []
  }
})

watch(
  () => props.items,
  () => {
    // Reset selection state when items change
    selectedIndex.value = 0
    currentCategory.value = null
  }
)

const upHandler = () => {
  selectedIndex.value =
    (selectedIndex.value + displayItems.value.length - 1) % displayItems.value.length
}

const downHandler = () => {
  selectedIndex.value = (selectedIndex.value + 1) % displayItems.value.length
}

const selectItem = (index) => {
  if (isCategoryView.value) {
    // If we're in category view, select the category
    const categoryName = displayItems.value[index]
    if (categoryName) {
      currentCategory.value = categoryName
      selectedIndex.value = 0
    }
  } else {
    // If we're in subitem view, select the item
    const item = displayItems.value[index]
    if (item) {
      props.command({ id: item, category: currentCategory.value })
    }
  }
}

const enterHandler = () => {
  selectItem(selectedIndex.value)
}

const backHandler = () => {
  if (!isCategoryView.value) {
    // Go back to category view
    currentCategory.value = null
    selectedIndex.value = 0
    return true
  }
  return false
}

const onKeyDown = ({ event }) => {
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
    return true
  }

  if (event.key === 'Escape' || event.key === 'Backspace') {
    return backHandler()
  }

  return false
}

defineExpose({
  onKeyDown
})
</script>

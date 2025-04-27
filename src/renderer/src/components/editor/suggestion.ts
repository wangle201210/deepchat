import { VueRenderer } from '@tiptap/vue-3'
import tippy from 'tippy.js'
import { ref } from 'vue'

import MentionList from './MentionList.vue'

// Define the type for categorized data
interface CategorizedData {
  [category: string]: string[]
}

// Sample categorized items
const categorizedData: CategorizedData = {
  resources: ['resource1', 'resource2'],
  files: ['file1']
}

// Create a ref to track mention selections
export const mentionSelected = ref(false)

export default {
  items: ({ query }) => {
    // If there's a query, search across all categories
    if (query) {
      const allItems: string[] = []
      // Flatten the structure and search in all categories
      Object.entries(categorizedData).forEach(([, items]) => {
        const matchedItems = items.filter((item) =>
          item.toLowerCase().includes(query.toLowerCase())
        )
        allItems.push(...matchedItems)
      })

      return allItems.slice(0, 5)
    }

    // If no query, return the categories
    return Object.keys(categorizedData)
  },

  render: () => {
    let component
    let popup

    return {
      onStart: (props) => {
        component = new VueRenderer(MentionList, {
          // using vue 2:
          // parent: this,
          // propsData: props,
          // using vue 3:
          props: {
            ...props,
            categorizedItems: categorizedData
          },
          editor: props.editor
        })

        if (!props.clientRect) {
          return
        }

        popup = tippy('body', {
          getReferenceClientRect: props.clientRect,
          appendTo: () => document.body,
          content: component.element,
          showOnCreate: true,
          interactive: true,
          trigger: 'manual',
          placement: 'bottom-start'
        })
      },

      onUpdate(props) {
        component.updateProps({
          ...props,
          categorizedItems: categorizedData
        })

        if (!props.clientRect) {
          return
        }

        popup[0].setProps({
          getReferenceClientRect: props.clientRect
        })
      },

      onKeyDown(props) {
        if (props.event.key === 'Escape') {
          popup[0].hide()

          return true
        }

        // If Enter is pressed on a mention item
        if (props.event.key === 'Enter') {
          mentionSelected.value = true
          // Reset after a short delay
          setTimeout(() => {
            mentionSelected.value = false
          }, 300)
        }

        return component.ref?.onKeyDown(props)
      },

      onExit() {
        popup[0].destroy()
        component.destroy()
      }
    }
  }
}

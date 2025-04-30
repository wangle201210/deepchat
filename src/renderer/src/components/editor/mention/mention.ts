import TipTMention from '@tiptap/extension-mention'

export const Mention = TipTMention.extend({
  addOptions() {
    return {
      ...this.parent?.()
    }
  },

  addAttributes() {
    return {
      ...this.parent?.(),

      type: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-type-mention'),
        renderHTML: (attributes) => {
          if (!attributes.type) {
            return {}
          }
          return {
            'data-type-mention': attributes.type
          }
        }
      },

      content: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-content'),
        renderHTML: (attributes) => {
          if (!attributes.content) {
            return {}
          }
          return {
            'data-content': attributes.content
          }
        }
      }
    }
  }
})

export class SearchHistory {
  private history: string[] = []
  private currentIndex: number = -1
  maxHistorySize: number = 100 // Limit the size of the history
  constructor(maxHistorySize = 100) {
    // Initialize with some default values if needed
    this.history = []
    this.currentIndex = 0
    this.maxHistorySize = maxHistorySize // Set a maximum size for the history
  }

  addSearch(query: string) {
    // 如果 history 已经满了，移除最旧的记录
    if (query && query !== this.history[this.history.length - 1]) {
      if (this.history.length >= this.maxHistorySize) {
        this.history.shift() // Remove the oldest search
      }
      this.history.push(query)
      this.currentIndex = this.history.length // Reset index to the end
    }
    console.log('Search history updated:', this.history)
  }

  getPrevious() {
    if (this.currentIndex > 0) {
      this.currentIndex--
      return this.history[this.currentIndex]
    }
    return null
  }

  getNext() {
    if (this.currentIndex < this.history.length - 1) {
      this.currentIndex++
      return this.history[this.currentIndex]
    }
    return null
  }
  // 将 currentIndex 重置为 history 的长度
  resetIndex() {
    this.currentIndex = this.history.length
  }
  clearHistory() {
    this.history.length = 0 // Clear the history array
    this.currentIndex = -1 // Reset index when clearing history
    console.log('Search history cleared')
  }
}

export const searchHistory = new SearchHistory(100) // Create a new instance with a maximum size of 100

import { eventBus } from '@/eventbus'
import { WINDOW_EVENTS } from '@/events'
import { is } from '@electron-toolkit/utils'
import { ITabPresenter, TabCreateOptions } from '@shared/presenter'
import { BrowserWindow, WebContentsView } from 'electron'
import { join } from 'path'

interface TabState {
  url: string
  title: string
  faviconUrl?: string
  isActive: boolean
}

export class TabPresenter implements ITabPresenter {
  // 全局标签页实例存储
  private tabs: Map<number, WebContentsView> = new Map()

  // 存储标签页状态
  private tabState: Map<number, TabState> = new Map()

  // 窗口ID到其包含的标签页ID列表的映射
  private windowTabs: Map<number, number[]> = new Map()

  // 标签页ID到其当前所属窗口ID的映射
  private tabWindowMap: Map<number, number> = new Map()

  constructor() {
    // this.setupIPCHandlers()
    this.initBusHandlers()
  }

  private initBusHandlers() {
    eventBus.on(WINDOW_EVENTS.WINDOW_RESIZE, (windowId: number) => {
      console.log('window resize', windowId)
      const views = this.windowTabs.get(windowId)
      const window = BrowserWindow.fromId(windowId)
      if (window) {
        views?.forEach((view) => {
          this.updateViewBounds(window, this.tabs.get(view)!)
        })
      }
    })

    eventBus.on(WINDOW_EVENTS.WINDOW_RESIZED, (windowId: number) => {
      console.log('window resize', windowId)
      const views = this.windowTabs.get(windowId)
      const window = BrowserWindow.fromId(windowId)
      if (window) {
        views?.forEach((view) => {
          this.updateViewBounds(window, this.tabs.get(view)!)
        })
      }
    })
  }

  /**
   * 创建新标签页并添加到指定窗口
   */
  async createTab(
    windowId: number,
    url: string,
    options: TabCreateOptions = {}
  ): Promise<number | null> {
    console.log('createTab', windowId, url, options)
    const window = BrowserWindow.fromId(windowId)
    if (!window) return null

    // 创建新的BrowserView
    const view = new WebContentsView({
      webPreferences: {
        preload: join(__dirname, '../preload/index.mjs'),
        sandbox: false,
        devTools: is.dev
      }
    })

    view.setBorderRadius(8)

    // 加载内容
    if (url.startsWith('local://')) {
      const viewType = url.replace('local://', '')
      if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
        view.webContents.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#/${viewType}`)
      } else {
        view.webContents.loadFile(join(__dirname, '../renderer/index.html'), {
          hash: `/${viewType}`
        })
      }
    } else {
      view.webContents.loadURL(url)
    }
    view.webContents.openDevTools()

    // 存储标签信息
    const tabId = view.webContents.id
    this.tabs.set(tabId, view)
    this.tabState.set(tabId, {
      url,
      title: url,
      isActive: options.active ?? true
    })

    // 更新窗口-标签映射
    if (!this.windowTabs.has(windowId)) {
      this.windowTabs.set(windowId, [])
    }

    const tabs = this.windowTabs.get(windowId)!
    const insertIndex = options.index !== undefined ? options.index : tabs.length
    tabs.splice(insertIndex, 0, tabId)

    this.tabWindowMap.set(tabId, windowId)

    // 添加到窗口
    this.attachViewToWindow(window, view)

    // 如果需要激活，设置为活动标签
    if (options.active ?? true) {
      this.activateTab(tabId)
    }

    // // 监听标签页相关事件
    // this.setupWebContentsListeners(view.webContents, tabId, windowId)

    // // 通知渲染进程更新标签列表
    // this.notifyWindowTabsUpdate(windowId)

    return tabId
  }

  /**
   * 销毁标签页
   */
  async closeTab(tabId: number): Promise<boolean> {
    return this.destroyTab(tabId)
  }

  /**
   * 激活标签页
   */
  async switchTab(tabId: number): Promise<boolean> {
    return this.activateTab(tabId)
  }

  /**
   * 获取标签页实例
   */
  async getTab(tabId: number): Promise<WebContentsView | undefined> {
    return this.tabs.get(tabId)
  }

  /**
   * 销毁标签页
   */
  destroyTab(tabId: number): boolean {
    const view = this.tabs.get(tabId)
    if (!view) return false

    const windowId = this.tabWindowMap.get(tabId)
    if (!windowId) return false

    const window = BrowserWindow.fromId(windowId)
    if (window) {
      // 从窗口中移除视图
      this.detachViewFromWindow(window, view)
    }

    // 移除事件监听
    this.removeWebContentsListeners(view.webContents)

    // 从数据结构中移除
    this.tabs.delete(tabId)
    this.tabState.delete(tabId)
    this.tabWindowMap.delete(tabId)

    if (this.windowTabs.has(windowId)) {
      const tabs = this.windowTabs.get(windowId)!
      const index = tabs.indexOf(tabId)
      if (index !== -1) {
        tabs.splice(index, 1)

        // 如果还有其他标签并且关闭的是活动标签，激活相邻标签
        if (tabs.length > 0) {
          const newActiveIndex = Math.min(index, tabs.length - 1)
          this.activateTab(tabs[newActiveIndex])
        }
      }

      // 通知渲染进程更新标签列表
      this.notifyWindowTabsUpdate(windowId)
    }

    // 销毁视图
    view.webContents.closeDevTools()
    return true
  }

  /**
   * 激活标签页
   */
  private activateTab(tabId: number): boolean {
    const view = this.tabs.get(tabId)
    if (!view) return false

    const windowId = this.tabWindowMap.get(tabId)
    if (!windowId) return false

    const window = BrowserWindow.fromId(windowId)
    if (!window) return false

    // 获取窗口中的所有标签
    const tabs = this.windowTabs.get(windowId) || []

    // 更新所有标签的活动状态
    for (const id of tabs) {
      const state = this.tabState.get(id)
      if (state) {
        state.isActive = id === tabId
      }
    }

    // 确保视图可见并位于最前
    this.bringViewToFront(window, view)

    // 通知渲染进程更新标签列表
    this.notifyWindowTabsUpdate(windowId)

    // 通知渲染进程切换活动标签
    window.webContents.send('setActiveTab', windowId, tabId)

    return true
  }

  /**
   * 从当前窗口分离标签页（不销毁）
   */
  async detachTab(tabId: number): Promise<boolean> {
    const view = this.tabs.get(tabId)
    if (!view) return false

    const windowId = this.tabWindowMap.get(tabId)
    if (!windowId) return false

    const window = BrowserWindow.fromId(windowId)
    if (window) {
      // 从窗口中移除视图
      this.detachViewFromWindow(window, view)
    }

    // 从窗口标签列表中移除
    if (this.windowTabs.has(windowId)) {
      const tabs = this.windowTabs.get(windowId)!
      const index = tabs.indexOf(tabId)
      if (index !== -1) {
        tabs.splice(index, 1)
      }

      // 通知渲染进程更新标签列表
      this.notifyWindowTabsUpdate(windowId)

      // 如果窗口还有其他标签，激活一个
      if (tabs.length > 0) {
        this.activateTab(tabs[Math.min(index, tabs.length - 1)])
      }
    }

    // 标记为已分离
    this.tabWindowMap.delete(tabId)

    return true
  }

  /**
   * 将标签页附加到目标窗口
   */
  async attachTab(tabId: number, targetWindowId: number, index?: number): Promise<boolean> {
    const view = this.tabs.get(tabId)
    if (!view) return false

    const window = BrowserWindow.fromId(targetWindowId)
    if (!window) return false

    // 确保目标窗口有标签列表
    if (!this.windowTabs.has(targetWindowId)) {
      this.windowTabs.set(targetWindowId, [])
    }

    // 添加到目标窗口的标签列表
    const tabs = this.windowTabs.get(targetWindowId)!
    const insertIndex = index !== undefined ? index : tabs.length
    tabs.splice(insertIndex, 0, tabId)

    // 更新标签所属窗口
    this.tabWindowMap.set(tabId, targetWindowId)

    // 将视图添加到窗口
    this.attachViewToWindow(window, view)

    // 激活标签
    this.activateTab(tabId)

    // 通知渲染进程更新标签列表
    this.notifyWindowTabsUpdate(targetWindowId)

    return true
  }

  /**
   * 将标签页从源窗口移动到目标窗口
   */
  async moveTab(tabId: number, targetWindowId: number, index?: number): Promise<boolean> {
    const windowId = this.tabWindowMap.get(tabId)

    // 如果已经在目标窗口中，仅调整位置
    if (windowId === targetWindowId) {
      if (index !== undefined && this.windowTabs.has(windowId)) {
        const tabs = this.windowTabs.get(windowId)!
        const currentIndex = tabs.indexOf(tabId)
        if (currentIndex !== -1 && currentIndex !== index) {
          // 移除当前位置
          tabs.splice(currentIndex, 1)

          // 计算新的插入位置（考虑到移除元素后的索引变化）
          const newIndex = index > currentIndex ? index - 1 : index

          // 插入到新位置
          tabs.splice(newIndex, 0, tabId)

          // 通知渲染进程更新标签列表
          this.notifyWindowTabsUpdate(windowId)
          return true
        }
      }
      return false
    }

    // 从源窗口分离
    const detached = this.detachTab(tabId)
    if (!detached) return false

    // 附加到目标窗口
    return this.attachTab(tabId, targetWindowId, index)
  }

  /**
   * 获取窗口的所有标签数据
   */
  async getWindowTabsData(
    windowId: number
  ): Promise<Array<{ id: number; title: string; faviconUrl?: string; isActive: boolean }>> {
    const tabs = this.windowTabs.get(windowId) || []
    return tabs.map((tabId) => {
      const state = this.tabState.get(tabId) || { url: '', title: '', isActive: false }
      return {
        id: tabId,
        title: state.title,
        faviconUrl: state.faviconUrl,
        isActive: state.isActive
      }
    })
  }

  /**
   * 通知渲染进程更新标签列表
   */
  notifyWindowTabsUpdate(windowId: number): void {
    const window = BrowserWindow.fromId(windowId)
    if (!window) return

    const tabListData = this.getWindowTabsData(windowId)
    console.log('----------------->notifyWindowTabsUpdate', windowId, tabListData)
    // window.webContents.send('updateWindowTabs', windowId, tabListData)
  }

  /**
   * 为WebContents设置事件监听
   */
  private setupWebContentsListeners(
    webContents: Electron.WebContents,
    tabId: number,
    windowId: number
  ): void {
    // 标题变更
    webContents.on('page-title-updated', (_event, title) => {
      const state = this.tabState.get(tabId)
      if (state) {
        state.title = title
        this.notifyWindowTabsUpdate(windowId)
      }
    })

    // Favicon变更
    webContents.on('page-favicon-updated', (_event, favicons) => {
      if (favicons.length > 0) {
        const state = this.tabState.get(tabId)
        if (state) {
          state.faviconUrl = favicons[0]
          this.notifyWindowTabsUpdate(windowId)
        }
      }
    })

    // 导航完成
    webContents.on('did-navigate', (_event, url) => {
      const state = this.tabState.get(tabId)
      if (state) {
        state.url = url
      }
    })
  }

  /**
   * 移除WebContents的事件监听
   */
  private removeWebContentsListeners(webContents: Electron.WebContents): void {
    webContents.removeAllListeners('page-title-updated')
    webContents.removeAllListeners('page-favicon-updated')
    webContents.removeAllListeners('did-navigate')
  }

  /**
   * 将视图添加到窗口
   * 注意：实际实现可能需要根据Electron窗口布局策略调整
   */
  private attachViewToWindow(window: BrowserWindow, view: WebContentsView): void {
    // 这里需要根据实际窗口结构实现
    // 简单实现可能是：
    window.contentView.addChildView(view)
    this.updateViewBounds(window, view)
  }

  /**
   * 从窗口中分离视图
   */
  private detachViewFromWindow(window: BrowserWindow, view: WebContentsView): void {
    // 这里需要根据实际窗口结构实现
    window.contentView.removeChildView(view)
  }

  /**
   * 将视图带到前面（激活）
   */
  private bringViewToFront(window: BrowserWindow, view: WebContentsView): void {
    // 这里需要根据实际窗口结构实现
    window.contentView.addChildView(view)

    this.updateViewBounds(window, view)
  }

  /**
   * 更新视图大小以适应窗口
   */
  private updateViewBounds(window: BrowserWindow, view: WebContentsView): void {
    // 获取窗口尺寸
    const { width, height } = window.getContentBounds()

    // 设置视图位置大小（留出顶部标签栏空间）
    const TAB_BAR_HEIGHT = 40 // 标签栏高度，需要根据实际UI调整
    view.setBounds({
      x: 4,
      y: TAB_BAR_HEIGHT,
      width: width - 8,
      height: height - TAB_BAR_HEIGHT - 4
    })
  }

  public destroy() {
    // Iterate over the map containing tab views or windows
    for (const [tabId] of this.tabWindowMap.entries()) {
      // TODO: Implement cleanup logic for each entry
      // This might involve destroying WebContentsView, removing listeners, etc.
      console.log(`Destroying resources for tab: ${tabId}`)
      this.closeTab(tabId)
    }
    // Clear the map after processing all entries

    this.tabWindowMap.clear()
    this.tabs.clear()
    this.tabState.clear()
    this.windowTabs.clear()
  }
}

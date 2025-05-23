/* eslint-disable @typescript-eslint/no-explicit-any */
import { eventBus } from '@/eventbus'
import { WINDOW_EVENTS, CONFIG_EVENTS, SYSTEM_EVENTS, TAB_EVENTS } from '@/events'
import { is } from '@electron-toolkit/utils'
import { ITabPresenter, TabCreateOptions, IWindowPresenter, TabData } from '@shared/presenter'
import { BrowserWindow, WebContentsView, shell, nativeImage } from 'electron'
import { join } from 'path'
import contextMenu from '@/contextMenuHelper'
import { getContextMenuLabels } from '@shared/i18n'
import { app } from 'electron'
import { addWatermarkToNativeImage } from '@/lib/watermark'
import { stitchImagesVertically } from '@/lib/scrollCapture'

export class TabPresenter implements ITabPresenter {
  // 全局标签页实例存储
  private tabs: Map<number, WebContentsView> = new Map()

  // 存储标签页状态
  private tabState: Map<number, TabData> = new Map()

  // 窗口ID到其包含的标签页ID列表的映射
  private windowTabs: Map<number, number[]> = new Map()

  // 标签页ID到其当前所属窗口ID的映射
  private tabWindowMap: Map<number, number> = new Map()

  // 存储每个标签页的右键菜单处理器
  private tabContextMenuDisposers: Map<number, () => void> = new Map()

  private windowPresenter: IWindowPresenter // Store windowPresenter instance

  constructor(windowPresenter: IWindowPresenter) {
    this.windowPresenter = windowPresenter // Assign injected windowPresenter
    this.initBusHandlers()
  }

  private initBusHandlers() {
    eventBus.on(WINDOW_EVENTS.WINDOW_RESIZE, (windowId: number) => {
      const views = this.windowTabs.get(windowId)
      const window = BrowserWindow.fromId(windowId)
      if (window) {
        views?.forEach((view) => {
          this.updateViewBounds(window, this.tabs.get(view)!)
        })
      }
    })

    eventBus.on(WINDOW_EVENTS.WINDOW_CLOSED, (windowId: number) => {
      const views = this.windowTabs.get(windowId)
      const window = BrowserWindow.fromId(windowId)
      if (window) {
        views?.forEach((viewId) => {
          const view = this.tabs.get(viewId)
          if (view) {
            this.detachViewFromWindow(window, view)
          }
        })
      }
    })

    // 添加语言设置改变的事件处理
    eventBus.on(CONFIG_EVENTS.SETTING_CHANGED, async (key) => {
      if (key === 'language') {
        // 为所有活动的标签页更新右键菜单
        for (const [tabId] of this.tabWindowMap.entries()) {
          await this.setupTabContextMenu(tabId)
        }
      }
    })

    // 添加系统主题更新的事件处理
    eventBus.on(SYSTEM_EVENTS.SYSTEM_THEME_UPDATED, (isDark: boolean) => {
      // 向所有标签页广播主题更新
      for (const [, view] of this.tabs.entries()) {
        if (!view.webContents.isDestroyed()) {
          view.webContents.send('system-theme-updated', isDark)
        }
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
    view.setBackgroundColor('#00ffffff')

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
    if (is.dev) {
      view.webContents.openDevTools({ mode: 'detach' })
    }

    // 存储标签信息
    const tabId = view.webContents.id
    this.tabs.set(tabId, view)
    this.tabState.set(tabId, {
      id: tabId,
      title: url,
      isActive: options.active ?? true,
      url: url,
      closable: true,
      position: options?.position ?? 0
    })

    // 更新窗口-标签映射
    if (!this.windowTabs.has(windowId)) {
      this.windowTabs.set(windowId, [])
    }

    const tabs = this.windowTabs.get(windowId)!
    const insertIndex = options.position !== undefined ? options.position : tabs.length
    tabs.splice(insertIndex, 0, tabId)

    this.tabWindowMap.set(tabId, windowId)

    // 添加到窗口
    this.attachViewToWindow(window, view)

    // 如果需要激活，设置为活动标签
    if (options.active ?? true) {
      this.activateTab(tabId)
    }

    // 在创建标签页后设置右键菜单
    await this.setupTabContextMenu(tabId)

    // // 监听标签页相关事件
    this.setupWebContentsListeners(view.webContents, tabId, windowId)

    // // 通知渲染进程更新标签列表
    this.notifyWindowTabsUpdate(windowId)

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
    // 清理右键菜单
    this.cleanupTabContextMenu(tabId)

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

    // 更新所有标签的活动状态并处理视图显示/隐藏
    for (const id of tabs) {
      const state = this.tabState.get(id)
      const tabView = this.tabs.get(id)
      if (state && tabView) {
        state.isActive = id === tabId
        // 根据活动状态设置视图的可见性
        tabView.setVisible(id === tabId)
      }
    }

    // 确保活动视图可见并位于最前
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
  async getWindowTabsData(windowId: number): Promise<TabData[]> {
    const tabsInWindow = this.windowTabs.get(windowId) || []
    return tabsInWindow.map((tabId) => {
      const state = this.tabState.get(tabId) || ({} as TabData)
      return state
    })
  }

  /**
   * 通知渲染进程更新标签列表
   */
  notifyWindowTabsUpdate(windowId: number): void {
    const window = BrowserWindow.fromId(windowId)
    if (!window || window.isDestroyed()) return

    this.getWindowTabsData(windowId).then((tabListData) => {
      if (!window.isDestroyed() && window.webContents && !window.webContents.isDestroyed()) {
        window.webContents.send('update-window-tabs', windowId, tabListData)
      }
    })
  }

  /**
   * 为WebContents设置事件监听
   */
  private setupWebContentsListeners(
    webContents: Electron.WebContents,
    tabId: number,
    windowId: number
  ): void {
    // 处理外部链接
    webContents.setWindowOpenHandler(({ url }) => {
      // 使用系统默认浏览器打开链接
      shell.openExternal(url)
      return { action: 'deny' }
    })

    // 标题变更
    webContents.on('page-title-updated', (_event, title) => {
      const state = this.tabState.get(tabId)
      if (state) {
        state.title = title || state.url || 'Untitled'
        // 通知渲染进程标题已更新
        const window = BrowserWindow.fromId(windowId)
        if (window && !window.isDestroyed()) {
          window.webContents.send(TAB_EVENTS.TITLE_UPDATED, {
            tabId,
            title: state.title,
            windowId
          })
        }
        this.notifyWindowTabsUpdate(windowId)
      }
    })

    // 检查是否是窗口的第一个标签页
    const isFirstTab = this.windowTabs.get(windowId)?.length === 1

    // 页面加载完成
    if (isFirstTab) {
      eventBus.emit(WINDOW_EVENTS.READY_TO_SHOW)
      webContents.once('did-finish-load', () => {
        eventBus.emit(WINDOW_EVENTS.FIRST_CONTENT_LOADED, windowId)
      })
    }

    // Favicon变更
    webContents.on('page-favicon-updated', (_event, favicons) => {
      if (favicons.length > 0) {
        const state = this.tabState.get(tabId)
        if (state) {
          if (state.icon !== favicons[0]) {
            console.log('page-favicon-updated', state.icon, favicons[0])
            state.icon = favicons[0]
            this.notifyWindowTabsUpdate(windowId)
          }
        }
      }
    })

    // 导航完成
    webContents.on('did-navigate', (_event, url) => {
      const state = this.tabState.get(tabId)
      if (state) {
        state.url = url
        // 如果没有标题，使用URL作为标题
        if (!state.title || state.title === 'Untitled') {
          state.title = url
          const window = BrowserWindow.fromId(windowId)
          if (window && !window.isDestroyed()) {
            window.webContents.send(TAB_EVENTS.TITLE_UPDATED, {
              tabId,
              title: state.title,
              windowId
            })
          }
          this.notifyWindowTabsUpdate(windowId)
        }
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
    webContents.removeAllListeners('did-finish-load')
    webContents.setWindowOpenHandler(() => ({ action: 'allow' }))
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

  /**
   * 为标签页设置右键菜单
   */
  private async setupTabContextMenu(tabId: number): Promise<void> {
    const view = this.tabs.get(tabId)
    if (!view || view.webContents.isDestroyed()) return

    // 如果已存在处理器，先清理
    if (this.tabContextMenuDisposers.has(tabId)) {
      this.tabContextMenuDisposers.get(tabId)?.()
      this.tabContextMenuDisposers.delete(tabId)
    }

    const lang = app.getLocale()
    const labels = await getContextMenuLabels(lang)

    const disposer = contextMenu({
      webContents: view.webContents,
      labels,
      shouldShowMenu() {
        return true
      }
    })

    this.tabContextMenuDisposers.set(tabId, disposer)
  }

  /**
   * 清理标签页的右键菜单
   */
  private cleanupTabContextMenu(tabId: number): void {
    if (this.tabContextMenuDisposers.has(tabId)) {
      this.tabContextMenuDisposers.get(tabId)?.()
      this.tabContextMenuDisposers.delete(tabId)
    }
  }

  public destroy() {
    // 清理所有标签页的右键菜单
    for (const [tabId] of this.tabContextMenuDisposers) {
      this.cleanupTabContextMenu(tabId)
    }
    this.tabContextMenuDisposers.clear()

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

  async moveTabToNewWindow(tabId: number, screenX?: number, screenY?: number): Promise<boolean> {
    const tabInfo = this.tabState.get(tabId)
    const originalWindowId = this.tabWindowMap.get(tabId)

    if (!tabInfo || originalWindowId === undefined) {
      console.error(`moveTabToNewWindow: Tab ${tabId} not found or no window associated.`)
      return false
    }

    // 1. Detach the tab from its current window
    const detached = await this.detachTab(tabId)
    if (!detached) {
      console.error(
        `moveTabToNewWindow: Failed to detach tab ${tabId} from window ${originalWindowId}.`
      )
      // Attempt to reattach to original window if detachment fails
      // await this.attachTab(tabId, originalWindowId) // Consider if this is the desired fallback
      return false
    }

    // 2. Create a new window with position and options.
    const newWindowOptions: Record<string, any> = {
      // Consider defining a proper type for these options
      forMovedTab: true,
      activateTabId: tabId
    }
    if (screenX !== undefined && screenY !== undefined) {
      newWindowOptions.x = screenX
      newWindowOptions.y = screenY
    }

    const newWindowId = await this.windowPresenter.createShellWindow(newWindowOptions)

    if (newWindowId === null) {
      console.error('moveTabToNewWindow: Failed to create a new window.')
      // Attempt to reattach to original window if new window creation fails
      await this.attachTab(tabId, originalWindowId)
      return false
    }

    // 3. Attach the tab (WebContentsView) to the new window
    const attached = await this.attachTab(tabId, newWindowId)
    if (!attached) {
      console.error(
        `moveTabToNewWindow: Failed to attach tab ${tabId} to new window ${newWindowId}.`
      )
      // If attaching fails, we might need to destroy the newly created window or reattach to original.
      // Consider closing the new empty window:
      // if (newBrowserWindow) newBrowserWindow.close();
      // else this.windowPresenter.close(newWindowId); // Fallback if newBrowserWindow is null
      // And then reattach to original
      // await this.attachTab(tabId, originalWindowId);
      return false
    }

    console.log(`Tab ${tabId} moved from window ${originalWindowId} to new window ${newWindowId}`)
    this.notifyWindowTabsUpdate(originalWindowId) // Notify original window
    this.notifyWindowTabsUpdate(newWindowId) // Notify new window
    return true
  }

  /**
   * 截取标签页指定区域的简单截图
   * @param tabId 标签页ID
   * @param rect 截图区域
   * @returns 返回base64格式的图片数据，失败时返回null
   */
  async captureTabArea(
    tabId: number,
    rect: { x: number; y: number; width: number; height: number }
  ): Promise<string | null> {
    try {
      const view = this.tabs.get(tabId)
      if (!view || view.webContents.isDestroyed()) {
        console.error(`captureTabArea: Tab ${tabId} not found or destroyed`)
        return null
      }

      // 使用Electron的capturePage API进行截图
      const image = await view.webContents.capturePage(rect)

      if (image.isEmpty()) {
        console.error('captureTabArea: Captured image is empty')
        return null
      }

      // 转换为base64格式
      const base64Data = image.toDataURL()
      return base64Data
    } catch (error) {
      console.error('captureTabArea error:', error)
      return null
    }
  }

  /**
   * 将多张截图拼接成长图并添加水印
   * @param imageDataList base64格式的图片数据数组
   * @param options 水印选项
   * @returns 返回拼接并添加水印后的base64图片数据，失败时返回null
   */
  async stitchImagesWithWatermark(
    imageDataList: string[],
    options: {
      isDark?: boolean
      version?: string
      texts?: {
        brand?: string
        time?: string
        tip?: string
        model?: string
        provider?: string
      }
    } = {}
  ): Promise<string | null> {
    try {
      if (imageDataList.length === 0) {
        console.error('stitchImagesWithWatermark: No images provided')
        return null
      }

      // 如果只有一张图片，直接添加水印
      if (imageDataList.length === 1) {
        const nativeImageInstance = nativeImage.createFromDataURL(imageDataList[0])
        const watermarkedImage = await addWatermarkToNativeImage(nativeImageInstance, options)
        return watermarkedImage.toDataURL()
      }

      // 将base64图片转换为NativeImage，然后转换为Buffer
      const imageBuffers = imageDataList.map((data) => {
        const image = nativeImage.createFromDataURL(data)
        return image.toPNG()
      })

      // 拼接图片
      const stitchedImage = await stitchImagesVertically(imageBuffers)

      // 添加水印
      const watermarkedImage = await addWatermarkToNativeImage(stitchedImage, options)

      // 转换为base64格式
      const base64Data = watermarkedImage.toDataURL()

      console.log(`Successfully stitched ${imageDataList.length} images with watermark`)
      return base64Data
    } catch (error) {
      console.error('stitchImagesWithWatermark error:', error)
      return null
    }
  }
}

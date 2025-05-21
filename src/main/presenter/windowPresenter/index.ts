import { BrowserWindow, shell, app, nativeImage, ipcMain } from 'electron'
import { join } from 'path'
import icon from '../../../../resources/icon.png?asset'
import iconWin from '../../../../resources/icon.ico?asset'
import { is } from '@electron-toolkit/utils'
import { IWindowPresenter } from '@shared/presenter'
import { eventBus } from '@/eventbus'
import { ConfigPresenter } from '../configPresenter'
import { TrayPresenter } from '../trayPresenter'
import { CONFIG_EVENTS, SYSTEM_EVENTS, WINDOW_EVENTS } from '@/events'
import { presenter } from '../'
import windowStateManager from 'electron-window-state'
import { SHORTCUT_EVENTS } from '@/events'

export class WindowPresenter implements IWindowPresenter {
  windows: Map<number, BrowserWindow>
  private configPresenter: ConfigPresenter
  private isQuitting: boolean = false
  private trayPresenter: TrayPresenter | null = null
  private focusedWindowId: number | null = null

  constructor(configPresenter: ConfigPresenter) {
    this.windows = new Map()
    this.configPresenter = configPresenter

    // 添加IPC处理函数来返回窗口ID和WebContents ID
    ipcMain.on('get-window-id', (event) => {
      const window = BrowserWindow.fromWebContents(event.sender)
      event.returnValue = window ? window.id : null
    })

    ipcMain.on('get-web-contents-id', (event) => {
      event.returnValue = event.sender.id
    })

    // 监听应用退出事件
    app.on('before-quit', () => {
      console.log('before-quit')
      this.isQuitting = true
      if (this.trayPresenter) {
        this.trayPresenter.destroy()
      }
    })

    // 监听快捷键事件
    eventBus.on(SHORTCUT_EVENTS.CREATE_NEW_WINDOW, () => {
      this.createShellWindow({
        initialTab: {
          url: 'local://chat'
        }
      })
    })

    eventBus.on(SHORTCUT_EVENTS.CREATE_NEW_TAB, async (windowId: number) => {
      await presenter.tabPresenter.createTab(windowId, 'local://chat', { active: true })
    })

    eventBus.on(SHORTCUT_EVENTS.CLOSE_CURRENT_TAB, async (windowId: number) => {
      const tabsData = await presenter.tabPresenter.getWindowTabsData(windowId)
      const activeTab = tabsData.find((tab) => tab.isActive)

      if (activeTab) {
        if (tabsData.length === 1) {
          // 如果是最后一个标签页
          const windows = this.getAllWindows()
          if (windows.length === 1) {
            // 如果是最后一个窗口，隐藏窗口而不是关闭
            this.hide(windowId)
          } else {
            // 如果不是最后一个窗口，直接关闭窗口
            this.closeWindow(windowId, true)
          }
        } else {
          // 如果不是最后一个标签页，直接关闭标签页
          await presenter.tabPresenter.closeTab(activeTab.id)
        }
      }
    })

    eventBus.on(SYSTEM_EVENTS.SYSTEM_THEME_UPDATED, (isDark: boolean) => {
      // 广播主题更新到所有窗口
      this.windows.forEach((window) => {
        window.webContents.send('system-theme-updated', isDark)
      })
    })

    // 监听强制退出事件
    eventBus.on(WINDOW_EVENTS.FORCE_QUIT_APP, () => {
      this.isQuitting = true
      if (this.trayPresenter) {
        this.trayPresenter.destroy()
      }
    })

    // 监听内容保护设置变化
    eventBus.on(CONFIG_EVENTS.CONTENT_PROTECTION_CHANGED, (enabled: boolean) => {
      // 更新所有窗口的内容保护设置
      this.windows.forEach((window) => {
        this.updateContentProtection(window, enabled)
      })
      console.log('Content protection setting changed to:', enabled, 'Restarting app...')
      setTimeout(() => {
        presenter.devicePresenter.restartApp()
      }, 1000)
    })
  }

  // 实现 IWindowPresenter 接口的方法
  // createMainWindow(): BrowserWindow {
  //   return this.createShellWindow() // This will be adapted or removed as createShellWindow changes
  // }

  getWindow(windowName: string): BrowserWindow | undefined {
    // 为了向后兼容，我们仍然支持通过字符串名称获取窗口
    // 但我们现在使用数字ID作为主要标识符
    const windowId = parseInt(windowName, 10)
    return isNaN(windowId) ? undefined : this.windows.get(windowId)
  }

  get mainWindow(): BrowserWindow | undefined {
    // 返回当前聚焦的窗口，如果没有聚焦的窗口则返回第一个窗口
    return this.getFocusedWindow() || this.getAllWindows()[0]
  }

  previewFile(filePath: string): void {
    const window = this.mainWindow
    if (window) {
      if (process.platform === 'darwin') {
        window.previewFile(filePath)
      } else {
        shell.openPath(filePath)
      }
    }
  }

  minimize(windowId: number): void {
    const window = this.windows.get(windowId)
    if (window) {
      window.minimize()
    }
  }

  maximize(windowId: number): void {
    const window = this.windows.get(windowId)
    if (window) {
      if (window.isMaximized()) {
        window.unmaximize()
      } else {
        window.maximize()
      }
    }
  }

  close(windowId: number): void {
    this.closeWindow(windowId, true)
  }

  hide(windowId: number): void {
    const window = this.windows.get(windowId)
    if (window) {
      window.hide()
    }
  }

  show(windowId?: number): void {
    if (windowId === undefined) {
      const windows = this.getAllWindows()
      if (windows.length > 0) {
        windows[windows.length - 1].show()
      }
    } else {
      const window = this.windows.get(windowId)
      if (window) {
        window.show()
      }
    }
  }

  isMaximized(windowId: number): boolean {
    const window = this.windows.get(windowId)
    return window ? window.isMaximized() : false
  }

  isMainWindowFocused(windowId: number): boolean {
    return this.focusedWindowId === windowId
  }

  /**
   * 向所有窗口发送消息
   * @param channel 消息通道
   * @param args 消息参数
   */
  async sendToAllWindows(channel: string, ...args: unknown[]): Promise<void> {
    for (const window of this.windows.values()) {
      if (!window.isDestroyed()) {
        // 发送到主窗口
        window.webContents.send(channel, ...args)

        // 获取该窗口的所有标签页
        const tabIds = await presenter.tabPresenter.getWindowTabsData(window.id)
        if (tabIds && tabIds.length > 0) {
          // 向每个标签页发送消息
          for (const tabData of tabIds) {
            const tab = await presenter.tabPresenter.getTab(tabData.id)
            if (tab && !tab.webContents.isDestroyed()) {
              tab.webContents.send(channel, ...args)
            }
          }
        }
      }
    }
  }

  /**
   * 向指定窗口发送消息
   * @param windowId 窗口ID
   * @param channel 消息通道
   * @param args 消息参数
   * @returns 是否发送成功
   */
  sendToWindow(windowId: number, channel: string, ...args: unknown[]): boolean {
    const window = this.windows.get(windowId)
    if (window && !window.isDestroyed()) {
      // 发送到主窗口
      window.webContents.send(channel, ...args)

      // 获取该窗口的所有标签页并异步发送消息
      presenter.tabPresenter.getWindowTabsData(windowId).then((tabIds) => {
        if (tabIds && tabIds.length > 0) {
          // 向每个标签页发送消息
          tabIds.forEach(async (tabData) => {
            const tab = await presenter.tabPresenter.getTab(tabData.id)
            if (tab && !tab.webContents.isDestroyed()) {
              tab.webContents.send(channel, ...args)
            }
          })
        }
      })
      return true
    }
    return false
  }

  // 新增的多窗口支持方法
  async createShellWindow(options?: {
    activateTabId?: number
    initialTab?: {
      url: string
      icon?: string
    }
    x?: number
    y?: number
  }): Promise<number | null> {
    const iconFile = nativeImage.createFromPath(process.platform === 'win32' ? iconWin : icon)
    const shellWindowState = windowStateManager({
      defaultWidth: 800,
      defaultHeight: 620
    })
    const shellWindow = new BrowserWindow({
      width: shellWindowState.width,
      height: shellWindowState.height,
      x: options?.x ? options.x : shellWindowState.x,
      y: options?.y ? Math.max(0, options.y) : Math.max(0, shellWindowState.y),
      show: false,
      autoHideMenuBar: true,
      icon: iconFile,
      titleBarStyle: 'hiddenInset',
      transparent: process.platform === 'darwin',
      vibrancy: process.platform === 'darwin' ? 'window' : undefined,
      backgroundColor: '#00000000',
      maximizable: true,
      frame: process.platform === 'darwin',
      hasShadow: true,
      trafficLightPosition: {
        x: 12,
        y: 12
      },
      webPreferences: {
        preload: join(__dirname, '../preload/index.mjs'), // Adjusted preload path
        sandbox: false,
        devTools: is.dev
      },
      roundedCorners: true
    })

    if (!shellWindow) {
      console.error('Failed to create shell window.')
      return null
    }

    const windowId = shellWindow.id
    this.windows.set(windowId, shellWindow)

    shellWindowState.manage(shellWindow)

    // 获取内容保护设置的值
    const contentProtectionEnabled = this.configPresenter.getContentProtectionEnabled()
    // 更新内容保护设置
    this.updateContentProtection(shellWindow, contentProtectionEnabled)

    shellWindow.on('ready-to-show', () => {
      shellWindow.show()
      eventBus.emit(WINDOW_EVENTS.WINDOW_CREATED, windowId)
    })

    shellWindow.on('focus', () => {
      this.focusedWindowId = windowId
      eventBus.emit(WINDOW_EVENTS.WINDOW_FOCUSED, windowId)
      // 向渲染进程发送窗口聚焦事件
      shellWindow.webContents.send('window-focused', windowId)
    })

    shellWindow.on('blur', () => {
      if (this.focusedWindowId === windowId) {
        this.focusedWindowId = null
      }
      eventBus.emit(WINDOW_EVENTS.WINDOW_BLURRED, windowId)
      // 向渲染进程发送窗口失焦事件
      shellWindow.webContents.send('window-blurred', windowId)
    })

    shellWindow.on('maximize', () => {
      shellWindow.webContents.send('window:maximized')
      eventBus.emit(WINDOW_EVENTS.WINDOW_MAXIMIZED, windowId)
    })

    shellWindow.on('unmaximize', () => {
      shellWindow.webContents.send('window:unmaximized')
      eventBus.emit(WINDOW_EVENTS.WINDOW_UNMAXIMIZED, windowId)
    })

    shellWindow.on('enter-full-screen', () => {
      shellWindow.webContents.send('window-fullscreened')
      eventBus.emit(WINDOW_EVENTS.WINDOW_ENTER_FULL_SCREEN, windowId)
    })

    shellWindow.on('leave-full-screen', () => {
      shellWindow.webContents.send('window-unfullscreened')
      eventBus.emit(WINDOW_EVENTS.WINDOW_LEAVE_FULL_SCREEN, windowId)
    })

    shellWindow.on('resize', () => {
      eventBus.emit(WINDOW_EVENTS.WINDOW_RESIZE, windowId)
    })

    shellWindow.on('close', (event) => {
      if (!this.isQuitting) {
        if (this.windows.size > 1 || this.configPresenter.getSetting('minimizeToTray')) {
          event.preventDefault()
          shellWindow.hide()
          // if (this.trayPresenter) {
          //   this.trayPresenter.show()
          // }
        } else {
          if (!this.configPresenter.getCloseToQuit()) {
            event.preventDefault()
            shellWindow.hide()
          }
        }
      }
    })

    shellWindow.on('closed', () => {
      this.windows.delete(windowId)
      shellWindowState.unmanage()
      eventBus.emit(WINDOW_EVENTS.WINDOW_CLOSED, windowId)
      if (this.windows.size === 0 && process.platform !== 'darwin') {
        if (!this.isQuitting) {
          // If not quitting and no windows left (and not on macOS), quit the app
          // This case might be hit if closeToQuit is true and last window is closed
          // app.quit()
        }
      }
    })

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      shellWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + '/shell/index.html')
    } else {
      // 参考 tabPresenter.ts 中的方法，使用 __dirname
      // 注意：在打包环境中，__dirname 指向 /app.asar/main 目录
      shellWindow.loadFile(join(__dirname, '../renderer/shell/index.html'))
    }

    if (is.dev) {
      shellWindow.webContents.openDevTools()
    }

    // Handle initial tab creation if options are provided
    if (options?.initialTab) {
      // Wait for the window to be ready before creating a tab
      shellWindow.webContents.once('did-finish-load', async () => {
        shellWindow.focus()
        try {
          const tabId = await presenter.tabPresenter.createTab(windowId, options.initialTab!.url, {
            active: true
            // Potentially pass viewType and icon if createTab supports them directly
            // or if tabPresenter needs them to set initial state.
          })
          if (tabId === null) {
            console.error('Failed to create initial tab in new window', windowId)
          }
        } catch (error) {
          console.error('Error creating initial tab:', error)
        }
      })
    }

    // If an activateTabId is provided, it implies a tab (WebContentsView)
    // is already created and will be attached by tabPresenter.moveTabToNewWindow
    // The activation logic (setVisible, bringToFront) is handled in tabPresenter.attachTab / activateTab.

    return windowId
  }

  /**
   * 关闭窗口的内部辅助函数，增加了强制关闭的选项
   * @param windowId 窗口ID
   * @param forceClose 是否强制关闭，默认为 false
   */
  async closeWindow(windowId: number, forceClose: boolean = false): Promise<void> {
    const window = this.windows.get(windowId)
    if (window) {
      if (forceClose) {
        this.isQuitting = true // Mark as quitting to bypass some close handlers
      }

      // 先关闭所有相关的标签页
      try {
        const tabsData = await presenter.tabPresenter.getWindowTabsData(windowId)
        for (const tab of tabsData) {
          await presenter.tabPresenter.closeTab(tab.id)
        }
      } catch (error) {
        console.error('Error closing tabs for window:', windowId, error)
      }

      window.close() // Triggers 'close' event on the window
      if (forceClose && !window.isDestroyed()) {
        // If forceClose is true and window didn't destroy (e.g. prevented by 'close' handler),
        // explicitly destroy it.
        window.destroy()
      }
      // Reset isQuitting if it was set just for this forced close, unless app is actually quitting.
      if (forceClose && !this.isQuitting) {
        this.isQuitting = false
      }
    }
  }

  private updateContentProtection(window: BrowserWindow, enabled: boolean): void {
    console.log('更新窗口内容保护状态:', enabled)
    if (enabled) {
      window.setContentProtection(enabled)
      window.webContents.setBackgroundThrottling(!enabled)
      window.webContents.setFrameRate(60)
      window.setBackgroundColor('#00000000')
      if (process.platform === 'darwin') {
        window.setHiddenInMissionControl(enabled)
        window.setSkipTaskbar(enabled)
      }
    }
  }

  getFocusedWindow(): BrowserWindow | undefined {
    return this.focusedWindowId ? this.windows.get(this.focusedWindowId) : undefined
  }

  getAllWindows(): BrowserWindow[] {
    return Array.from(this.windows.values())
  }

  /**
   * 获取指定窗口的当前激活标签页 ID
   * @param windowId 窗口 ID
   * @returns 当前激活的标签页 ID，如果没有则返回 undefined
   */
  async getActiveTabId(windowId: number): Promise<number | undefined> {
    const tabsData = await presenter.tabPresenter.getWindowTabsData(windowId)
    const activeTab = tabsData.find((tab) => tab.isActive)
    return activeTab?.id
  }

  /**
   * 向指定窗口的当前激活标签页发送事件
   * @param windowId 窗口 ID
   * @param channel 事件通道
   * @param args 事件参数
   * @returns 是否发送成功
   */
  async sendToActiveTab(windowId: number, channel: string, ...args: unknown[]): Promise<boolean> {
    const activeTabId = await this.getActiveTabId(windowId)
    if (activeTabId) {
      const tab = await presenter.tabPresenter.getTab(activeTabId)
      if (tab && !tab.webContents.isDestroyed()) {
        tab.webContents.send(channel, ...args)
        return true
      }
    }
    return false
  }
}

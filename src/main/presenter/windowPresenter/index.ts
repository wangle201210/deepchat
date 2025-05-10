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
import contextMenu from '../../contextMenuHelper'
import { getContextMenuLabels } from '@shared/i18n'
import { presenter } from '../'

export class WindowPresenter implements IWindowPresenter {
  windows: Map<number, BrowserWindow>
  private configPresenter: ConfigPresenter
  private isQuitting: boolean = false
  private trayPresenter: TrayPresenter | null = null
  private contextMenuDisposer?: () => void
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

    eventBus.on(CONFIG_EVENTS.SETTING_CHANGED, (key, value) => {
      if (key === 'language') {
        this.resetContextMenu(value as string)
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
  createMainWindow(): BrowserWindow {
    return this.createShellWindow()
  }

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
    const window = this.windows.get(windowId)
    if (window) {
      window.close()
    }
  }

  hide(windowId: number): void {
    const window = this.windows.get(windowId)
    if (window) {
      window.hide()
    }
  }

  show(windowId: number): void {
    const window = this.windows.get(windowId)
    if (window) {
      window.show()
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
  createShellWindow(): BrowserWindow {
    const iconFile = nativeImage.createFromPath(process.platform === 'win32' ? iconWin : icon)
    const shellWindow = new BrowserWindow({
      width: 1024,
      height: 620,
      show: false,
      autoHideMenuBar: true,
      icon: iconFile,
      titleBarStyle: 'hiddenInset',
      transparent: process.platform === 'darwin',
      vibrancy: process.platform === 'darwin' ? 'under-window' : undefined,
      backgroundColor: '#00000000',
      maximizable: true,
      frame: process.platform === 'darwin',
      hasShadow: true,
      trafficLightPosition: {
        x: 12,
        y: 12
      },
      webPreferences: {
        preload: join(__dirname, '../preload/index.mjs'),
        sandbox: false,
        devTools: is.dev
      },
      roundedCorners: true
    })

    // 获取内容保护设置的值
    const contentProtectionEnabled = this.configPresenter.getContentProtectionEnabled()
    // 更新内容保护设置
    this.updateContentProtection(shellWindow, contentProtectionEnabled)

    shellWindow.on('ready-to-show', () => {
      shellWindow.show()
      eventBus.emit(WINDOW_EVENTS.READY_TO_SHOW, shellWindow)
    })

    // 处理关闭按钮点击
    shellWindow.on('close', (e) => {
      eventBus.emit('shell-window-close', shellWindow)
      console.log('shell-window-close', this.isQuitting, e)
      if (!this.isQuitting) {
        e.preventDefault()
        if (shellWindow.isFullScreen()) {
          shellWindow.setFullScreen(false)
        }
        shellWindow.hide()
      }
    })

    shellWindow.on('closed', () => {
      this.windows.delete(shellWindow.id)
      eventBus.emit('shell-window-closed', shellWindow)
    })

    shellWindow.webContents.setWindowOpenHandler((details) => {
      shell.openExternal(details.url)
      return { action: 'deny' }
    })

    // Add handler for regular link clicks
    shellWindow.webContents.on('will-navigate', (event, url) => {
      if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
        if (url.startsWith(process.env['ELECTRON_RENDERER_URL'] || '')) {
          return
        }
      }
      // 检查是否为外部链接
      const isExternal = url.startsWith('http:') || url.startsWith('https:')
      if (isExternal) {
        event.preventDefault()
        shell.openExternal(url)
      }
    })

    shellWindow.on('resize', () => {
      eventBus.emit(WINDOW_EVENTS.WINDOW_RESIZE, shellWindow.id)
    })

    shellWindow.on('resized', () => {
      eventBus.emit(WINDOW_EVENTS.WINDOW_RESIZED, shellWindow.id)
    })

    shellWindow.on('show', () => {
      if (shellWindow.isMinimized()) {
        shellWindow.restore()
      }
    })

    shellWindow.on('blur', () => {
      if (this.focusedWindowId === shellWindow.id) {
        this.focusedWindowId = null
      }
    })

    shellWindow.on('focus', () => {
      this.focusedWindowId = shellWindow.id
    })

    shellWindow.on('maximize', () => {
      shellWindow.webContents.send(WINDOW_EVENTS.WINDOW_MAXIMIZED)
    })

    shellWindow.on('unmaximize', () => {
      shellWindow.webContents.send(WINDOW_EVENTS.WINDOW_UNMAXIMIZED)
    })

    shellWindow.on('enter-full-screen', () => {
      shellWindow.webContents.send('window-fullscreened')
    })

    shellWindow.on('leave-full-screen', () => {
      shellWindow.webContents.send('window-unfullscreened')
    })

    shellWindow.on('minimize', () => {
      shellWindow.webContents.send('window-minimized')
    })

    shellWindow.on('restore', () => {
      shellWindow.webContents.send('window-restored')
    })

    if (is.dev) {
      shellWindow.webContents.openDevTools()
    }

    // HMR for renderer base on electron-vite cli.
    // Load the remote URL for development or the local html file for production.
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      console.log('loadURL', `${process.env['ELECTRON_RENDERER_URL']}/shell`)
      shellWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/shell/index.html`)
    } else {
      shellWindow.loadFile(join(__dirname, '../renderer/shell/index.html'))
    }
    this.windows.set(shellWindow.id, shellWindow)

    // 初始化托盘（仅在第一个窗口创建时）
    if (!this.trayPresenter) {
      this.trayPresenter = new TrayPresenter(this)
    }

    const lang = this.configPresenter.getSetting<string>('language')
    this.resetContextMenu(lang || app.getLocale())

    return shellWindow
  }

  // 添加更新内容保护的方法
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

  async resetContextMenu(lang: string): Promise<void> {
    if (this.contextMenuDisposer) {
      this.contextMenuDisposer()
    }

    const labels = await getContextMenuLabels(lang)
    const focusedWindow = this.getFocusedWindow()
    if (focusedWindow) {
      this.contextMenuDisposer = contextMenu({
        window: focusedWindow,
        labels,
        shouldShowMenu() {
          return true
        }
      })
    }
  }
}

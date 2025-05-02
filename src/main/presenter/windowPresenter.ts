import { BrowserWindow, shell, app, nativeImage, nativeTheme } from 'electron'
import { join } from 'path'
import icon from '../../../resources/icon.png?asset'
import iconWin from '../../../resources/icon.ico?asset'
import { is } from '@electron-toolkit/utils'
import { IWindowPresenter } from '@shared/presenter'
import { eventBus } from '@/eventbus'
import { ConfigPresenter } from './configPresenter'
import { TrayPresenter } from './trayPresenter'
import { CONFIG_EVENTS, WINDOW_EVENTS } from '@/events'
import contextMenu from '../contextMenuHelper'
import { getContextMenuLabels } from '@shared/i18n'
import { presenter } from '.'
import os from 'os'

// 检查 Windows 版本
function isWindows10OrLater(): boolean {
  if (process.platform !== 'win32') return false
  const release = os.release().split('.')
  const major = parseInt(release[0])
  return major >= 10
}

// 检查是否为 Windows 11
function isWindows11OrLater(): boolean {
  if (process.platform !== 'win32') return false
  const release = os.release().split('.')
  const major = parseInt(release[0])
  const build = parseInt(release[2])
  // Windows 11 的内部版本号从 22000 开始
  return major >= 10 && build >= 22000
}

export const MAIN_WIN = 'main'
export class WindowPresenter implements IWindowPresenter {
  windows: Map<string, BrowserWindow>
  private configPresenter: ConfigPresenter
  private isQuitting: boolean = false
  private trayPresenter: TrayPresenter | null = null
  private contextMenuDisposer?: () => void
  private mainWindowFocused: boolean = false

  constructor(configPresenter: ConfigPresenter) {
    this.windows = new Map()
    this.configPresenter = configPresenter

    // 监听应用退出事件
    app.on('before-quit', () => {
      console.log('before-quit')
      this.isQuitting = true
      if (this.trayPresenter) {
        this.trayPresenter.destroy()
      }
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
      if (this.mainWindow) {
        // 发送通知告知应用程序将重启
        console.log('Content protection setting changed to:', enabled, 'Restarting app...')

        // 延迟一点时间以确保设置已保存并且用户能看到对话框的反馈
        setTimeout(() => {
          presenter.devicePresenter.restartApp()
        }, 1000)
      }
    })

    // 监听系统主题变化
    nativeTheme.on('updated', () => {
      // 只有当主题设置为 system 时，才需要通知渲染进程
      if (nativeTheme.themeSource === 'system' && this.mainWindow) {
        this.mainWindow.webContents.send('system-theme-updated', nativeTheme.shouldUseDarkColors)
      }
    })
  }

  createMainWindow(): BrowserWindow {
    const iconFile = nativeImage.createFromPath(process.platform === 'win32' ? iconWin : icon)
    let backgroundMaterial: 'acrylic' | 'auto' | 'none' | 'mica' | 'tabbed' | undefined
    if (process.platform === 'darwin') {
      backgroundMaterial = undefined
    } else if (isWindows11OrLater()) {
      backgroundMaterial = 'acrylic'
    } else {
      backgroundMaterial = 'none'
    }
    const mainWindow = new BrowserWindow({
      width: 1024,
      height: 620,
      show: false,
      autoHideMenuBar: true,
      icon: iconFile,
      titleBarStyle: 'hiddenInset',
      transparent: true,
      vibrancy: process.platform === 'darwin' ? 'under-window' : undefined,
      backgroundColor: '#00000000',
      maximizable: true,
      frame: process.platform === 'darwin',
      hasShadow: true,
      trafficLightPosition: {
        x: 12,
        y: 12
      },
      backgroundMaterial: backgroundMaterial,
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
    this.updateContentProtection(mainWindow, contentProtectionEnabled)

    mainWindow.on('ready-to-show', () => {
      mainWindow.show()
      eventBus.emit(WINDOW_EVENTS.READY_TO_SHOW, mainWindow)
    })

    // 处理关闭按钮点击
    mainWindow.on('close', (e) => {
      eventBus.emit('main-window-close', mainWindow)
      console.log('main-window-close', this.isQuitting, e)
      if (!this.isQuitting) {
        e.preventDefault()
        if (mainWindow.isFullScreen()) {
          mainWindow.setFullScreen(false)
        }
        mainWindow.hide()
      }
    })

    mainWindow.on('closed', () => {
      this.windows.delete(MAIN_WIN)
      eventBus.emit('main-window-closed', mainWindow)
    })

    mainWindow.webContents.setWindowOpenHandler((details) => {
      shell.openExternal(details.url)
      return { action: 'deny' }
    })

    // Add handler for regular link clicks
    mainWindow.webContents.on('will-navigate', (event, url) => {
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
      // 内部路由变化则不阻止
    })

    mainWindow.on('show', () => {
      if (mainWindow.isMinimized()) {
        mainWindow.restore()
      }
    })
    mainWindow.on('blur', () => {
      this.mainWindowFocused = false
    })
    mainWindow.on('focus', () => {
      this.mainWindowFocused = true
    })

    mainWindow.on('maximize', () => {
      mainWindow.webContents.send(WINDOW_EVENTS.WINDOW_MAXIMIZED)
    })

    mainWindow.on('unmaximize', () => {
      mainWindow.webContents.send(WINDOW_EVENTS.WINDOW_UNMAXIMIZED)
    })

    mainWindow.on('maximize', () => {
      mainWindow.webContents.send('window-maximized')
    })

    mainWindow.on('unmaximize', () => {
      mainWindow.webContents.send('window-unmaximized')
    })

    mainWindow.on('enter-full-screen', () => {
      mainWindow.webContents.send('window-fullscreened')
    })

    mainWindow.on('leave-full-screen', () => {
      mainWindow.webContents.send('window-unfullscreened')
    })

    mainWindow.on('minimize', () => {
      mainWindow.webContents.send('window-minimized')
    })

    mainWindow.on('restore', () => {
      mainWindow.webContents.send('window-restored')
    })

    if (is.dev) {
      mainWindow.webContents.openDevTools()
    }

    // HMR for renderer base on electron-vite cli.
    // Load the remote URL for development or the local html file for production.
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    } else {
      mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
    }
    this.windows.set(MAIN_WIN, mainWindow)

    // 初始化托盘
    if (!this.trayPresenter) {
      this.trayPresenter = new TrayPresenter(this)
    }

    const lang = this.configPresenter.getSetting<string>('language')
    this.resetContextMenu(lang || app.getLocale())

    return mainWindow
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
    // 如果关闭内容保护，则使用默认设置
  }

  getWindow(windowName: string): BrowserWindow | undefined {
    return this.windows.get(windowName)
  }

  get mainWindow(): BrowserWindow | undefined {
    return this.getWindow(MAIN_WIN)
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

  minimize(): void {
    const window = this.mainWindow
    if (window) {
      window.minimize()
    }
  }

  maximize(): void {
    const window = this.mainWindow
    if (window) {
      if (window.isMaximized()) {
        window.unmaximize()
      } else {
        window.maximize()
      }
    }
  }

  close(): void {
    const window = this.mainWindow
    if (window) {
      window.close()
    }
  }

  hide(): void {
    const window = this.mainWindow
    if (window) {
      window.hide()
    }
  }

  show(): void {
    const window = this.mainWindow
    if (window) {
      window.show()
    }
  }

  isMaximized(): boolean {
    const window = this.mainWindow
    return window ? window.isMaximized() : false
  }

  async toggleTheme(theme: 'dark' | 'light' | 'system'): Promise<boolean> {
    nativeTheme.themeSource = theme
    return nativeTheme.shouldUseDarkColors
  }

  async getTheme(): Promise<string> {
    return nativeTheme.themeSource
  }

  async getSystemTheme(): Promise<'dark' | 'light'> {
    return nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
  }

  async resetContextMenu(lang: string): Promise<void> {
    const locale = lang === 'system' ? app.getLocale() : lang
    console.log('resetContextMenu', locale)
    if (this.contextMenuDisposer) {
      this.contextMenuDisposer()
      this.contextMenuDisposer = undefined
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
    const window = this.mainWindow
    if (window) {
      const labels = getContextMenuLabels(locale)
      this.contextMenuDisposer = contextMenu({
        window: window,
        shouldShowMenu(event, params) {
          console.log('shouldShowMenu 被调用:', params.x, params.y, params.mediaType, event)
          return true
        },
        labels
      })
    } else {
      console.error('无法重置上下文菜单: 找不到主窗口')
    }
  }
  isMainWindowFocused(): boolean {
    return this.mainWindowFocused
  }
}

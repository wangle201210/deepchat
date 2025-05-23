import { app, globalShortcut } from 'electron'
import { presenter } from '.'
import { SHORTCUT_EVENTS } from '../events'
import { eventBus } from '../eventbus'

export class ShortcutPresenter {
  private isActive: boolean = false

  constructor() {
    console.log('ShortcutPresenter constructor')
  }

  registerShortcuts(): void {
    if (this.isActive) return
    console.log('reg shortcuts')

    // Command+N 或 Ctrl+N 创建新会话
    globalShortcut.register(process.platform === 'darwin' ? 'Command+N' : 'Control+N', async () => {
      const focusedWindow = presenter.windowPresenter.getFocusedWindow()
      if (focusedWindow?.isFocused()) {
        presenter.windowPresenter.sendToActiveTab(
          focusedWindow.id,
          SHORTCUT_EVENTS.CREATE_NEW_CONVERSATION
        )
      }
    })

    // Command+Shift+N 或 Ctrl+Shift+N 创建新窗口
    globalShortcut.register(
      process.platform === 'darwin' ? 'Command+Shift+N' : 'Control+Shift+N',
      () => {
        const focusedWindow = presenter.windowPresenter.getFocusedWindow()
        if (focusedWindow?.isFocused()) {
          eventBus.emit(SHORTCUT_EVENTS.CREATE_NEW_WINDOW)
        }
      }
    )

    // Command+T 或 Ctrl+T 在当前窗口创建新标签页
    globalShortcut.register(process.platform === 'darwin' ? 'Command+T' : 'Control+T', () => {
      const focusedWindow = presenter.windowPresenter.getFocusedWindow()
      if (focusedWindow?.isFocused()) {
        eventBus.emit(SHORTCUT_EVENTS.CREATE_NEW_TAB, focusedWindow.id)
      }
    })

    // Command+W 或 Ctrl+W 关闭当前标签页
    globalShortcut.register(process.platform === 'darwin' ? 'Command+W' : 'Control+W', () => {
      const focusedWindow = presenter.windowPresenter.getFocusedWindow()
      if (focusedWindow?.isFocused()) {
        eventBus.emit(SHORTCUT_EVENTS.CLOSE_CURRENT_TAB, focusedWindow.id)
      }
    })

    // Command+Q 或 Ctrl+Q 退出程序
    globalShortcut.register(process.platform === 'darwin' ? 'Command+Q' : 'Control+Q', () => {
      app.quit()
    })

    // Command+= 或 Ctrl+= 放大字体
    globalShortcut.register(process.platform === 'darwin' ? 'Command+=' : 'Control+=', () => {
      eventBus.emit(SHORTCUT_EVENTS.ZOOM_IN)
    })

    // Command+- 或 Ctrl+- 缩小字体
    globalShortcut.register(process.platform === 'darwin' ? 'Command+-' : 'Control+-', () => {
      eventBus.emit(SHORTCUT_EVENTS.ZOOM_OUT)
    })

    // Command+0 或 Ctrl+0 重置字体大小
    globalShortcut.register(process.platform === 'darwin' ? 'Command+0' : 'Control+0', () => {
      eventBus.emit(SHORTCUT_EVENTS.ZOOM_RESUME)
    })

    // Command+, 或 Ctrl+, 打开设置
    globalShortcut.register(process.platform === 'darwin' ? 'Command+,' : 'Control+,', () => {
      eventBus.emit(SHORTCUT_EVENTS.GO_SETTINGS)
    })

    // Command+L 或 Ctrl+L 清除聊天历史
    globalShortcut.register(process.platform === 'darwin' ? 'Command+L' : 'Control+L', () => {
      eventBus.emit(SHORTCUT_EVENTS.CLEAN_CHAT_HISTORY)
    })

    // 添加标签页切换相关快捷键

    // Command+Tab 或 Ctrl+Tab 切换到下一个标签页
    globalShortcut.register('Control+Tab', () => {
      const focusedWindow = presenter.windowPresenter.getFocusedWindow()
      if (focusedWindow?.isFocused()) {
        this.switchToNextTab(focusedWindow.id)
      }
    })

    // Ctrl+Shift+Tab 切换到上一个标签页
    globalShortcut.register('Control+Shift+Tab', () => {
      const focusedWindow = presenter.windowPresenter.getFocusedWindow()
      if (focusedWindow?.isFocused()) {
        this.switchToPreviousTab(focusedWindow.id)
      }
    })

    // 注册标签页数字快捷键 (1-8)
    for (let i = 1; i <= 8; i++) {
      globalShortcut.register(
        process.platform === 'darwin' ? `Command+${i}` : `Control+${i}`,
        () => {
          const focusedWindow = presenter.windowPresenter.getFocusedWindow()
          if (focusedWindow?.isFocused()) {
            this.switchToTabByIndex(focusedWindow.id, i - 1) // 索引从0开始
          }
        }
      )
    }

    // Command+9 或 Ctrl+9 切换到最后一个标签页
    globalShortcut.register(process.platform === 'darwin' ? 'Command+9' : 'Control+9', () => {
      const focusedWindow = presenter.windowPresenter.getFocusedWindow()
      if (focusedWindow?.isFocused()) {
        this.switchToLastTab(focusedWindow.id)
      }
    })

    this.isActive = true
  }

  // 切换到下一个标签页
  private async switchToNextTab(windowId: number): Promise<void> {
    try {
      const tabsData = await presenter.tabPresenter.getWindowTabsData(windowId)
      if (!tabsData || tabsData.length <= 1) return // 只有一个或没有标签页时不执行切换

      // 找到当前活动标签的索引
      const activeTabIndex = tabsData.findIndex((tab) => tab.isActive)
      if (activeTabIndex === -1) return

      // 计算下一个标签页的索引（循环到第一个）
      const nextTabIndex = (activeTabIndex + 1) % tabsData.length

      // 切换到下一个标签页
      await presenter.tabPresenter.switchTab(tabsData[nextTabIndex].id)
    } catch (error) {
      console.error('切换到下一个标签页失败:', error)
    }
  }

  // 切换到上一个标签页
  private async switchToPreviousTab(windowId: number): Promise<void> {
    try {
      const tabsData = await presenter.tabPresenter.getWindowTabsData(windowId)
      if (!tabsData || tabsData.length <= 1) return // 只有一个或没有标签页时不执行切换

      // 找到当前活动标签的索引
      const activeTabIndex = tabsData.findIndex((tab) => tab.isActive)
      if (activeTabIndex === -1) return

      // 计算上一个标签页的索引（循环到最后一个）
      const previousTabIndex = (activeTabIndex - 1 + tabsData.length) % tabsData.length

      // 切换到上一个标签页
      await presenter.tabPresenter.switchTab(tabsData[previousTabIndex].id)
    } catch (error) {
      console.error('切换到上一个标签页失败:', error)
    }
  }

  // 切换到指定索引的标签页
  private async switchToTabByIndex(windowId: number, index: number): Promise<void> {
    try {
      const tabsData = await presenter.tabPresenter.getWindowTabsData(windowId)
      if (!tabsData || index >= tabsData.length) return // 索引超出范围

      // 切换到指定索引的标签页
      await presenter.tabPresenter.switchTab(tabsData[index].id)
    } catch (error) {
      console.error(`切换到索引 ${index} 的标签页失败:`, error)
    }
  }

  // 切换到最后一个标签页
  private async switchToLastTab(windowId: number): Promise<void> {
    try {
      const tabsData = await presenter.tabPresenter.getWindowTabsData(windowId)
      if (!tabsData || tabsData.length === 0) return

      // 切换到最后一个标签页
      await presenter.tabPresenter.switchTab(tabsData[tabsData.length - 1].id)
    } catch (error) {
      console.error('切换到最后一个标签页失败:', error)
    }
  }

  unregisterShortcuts(): void {
    console.log('unreg shortcuts')
    globalShortcut.unregisterAll()
    this.isActive = false
  }

  destroy(): void {
    this.unregisterShortcuts()
  }
}

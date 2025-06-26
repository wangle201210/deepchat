import { describe, it, expect, beforeEach, vi } from 'vitest'
import { EventBus, SendTarget } from '../../../src/main/eventbus'
import type { IWindowPresenter, ITabPresenter } from '../../../src/shared/presenter'

describe('EventBus 事件总线', () => {
  let eventBus: EventBus
  let mockWindowPresenter: IWindowPresenter
  let mockTabPresenter: ITabPresenter

  beforeEach(() => {
    eventBus = new EventBus()

    // Mock WindowPresenter
    mockWindowPresenter = {
      sendToWindow: vi.fn(),
      sendToAllWindows: vi.fn(),
      sendToDefaultTab: vi.fn()
    } as Partial<IWindowPresenter> as IWindowPresenter

    // Mock TabPresenter
    mockTabPresenter = {
      getTab: vi.fn(),
      getActiveTabId: vi.fn()
    } as Partial<ITabPresenter> as ITabPresenter
  })

  describe('发送事件到主进程', () => {
    it('应该能够正确发送事件到主进程', () => {
      const eventName = 'test:event'
      const testData = { message: 'test' }

      // 监听事件
      const mockListener = vi.fn()
      eventBus.on(eventName, mockListener)

      // 发送事件
      eventBus.sendToMain(eventName, testData)

      // 验证事件被正确触发
      expect(mockListener).toHaveBeenCalledWith(testData)
      expect(mockListener).toHaveBeenCalledTimes(1)
    })

    it('应该支持发送多个参数', () => {
      const eventName = 'test:multiple-args'
      const arg1 = 'first'
      const arg2 = { second: 'data' }
      const arg3 = 123

      const mockListener = vi.fn()
      eventBus.on(eventName, mockListener)

      eventBus.sendToMain(eventName, arg1, arg2, arg3)

      expect(mockListener).toHaveBeenCalledWith(arg1, arg2, arg3)
    })
  })

  describe('发送事件到特定窗口', () => {
    beforeEach(() => {
      eventBus.setWindowPresenter(mockWindowPresenter)
    })

    it('应该能够发送事件到特定窗口', () => {
      const eventName = 'window:test'
      const windowId = 123
      const testData = { data: 'test' }

      eventBus.sendToWindow(eventName, windowId, testData)

      expect(mockWindowPresenter.sendToWindow).toHaveBeenCalledWith(windowId, eventName, testData)
    })

    it('当WindowPresenter未设置时应该显示警告', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const newEventBus = new EventBus()

      newEventBus.sendToWindow('test:event', 1, 'data')

      expect(consoleSpy).toHaveBeenCalledWith(
        'WindowPresenter not available, cannot send to window'
      )

      consoleSpy.mockRestore()
    })
  })

  describe('发送事件到渲染进程', () => {
    beforeEach(() => {
      eventBus.setWindowPresenter(mockWindowPresenter)
    })

    it('应该能够发送事件到所有窗口（默认行为）', () => {
      const eventName = 'renderer:test'
      const testData = { message: 'test' }

      eventBus.sendToRenderer(eventName, undefined, testData)

      expect(mockWindowPresenter.sendToAllWindows).toHaveBeenCalledWith(eventName, testData)
    })

    it('应该能够发送事件到所有窗口（显式指定）', () => {
      const eventName = 'renderer:all'
      const testData = { message: 'all windows' }

      eventBus.sendToRenderer(eventName, SendTarget.ALL_WINDOWS, testData)

      expect(mockWindowPresenter.sendToAllWindows).toHaveBeenCalledWith(eventName, testData)
    })

    it('应该能够发送事件到默认标签页', () => {
      const eventName = 'renderer:default-tab'
      const testData = { message: 'default tab' }

      eventBus.sendToRenderer(eventName, SendTarget.DEFAULT_TAB, testData)

      expect(mockWindowPresenter.sendToDefaultTab).toHaveBeenCalledWith(eventName, true, testData)
    })

    it('当WindowPresenter未设置时应该显示警告', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const newEventBus = new EventBus()

      newEventBus.sendToRenderer('test:event', SendTarget.ALL_WINDOWS, 'data')

      expect(consoleSpy).toHaveBeenCalledWith(
        'WindowPresenter not available, cannot send to renderer'
      )

      consoleSpy.mockRestore()
    })
  })

  describe('同时发送到主进程和渲染进程', () => {
    beforeEach(() => {
      eventBus.setWindowPresenter(mockWindowPresenter)
    })

    it('应该同时发送事件到主进程和渲染进程', () => {
      const eventName = 'both:test'
      const testData = { message: 'both processes' }

      const mockListener = vi.fn()
      eventBus.on(eventName, mockListener)

      eventBus.send(eventName, SendTarget.ALL_WINDOWS, testData)

      // 验证主进程收到事件
      expect(mockListener).toHaveBeenCalledWith(testData)

      // 验证渲染进程收到事件
      expect(mockWindowPresenter.sendToAllWindows).toHaveBeenCalledWith(eventName, testData)
    })

    it('应该使用默认的SendTarget', () => {
      const eventName = 'both:default'
      const testData = { message: 'default target' }

      eventBus.send(eventName, undefined, testData)

      expect(mockWindowPresenter.sendToAllWindows).toHaveBeenCalledWith(eventName, testData)
    })
  })

  describe('Tab相关功能', () => {
    const mockTabView = {
      webContents: {
        send: vi.fn(),
        isDestroyed: vi.fn(() => false)
      }
    }

    beforeEach(() => {
      eventBus.setTabPresenter(mockTabPresenter)
      vi.mocked(mockTabPresenter.getTab).mockResolvedValue(mockTabView as any)
      vi.mocked(mockTabPresenter.getActiveTabId).mockResolvedValue(1)
    })

    it('应该能够发送事件到指定Tab', async () => {
      const tabId = 1
      const eventName = 'tab:test'
      const testData = { message: 'tab test' }

      eventBus.sendToTab(tabId, eventName, testData)

      // 等待异步操作完成
      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(mockTabPresenter.getTab).toHaveBeenCalledWith(tabId)
      expect(mockTabView.webContents.send).toHaveBeenCalledWith(eventName, testData)
    })

    it('应该能够发送事件到活跃Tab', async () => {
      const windowId = 1
      const eventName = 'active-tab:test'
      const testData = { message: 'active tab test' }

      eventBus.sendToActiveTab(windowId, eventName, testData)

      // 等待异步操作完成
      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(mockTabPresenter.getActiveTabId).toHaveBeenCalledWith(windowId)
      expect(mockTabPresenter.getTab).toHaveBeenCalledWith(1)
    })

    it('应该能够广播事件到多个Tab', async () => {
      const tabIds = [1, 2, 3]
      const eventName = 'broadcast:test'
      const testData = { message: 'broadcast test' }

      eventBus.broadcastToTabs(tabIds, eventName, testData)

      // 等待异步操作完成
      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(mockTabPresenter.getTab).toHaveBeenCalledTimes(3)
      expect(mockTabPresenter.getTab).toHaveBeenCalledWith(1)
      expect(mockTabPresenter.getTab).toHaveBeenCalledWith(2)
      expect(mockTabPresenter.getTab).toHaveBeenCalledWith(3)
    })

    it('当TabPresenter未设置时应该显示警告', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const newEventBus = new EventBus()

      newEventBus.sendToTab(1, 'test:event', 'data')

      expect(consoleSpy).toHaveBeenCalledWith(
        'TabPresenter not available, cannot send to specific tab'
      )

      consoleSpy.mockRestore()
    })
  })

  describe('Presenter设置', () => {
    it('应该能够设置WindowPresenter', () => {
      eventBus.setWindowPresenter(mockWindowPresenter)

      // 验证设置成功（通过发送事件不产生警告）
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      eventBus.sendToRenderer('test:event', SendTarget.ALL_WINDOWS, 'data')

      expect(consoleSpy).not.toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

    it('应该能够设置TabPresenter', () => {
      // Mock getTab method before testing
      const mockTabView = {
        webContents: {
          send: vi.fn(),
          isDestroyed: vi.fn(() => false)
        }
      }
      vi.mocked(mockTabPresenter.getTab).mockResolvedValue(mockTabView as any)

      eventBus.setTabPresenter(mockTabPresenter)

      // 验证设置成功（通过发送事件不产生警告）
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      eventBus.sendToTab(1, 'test:event', 'data')

      expect(consoleSpy).not.toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })

  describe('错误处理', () => {
    beforeEach(() => {
      eventBus.setTabPresenter(mockTabPresenter)
    })

    it('当Tab不存在时应该显示警告', async () => {
      vi.mocked(mockTabPresenter.getTab).mockResolvedValue(null)
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      eventBus.sendToTab(999, 'test:event', 'data')

      // 等待异步操作完成
      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(consoleSpy).toHaveBeenCalledWith(
        'Tab 999 not found or destroyed, cannot send event test:event'
      )

      consoleSpy.mockRestore()
    })

    it('当Tab已销毁时应该显示警告', async () => {
      const destroyedTabView = {
        webContents: {
          isDestroyed: vi.fn(() => true)
        }
      }
      vi.mocked(mockTabPresenter.getTab).mockResolvedValue(destroyedTabView as any)
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      eventBus.sendToTab(1, 'test:event', 'data')

      // 等待异步操作完成
      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(consoleSpy).toHaveBeenCalledWith(
        'Tab 1 not found or destroyed, cannot send event test:event'
      )

      consoleSpy.mockRestore()
    })

    it('当获取Tab失败时应该记录错误', async () => {
      const error = new Error('Failed to get tab')
      vi.mocked(mockTabPresenter.getTab).mockRejectedValue(error)
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      eventBus.sendToTab(1, 'test:event', 'data')

      // 等待异步操作完成
      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(consoleSpy).toHaveBeenCalledWith('Error sending event test:event to tab 1:', error)

      consoleSpy.mockRestore()
    })
  })
})

import { IWindowPresenter } from '@shared/presenter'
import EventEmitter from 'events'

export enum SendTarget {
  MAIN = 'main',
  RENDERER = 'renderer',
  ALL_WINDOWS = 'all_windows',
  DEFAULT_TAB = 'default_tab'
}

// 定义需要自动转发到渲染进程的事件常量
const DEFAULT_RENDERER_EVENTS = new Set([
  // 流事件
  'stream:error',
  // 会话事件
  'conversation:activated',
  'conversation:deactivated',
  'conversation:message-edited',
  // MCP 事件
  'mcp:server-started',
  'mcp:server-stopped',
  'mcp:config-changed',
  'mcp:tool-call-result',
  // Ollama 事件
  'ollama:pull-model-progress',
  // 通知事件
  'notification:show-error',
  // 快捷键事件
  'shortcut:go-settings',
  'shortcut:clean-chat-history'
])

export class EventBus extends EventEmitter {
  private windowPresenter: IWindowPresenter | null = null

  constructor() {
    super()
  }
  /**
   * 仅向主进程发送事件
   */
  sendToMain(eventName: string, ...args: unknown[]) {
    super.emit(eventName, ...args)
  }

  /**
   * 向渲染进程发送事件
   * @param eventName 事件名称
   * @param target 发送目标：所有窗口或默认标签页
   * @param args 事件参数
   */
  sendToRenderer(eventName: string, target: SendTarget = SendTarget.ALL_WINDOWS, ...args: unknown[]) {
    if (!this.windowPresenter) {
      console.warn('WindowPresenter not available, cannot send to renderer')
      return
    }

    switch (target) {
      case SendTarget.ALL_WINDOWS:
        this.windowPresenter.sendToAllWindows(eventName, ...args)
        break
      case SendTarget.DEFAULT_TAB:
        this.windowPresenter.sendTodefaultTab(eventName, true, ...args)
        break
      default:
        this.windowPresenter.sendToAllWindows(eventName, ...args)
    }
  }

  /**
   * 同时发送到主进程和渲染进程
   * @param eventName 事件名称
   * @param target 发送目标
   * @param args 事件参数
   */
  send(eventName: string, target: SendTarget = SendTarget.ALL_WINDOWS, ...args: unknown[]) {
    // 发送到主进程
    this.sendToMain(eventName, ...args)

    // 发送到渲染进程
    this.sendToRenderer(eventName, target, ...args)
  }

  /**
   * 重写 emit 方法，默认同时广播给主进程和渲染进程
   * 注意：这个方法将被逐步废弃，推荐使用具体的 send 方法
   * @param eventName 事件名称
   * @param args 事件参数
   */
  emit(eventName: string, ...args: unknown[]): boolean {
    // 发送到主进程
    const mainResult = super.emit(eventName, ...args)

    // 如果是默认需要转发的事件，也发送到渲染进程
    if (DEFAULT_RENDERER_EVENTS.has(eventName)) {
      this.sendToRenderer(eventName, SendTarget.ALL_WINDOWS, ...args)
    }

    return mainResult
  }

  /**
   * 设置窗口展示器（用于向渲染进程发送消息）
   */
  setWindowPresenter(windowPresenter: IWindowPresenter) {
    this.windowPresenter = windowPresenter
  }

  /**
   * @deprecated 使用 send() 方法替代
   * 批量注册可转发到渲染进程的事件（已废弃）
   */
  registerRendererEvents(): void {
    console.warn('registerRendererEvents is deprecated, renderer events are now predefined')
  }

  /**
   * @deprecated 使用 send() 方法替代
   * 添加可转发到渲染进程的事件类型（已废弃）
   */
  addRendererEvent(): void {
    console.warn('addRendererEvent is deprecated, renderer events are now predefined')
  }
}

// 创建全局事件总线实例
export const eventBus = new EventBus()


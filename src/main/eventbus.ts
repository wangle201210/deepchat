import EventEmitter from 'events'

export interface EventBusOptions {
  // 可以在渲染进程中接收的事件类型列表
  rendererEvents?: string[]
}

export enum SendTarget {
  MAIN = 'main',
  RENDERER = 'renderer',
  ALL_WINDOWS = 'all_windows',
  DEFAULT_TAB = 'default_tab'
}

// 定义窗口展示器接口
interface IWindowPresenter {
  sendToAllWindows(eventName: string, ...args: unknown[]): void
  sendTodefaultTab(eventName: string, isInternal: boolean, ...args: unknown[]): void
}

export class EventBus extends EventEmitter {
  private windowPresenter: IWindowPresenter | null = null
  private rendererEvents: Set<string> = new Set()

  constructor(options: EventBusOptions = {}) {
    super()
    if (options.rendererEvents) {
      this.rendererEvents = new Set(options.rendererEvents)
    }
  }

  /**
   * 设置窗口展示器（用于向渲染进程发送消息）
   */
  setWindowPresenter(windowPresenter: IWindowPresenter) {
    this.windowPresenter = windowPresenter
  }

  /**
   * 添加可转发到渲染进程的事件类型
   */
  addRendererEvent(eventName: string) {
    this.rendererEvents.add(eventName)
  }

  /**
   * 移除可转发到渲染进程的事件类型
   */
  removeRendererEvent(eventName: string) {
    this.rendererEvents.delete(eventName)
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
      console.warn('WindowPresenter not set, cannot send to renderer')
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
   * 重写 emit 方法，同时广播给主进程和渲染进程
   * @param eventName 事件名称
   * @param args 事件参数
   */
  emit(eventName: string, ...args: unknown[]): boolean {
    // 首先发送到主进程
    const mainResult = super.emit(eventName, ...args)

    // 如果是可转发到渲染进程的事件，也发送到渲染进程
    if (this.rendererEvents.has(eventName)) {
      this.sendToRenderer(eventName, SendTarget.ALL_WINDOWS, ...args)
    }

    return mainResult
  }

  /**
   * 重写默认的 send 方法，同时广播给主进程和渲染进程
   */
  send(eventName: string, target: SendTarget = SendTarget.ALL_WINDOWS, ...args: unknown[]) {
    // 发送到主进程
    this.sendToMain(eventName, ...args)

    // 发送到渲染进程
    this.sendToRenderer(eventName, target, ...args)
  }

  /**
   * 批量注册可转发到渲染进程的事件
   */
  registerRendererEvents(events: string[]) {
    events.forEach(event => this.addRendererEvent(event))
  }
}

// 创建全局事件总线实例
export const eventBus = new EventBus()

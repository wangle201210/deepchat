import { ipcMain, IpcMainInvokeEvent, app } from 'electron'
// import { LlamaCppPresenter } from './llamaCppPresenter' // 保留原始注释
import { WindowPresenter } from './windowPresenter'
import { SQLitePresenter } from './sqlitePresenter'
import { ShortcutPresenter } from './shortcutPresenter'
import { IPresenter } from '@shared/presenter'
import { eventBus } from '@/eventbus'
import path from 'path'
import { LLMProviderPresenter } from './llmProviderPresenter'
import { ConfigPresenter } from './configPresenter'
import { ThreadPresenter } from './threadPresenter'
import { DevicePresenter } from './devicePresenter'
import { UpgradePresenter } from './upgradePresenter'
import { FilePresenter } from './filePresenter/FilePresenter'
import { McpPresenter } from './mcpPresenter'
import { SyncPresenter } from './syncPresenter'
import { DeeplinkPresenter } from './deeplinkPresenter'
import { NotificationPresenter } from './notifactionPresenter'
import { TabPresenter } from './tabPresenter'
import { TrayPresenter } from './trayPresenter'
import { OAuthPresenter } from './oauthPresenter'
import {
  CONFIG_EVENTS,
  CONVERSATION_EVENTS,
  STREAM_EVENTS,
  WINDOW_EVENTS,
  UPDATE_EVENTS,
  OLLAMA_EVENTS,
  MCP_EVENTS,
  SYNC_EVENTS,
  DEEPLINK_EVENTS,
  NOTIFICATION_EVENTS,
  SHORTCUT_EVENTS
} from '@/events'

// 需要通过 forward 函数转发到渲染进程的事件列表
const eventsToForward: string[] = [
  CONFIG_EVENTS.PROVIDER_CHANGED,
  STREAM_EVENTS.RESPONSE,
  STREAM_EVENTS.END,
  STREAM_EVENTS.ERROR,
  CONVERSATION_EVENTS.ACTIVATED,
  CONVERSATION_EVENTS.DEACTIVATED,
  CONFIG_EVENTS.MODEL_LIST_CHANGED,
  CONFIG_EVENTS.MODEL_STATUS_CHANGED,
  UPDATE_EVENTS.STATUS_CHANGED,
  UPDATE_EVENTS.PROGRESS,
  UPDATE_EVENTS.WILL_RESTART,
  UPDATE_EVENTS.ERROR,
  CONVERSATION_EVENTS.MESSAGE_EDITED,
  MCP_EVENTS.SERVER_STARTED,
  MCP_EVENTS.SERVER_STOPPED,
  MCP_EVENTS.CONFIG_CHANGED,
  MCP_EVENTS.TOOL_CALL_RESULT,
  OLLAMA_EVENTS.PULL_MODEL_PROGRESS,
  SYNC_EVENTS.BACKUP_STARTED,
  SYNC_EVENTS.BACKUP_COMPLETED,
  SYNC_EVENTS.BACKUP_ERROR,
  SYNC_EVENTS.IMPORT_STARTED,
  SYNC_EVENTS.IMPORT_COMPLETED,
  SYNC_EVENTS.IMPORT_ERROR,
  DEEPLINK_EVENTS.START,
  DEEPLINK_EVENTS.MCP_INSTALL,
  NOTIFICATION_EVENTS.SHOW_ERROR,
  NOTIFICATION_EVENTS.SYS_NOTIFY_CLICKED,
  SHORTCUT_EVENTS.GO_SETTINGS,
  SHORTCUT_EVENTS.CLEAN_CHAT_HISTORY,
  SHORTCUT_EVENTS.ZOOM_IN,
  SHORTCUT_EVENTS.ZOOM_OUT,
  SHORTCUT_EVENTS.ZOOM_RESUME,
  CONFIG_EVENTS.LANGUAGE_CHANGED,
  CONFIG_EVENTS.SOUND_ENABLED_CHANGED,
  CONFIG_EVENTS.OAUTH_LOGIN_START,
  CONFIG_EVENTS.OAUTH_LOGIN_SUCCESS,
  CONFIG_EVENTS.OAUTH_LOGIN_ERROR
]

// 主 Presenter 类，负责协调其他 Presenter 并处理 IPC 通信
export class Presenter implements IPresenter {
  windowPresenter: WindowPresenter
  sqlitePresenter: SQLitePresenter
  llmproviderPresenter: LLMProviderPresenter
  configPresenter: ConfigPresenter
  threadPresenter: ThreadPresenter
  devicePresenter: DevicePresenter
  upgradePresenter: UpgradePresenter
  shortcutPresenter: ShortcutPresenter
  filePresenter: FilePresenter
  mcpPresenter: McpPresenter
  syncPresenter: SyncPresenter
  deeplinkPresenter: DeeplinkPresenter
  notificationPresenter: NotificationPresenter
  tabPresenter: TabPresenter
  trayPresenter: TrayPresenter
  oauthPresenter: OAuthPresenter
  // llamaCppPresenter: LlamaCppPresenter // 保留原始注释

  constructor() {
    // 初始化各个 Presenter 实例及其依赖
    this.configPresenter = new ConfigPresenter()
    this.windowPresenter = new WindowPresenter(this.configPresenter)
    this.tabPresenter = new TabPresenter(this.windowPresenter)
    this.llmproviderPresenter = new LLMProviderPresenter(this.configPresenter)
    this.devicePresenter = new DevicePresenter()
    // 初始化 SQLite 数据库路径
    const dbDir = path.join(app.getPath('userData'), 'app_db')
    const dbPath = path.join(dbDir, 'chat.db')
    this.sqlitePresenter = new SQLitePresenter(dbPath)
    this.threadPresenter = new ThreadPresenter(
      this.sqlitePresenter,
      this.llmproviderPresenter,
      this.configPresenter
    )
    this.mcpPresenter = new McpPresenter(this.configPresenter)
    this.upgradePresenter = new UpgradePresenter()
    this.shortcutPresenter = new ShortcutPresenter(this.configPresenter)
    this.filePresenter = new FilePresenter()
    this.syncPresenter = new SyncPresenter(this.configPresenter, this.sqlitePresenter)
    this.deeplinkPresenter = new DeeplinkPresenter()
    this.notificationPresenter = new NotificationPresenter()
    this.oauthPresenter = new OAuthPresenter()
    this.trayPresenter = new TrayPresenter()

    // this.llamaCppPresenter = new LlamaCppPresenter() // 保留原始注释
    this.setupEventBus() // 设置事件总线监听
  }

  // 设置事件总线监听和转发
  setupEventBus() {
    // 事件转发辅助函数（包含特定逻辑处理）
    const forward = (eventName: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      eventBus.on(eventName, (...payload: any[]) => {
        // 特定事件的处理逻辑
        if (eventName === STREAM_EVENTS.RESPONSE) {
          const [msg] = payload
          const dataToRender = { ...msg }
          delete dataToRender.tool_call_response_raw // 删除原始数据
          this.windowPresenter.sendToAllWindows(eventName, dataToRender)
        } else if (eventName === STREAM_EVENTS.END) {
          const [msg] = payload
          console.log('stream-end', msg.eventId) // 保留日志
          this.windowPresenter.sendToAllWindows(eventName, msg)
        } else if (eventName === CONFIG_EVENTS.PROVIDER_CHANGED) {
          const providers = this.configPresenter.getProviders()
          this.llmproviderPresenter.setProviders(providers)
          this.windowPresenter.sendToAllWindows(eventName) // 此事件转发无需 payload
        } else if (
          eventName === UPDATE_EVENTS.STATUS_CHANGED ||
          eventName === UPDATE_EVENTS.PROGRESS ||
          eventName === UPDATE_EVENTS.WILL_RESTART ||
          eventName === UPDATE_EVENTS.ERROR ||
          eventName === DEEPLINK_EVENTS.START
        ) {
          const [msg] = payload
          console.log(eventName, msg) // 保留日志
          this.windowPresenter.sendToAllWindows(eventName, msg)
        } else if (eventName === DEEPLINK_EVENTS.MCP_INSTALL) {
          // Note: DEEPLINK_EVENTS.START is handled above
          // 特殊处理：向默认标签页发送消息，并切换到目标标签页
          const [msg] = payload
          console.log(eventName, msg) // 保留日志
          // Pass true as the second argument to indicate it's an internal event causing tab switch
          this.windowPresenter.sendTodefaultTab(eventName, true, msg)
        } else {
          // 默认处理：直接转发所有 payload 到所有窗口
          this.windowPresenter.sendToAllWindows(eventName, ...payload)
        }
      })
    }

    // 应用主窗口准备就绪时触发初始化
    eventBus.on(WINDOW_EVENTS.READY_TO_SHOW, () => {
      this.init()
    })

    // 统一注册需要转发的事件
    eventsToForward.forEach(forward)
  }
  setupTray() {
    console.info('setupTray', !!this.trayPresenter)
    if (!this.trayPresenter) {
      this.trayPresenter = new TrayPresenter()
    }
    this.trayPresenter.init()
  }

  // 应用初始化逻辑 (主窗口准备就绪后调用)
  init() {
    // 持久化 LLMProviderPresenter 的 Providers 数据
    const providers = this.configPresenter.getProviders()
    this.llmproviderPresenter.setProviders(providers)

    // 同步所有 provider 的自定义模型
    this.syncCustomModels()
  }

  // 从配置中同步自定义模型到 LLMProviderPresenter
  private async syncCustomModels() {
    const providers = this.configPresenter.getProviders()
    for (const provider of providers) {
      if (provider.enable) {
        const customModels = this.configPresenter.getCustomModels(provider.id)
        console.log('syncCustomModels', provider.id, customModels)
        for (const model of customModels) {
          await this.llmproviderPresenter.addCustomModel(provider.id, {
            id: model.id,
            name: model.name,
            contextLength: model.contextLength,
            maxTokens: model.maxTokens
          })
        }
      }
    }
  }

  // 在应用退出时进行清理，关闭数据库连接
  destroy() {
    this.tabPresenter.destroy()
    this.sqlitePresenter.close() // 关闭数据库连接
    this.shortcutPresenter.destroy() // 销毁快捷键监听
    this.syncPresenter.destroy() // 销毁同步相关资源
    this.notificationPresenter.clearAllNotifications() // 清除所有通知
    // 注意: trayPresenter.destroy() 在 main/index.ts 的 will-quit 事件中处理
    // 此处不销毁 trayPresenter，其生命周期由 main/index.ts 管理
  }
}

export const presenter = new Presenter()

// 检查对象属性是否为函数 (用于动态调用)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isFunction(obj: any, prop: string): obj is { [key: string]: (...args: any[]) => any } {
  return typeof obj[prop] === 'function'
}

// IPC 主进程处理程序：动态调用 Presenter 的方法
ipcMain.handle(
  'presenter:call',
  (_event: IpcMainInvokeEvent, name: string, method: string, ...payloads: unknown[]) => {
    try {
      // 通过名称获取对应的 Presenter 实例
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const calledPresenter: any = presenter[name as keyof Presenter]

      if (!calledPresenter) {
        console.warn('calling wrong presenter', name) // 保留警告
        return { error: `Presenter "${name}" not found` }
      }

      // 检查方法是否存在且为函数
      if (isFunction(calledPresenter, method)) {
        // 调用方法并返回结果
        return calledPresenter[method](...payloads)
      } else {
        console.warn('called method is not a function or does not exist', name, method) // 保留警告
        return { error: `Method "${method}" not found or not a function on "${name}"` }
      }
    } catch (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      e: any
    ) {
      console.error('error on presenter handle', e) // 保留错误日志
      return { error: e.message || String(e) }
    }
  }
)

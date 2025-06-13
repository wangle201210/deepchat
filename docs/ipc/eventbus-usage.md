# EventBus 使用指南

## 概述

EventBus 类提供了主进程和渲染进程之间精确的事件通信机制。它继承自 EventEmitter，专注于提供明确的事件发送控制，支持向主进程、渲染进程或特定窗口发送事件。

## 核心理念

- **精确控制**：使用具体的发送方法，明确事件的目标
- **显式发送**：所有跨进程通信都需要明确指定
- **类型安全**：完整的 TypeScript 支持
- **简洁架构**：无复杂的自动转发机制

## 主要方法

### 1. 仅发送到主进程
```typescript
import { eventBus } from '@/main/eventbus'

// 窗口管理、标签页操作等主进程内部事件
eventBus.sendToMain('window:created', windowId)
eventBus.sendToMain('shortcut:create-new-tab', windowId)
```

### 2. 发送到特定窗口
```typescript
import { eventBus } from '@/main/eventbus'

// 发送到指定窗口ID的渲染进程
eventBus.sendToWindow('custom-event', windowId, data)
```

### 3. 发送到渲染进程
```typescript
import { eventBus, SendTarget } from '@/main/eventbus'

// 发送到所有窗口（默认）
eventBus.sendToRenderer('config:language-changed', SendTarget.ALL_WINDOWS, language)

// 发送到默认标签页
eventBus.sendToRenderer('deeplink:mcp-install', SendTarget.DEFAULT_TAB, data)
```

### 4. 同时发送到主进程和渲染进程（推荐）
```typescript
// 最常用的方法：确保主进程和渲染进程都能收到事件
eventBus.send('config:provider-changed', SendTarget.ALL_WINDOWS, providers)
eventBus.send('sync:backup-completed', SendTarget.ALL_WINDOWS, timestamp)
```

## 事件分类指南

### 仅主进程内部
适用于窗口管理、标签页操作等不需要渲染进程知道的事件：
```typescript
eventBus.sendToMain('window:created', windowId)
eventBus.sendToMain('window:focused', windowId)
eventBus.sendToMain('shortcut:create-new-window')
```

### 仅渲染进程
适用于纯 UI 更新，主进程不需要处理的事件：
```typescript
eventBus.sendToRenderer('notification:show-error', SendTarget.ALL_WINDOWS, error)
eventBus.sendToRenderer('ui:theme-changed', SendTarget.ALL_WINDOWS, theme)
```

### 主进程 + 渲染进程
适用于配置变更、状态同步等需要两端都知道的事件：
```typescript
eventBus.send('config:language-changed', SendTarget.ALL_WINDOWS, language)
eventBus.send('sync:backup-started', SendTarget.ALL_WINDOWS)
```

### 特定窗口通信
适用于需要与特定窗口通信的场景：
```typescript
eventBus.sendToWindow('window:specific-action', targetWindowId, actionData)
```

## SendTarget 选项

```typescript
enum SendTarget {
  ALL_WINDOWS = 'all_windows',    // 广播到所有窗口（默认，推荐）
  DEFAULT_TAB = 'default_tab'     // 发送到默认标签页（特殊场景）
}
```

## 初始化和配置

### WindowPresenter 设置
```typescript
import { eventBus } from '@/main/eventbus'
import { WindowPresenter } from '@/main/windowPresenter'

// 在应用初始化时设置 WindowPresenter
const windowPresenter = new WindowPresenter()
eventBus.setWindowPresenter(windowPresenter)
```

## 最佳实践

### 1. 配置变更事件
```typescript
// 在配置更新时，通知所有标签页
setLanguage(language: string) {
  this.setSetting('language', language)
  eventBus.send('config:language-changed', SendTarget.ALL_WINDOWS, language)
}
```

### 2. 窗口管理事件
```typescript
// 窗口相关事件通常只需要主进程知道
onWindowCreated(windowId: number) {
  eventBus.sendToMain('window:created', windowId)
}
```

### 3. 用户交互事件
```typescript
// 快捷键等用户操作，可能需要发送到特定目标
onZoomIn() {
  // 缩放需要所有窗口响应
  eventBus.send('shortcut:zoom-in', SendTarget.ALL_WINDOWS)
}
```

### 4. 错误处理事件
```typescript
// 明确指定错误事件的发送目标
onStreamError(error: Error) {
  // 主进程记录错误
  eventBus.sendToMain('stream:error-logged', error)
  // 渲染进程显示错误
  eventBus.sendToRenderer('stream:error-display', SendTarget.ALL_WINDOWS, error)
}
```

### 5. 流事件处理
```typescript
// 处理各种流事件，明确指定发送目标
handleConversationEvents() {
  // 会话激活 - 通知所有窗口更新UI
  eventBus.send('conversation:activated', SendTarget.ALL_WINDOWS, conversationId)

  // 消息编辑 - 通知所有窗口
  eventBus.send('conversation:message-edited', SendTarget.ALL_WINDOWS, messageData)
}

// MCP 服务器事件
handleMCPEvents() {
  // MCP 服务器启动 - 通知主进程和所有窗口
  eventBus.send('mcp:server-started', SendTarget.ALL_WINDOWS, serverInfo)

  // 配置变更 - 通知所有窗口
  eventBus.send('mcp:config-changed', SendTarget.ALL_WINDOWS, newConfig)
}
```

## 类型安全

EventBus 完全支持 TypeScript，提供完整的类型检查：

```typescript
// 明确的参数类型
eventBus.send('config:changed', SendTarget.ALL_WINDOWS, {
  key: 'language',
  value: 'zh-CN'
})

// 安全的枚举使用
eventBus.sendToRenderer('ui:update', SendTarget.DEFAULT_TAB, data)
```

## 注意事项

1. **WindowPresenter 依赖**：发送到渲染进程需要先设置 WindowPresenter
2. **显式发送**：所有跨进程通信都需要明确调用相应的方法
3. **事件命名规范**：建议使用 `模块:动作` 的命名格式
4. **参数类型**：确保传递的参数可以被序列化
5. **错误处理**：监听控制台警告，确保 WindowPresenter 正确设置
6. **性能考虑**：避免频繁发送大型对象到渲染进程

## 常见场景示例

### 配置系统
```typescript
class ConfigManager {
  updateLanguage(language: string) {
    this.saveConfig('language', language)
    // 明确通知所有窗口更新语言
    eventBus.send('config:language-changed', SendTarget.ALL_WINDOWS, language)
  }
}
```

### 通知系统
```typescript
class NotificationManager {
  showError(message: string) {
    // 仅向渲染进程发送通知显示事件
    eventBus.sendToRenderer('notification:show-error', SendTarget.ALL_WINDOWS, message)
  }
}
```

### 快捷键处理
```typescript
class ShortcutManager {
  handleGoSettings() {
    // 通知渲染进程跳转到设置页面
    eventBus.sendToRenderer('shortcut:go-settings', SendTarget.ALL_WINDOWS)
  }

  handleCleanHistory() {
    // 主进程清理历史，然后通知渲染进程更新UI
    this.cleanHistoryInMain()
    eventBus.sendToRenderer('shortcut:clean-chat-history', SendTarget.ALL_WINDOWS)
  }
}
```

## 调试技巧

```typescript
// 监听主进程事件进行调试
eventBus.on('*', (eventName, ...args) => {
  console.log(`Main process event: ${eventName}`, args)
})

// 检查 WindowPresenter 状态
if (!eventBus.windowPresenter) {
  console.warn('WindowPresenter not set, renderer events will not work')
}
```

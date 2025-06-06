# EventBus 重构总结

## 🎯 重构目标

构建一个清晰、高效的事件通信机制，支持主进程和渲染进程之间的精确事件传递。通过继承 EventEmitter 保持向后兼容，同时提供现代化的事件发送方法和自动转发机制。

## 🚀 主要功能特性

### 1. EventBus 核心架构

- **继承 EventEmitter**：完全兼容原生事件系统
- **精确的发送方法**：
  - `sendToMain(eventName, ...args)`：仅发送到主进程
  - `sendToWindow(eventName, windowId, ...args)`：发送到特定窗口
  - `sendToRenderer(eventName, target, ...args)`：发送到渲染进程
  - `send(eventName, target, ...args)`：同时发送到主进程和渲染进程
- **智能的 emit() 重写**：自动转发预定义事件到渲染进程
- **WindowPresenter 集成**：通过标准接口管理渲染进程通信

### 2. SendTarget 枚举定义

```typescript
enum SendTarget {
  MAIN = 'main',                  // 主进程（内部标识）
  RENDERER = 'renderer',          // 渲染进程（内部标识）
  ALL_WINDOWS = 'all_windows',    // 广播到所有窗口（默认推荐）
  DEFAULT_TAB = 'default_tab'     // 发送到默认标签页（特殊场景）
}
```

### 3. 自动转发事件系统

通过 `DEFAULT_RENDERER_EVENTS` 常量集合定义需要自动转发的事件：

```typescript
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
```

## 📊 事件通信模式

### 主进程内部通信
适用于窗口管理、系统级操作等场景：
```typescript
// 窗口生命周期管理
eventBus.sendToMain('window:created', windowId)
eventBus.sendToMain('window:focused', windowId)
eventBus.sendToMain('window:blurred', windowId)

// 快捷键触发的主进程操作
eventBus.sendToMain('shortcut:create-new-window')
eventBus.sendToMain('shortcut:create-new-tab', windowId)
eventBus.sendToMain('shortcut:close-current-tab', windowId)
```

### 渲染进程通信
适用于 UI 更新、用户界面响应等场景：
```typescript
// 配置变更通知
eventBus.sendToRenderer('config:language-changed', SendTarget.ALL_WINDOWS, language)
eventBus.sendToRenderer('config:theme-changed', SendTarget.ALL_WINDOWS, theme)

// 特定窗口操作
eventBus.sendToWindow('window:specific-update', targetWindowId, data)

// 默认标签页操作
eventBus.sendToRenderer('deeplink:mcp-install', SendTarget.DEFAULT_TAB, installData)
```

### 双向通信（推荐）
适用于需要主进程和渲染进程同时响应的场景：
```typescript
// 配置系统事件
eventBus.send('config:provider-changed', SendTarget.ALL_WINDOWS, providerConfig)
eventBus.send('config:model-list-updated', SendTarget.ALL_WINDOWS, modelList)

// 同步系统事件
eventBus.send('sync:backup-started', SendTarget.ALL_WINDOWS, backupInfo)
eventBus.send('sync:backup-completed', SendTarget.ALL_WINDOWS, result)

// 用户界面缩放
eventBus.send('shortcut:zoom-in', SendTarget.ALL_WINDOWS)
eventBus.send('shortcut:zoom-out', SendTarget.ALL_WINDOWS)
```

### 自动转发事件
利用 emit() 的智能转发机制：
```typescript
// 这些事件会自动转发到渲染进程
eventBus.emit('stream:error', errorData)           // 自动转发
eventBus.emit('mcp:server-started', serverInfo)    // 自动转发
eventBus.emit('notification:show-error', error)    // 自动转发

// 其他事件仅在主进程内部
eventBus.emit('internal:custom-event', data)       // 仅主进程
```

## 🔧 架构优势

### 简化的初始化
```typescript
// 构造函数无需复杂参数
export const eventBus = new EventBus()

// 运行时设置 WindowPresenter
eventBus.setWindowPresenter(windowPresenter)
```

### 类型安全保障
- 完全移除 `any` 类型使用
- 参数类型明确定义：`...args: unknown[]`
- 枚举类型提供编译时检查
- TypeScript 智能提示支持

### 错误处理机制
```typescript
// 内置的错误检查和警告
sendToRenderer(eventName: string, target: SendTarget = SendTarget.ALL_WINDOWS, ...args: unknown[]) {
  if (!this.windowPresenter) {
    console.warn('WindowPresenter not available, cannot send to renderer')
    return
  }
  // ... 发送逻辑
}
```

## 🎨 实际应用场景

### 配置管理系统
```typescript
class ConfigManager {
  updateLanguage(language: string) {
    this.saveConfig('language', language)
    // 通知所有界面更新语言
    eventBus.send('config:language-changed', SendTarget.ALL_WINDOWS, language)
  }

  updateProvider(provider: ProviderConfig) {
    this.saveConfig('provider', provider)
    // 通知主进程和所有界面
    eventBus.send('config:provider-changed', SendTarget.ALL_WINDOWS, provider)
  }
}
```

### 窗口管理系统
```typescript
class WindowManager {
  createWindow() {
    const windowId = this.doCreateWindow()
    // 仅通知主进程
    eventBus.sendToMain('window:created', windowId)
  }

  focusWindow(windowId: number) {
    this.doFocusWindow(windowId)
    // 仅通知主进程
    eventBus.sendToMain('window:focused', windowId)
  }

  notifySpecificWindow(windowId: number, data: any) {
    // 向特定窗口发送消息
    eventBus.sendToWindow('window:notification', windowId, data)
  }
}
```

### 错误处理系统
```typescript
class ErrorHandler {
  handleStreamError(error: Error) {
    // 利用自动转发显示错误
    eventBus.emit('stream:error', {
      message: error.message,
      timestamp: Date.now()
    })
  }

  showUserNotification(message: string) {
    // 仅发送到渲染进程显示通知
    eventBus.sendToRenderer('notification:show-error', SendTarget.ALL_WINDOWS, message)
  }
}
```

## 🎯 性能优化

### 智能事件过滤
- 只有预定义事件才会自动转发
- 避免不必要的进程间通信开销
- 减少渲染进程的事件处理负担

### 目标精确控制
- 支持发送到特定窗口而非广播
- 可选择发送到默认标签页
- 避免无效的事件传播

### 错误预防机制
- WindowPresenter 状态检查
- 控制台警告提示
- 优雅的错误降级处理

## 🔄 兼容性保障

### 向后兼容
- 完全保持 EventEmitter 的所有原生功能
- emit() 方法仍然可用，只是增加了自动转发逻辑
- 现有的事件监听器无需修改

### 渐进式升级
- 可以逐步从 emit() 迁移到具体的 send 方法
- 新功能不影响现有代码运行
- 清晰的迁移路径和最佳实践指导

## 🎉 重构成果总结

这次 EventBus 重构成功实现了：

1. **架构清晰化**：明确区分主进程、渲染进程和双向通信
2. **功能完善化**：支持特定窗口通信和灵活的目标选择
3. **开发体验优化**：完整的 TypeScript 支持和错误处理
4. **性能提升**：智能的事件过滤和精确的目标控制
5. **兼容性保障**：平滑的升级路径和向后兼容

特别重要的改进：
- **自动转发机制**：预定义事件自动同步到渲染进程
- **精确目标控制**：可以选择发送到所有窗口或特定窗口
- **类型安全**：完整的 TypeScript 类型定义
- **错误处理**：内置的状态检查和友好的错误提示
- **简化配置**：无需复杂的初始化，运行时动态设置

现在的 EventBus 不仅功能更强大，而且更加易用和可维护，为应用的事件通信提供了坚实的基础。

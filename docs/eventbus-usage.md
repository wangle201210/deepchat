# EventBus 使用指南

## 概述

新的 EventBus 类提供了更优雅的主进程和渲染进程之间的事件通信机制。推荐使用具体的 `send` 系列方法来精确控制事件的发送目标。

## 核心理念

- **精确控制**：使用具体的发送方法，明确事件的目标
- **逐步废弃 emit**：推荐使用 `send()` 系列方法替代 `emit()`
- **简化配置**：无需手动注册事件，常见事件已预定义

## 主要方法

### 1. 仅发送到主进程
```typescript
import { eventBus } from '@/eventbus'

// 窗口管理、标签页操作等主进程内部事件
eventBus.sendToMain('window:created', windowId)
eventBus.sendToMain('shortcut:create-new-tab', windowId)
```

### 2. 仅发送到渲染进程
```typescript
import { eventBus, SendTarget } from '@/eventbus'

// 发送到所有窗口（默认）
eventBus.sendToRenderer('config:language-changed', SendTarget.ALL_WINDOWS, language)

// 发送到默认标签页
eventBus.sendToRenderer('deeplink:mcp-install', SendTarget.DEFAULT_TAB, data)
```

### 3. 同时发送到主进程和渲染进程（推荐）
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
```

### 主进程 + 渲染进程
适用于配置变更、状态同步等需要两端都知道的事件：
```typescript
eventBus.send('config:language-changed', SendTarget.ALL_WINDOWS, language)
eventBus.send('sync:backup-started', SendTarget.ALL_WINDOWS)
```

## SendTarget 选项

```typescript
enum SendTarget {
  ALL_WINDOWS = 'all_windows',    // 广播到所有窗口（默认，推荐）
  DEFAULT_TAB = 'default_tab'     // 发送到默认标签页（特殊场景）
}
```

## 迁移指南

### ❌ 旧方式（逐步废弃）
```typescript
// 不推荐：复杂的手动转发
eventBus.on('my-event', (data) => {
  windowPresenter.sendToAllWindows('my-event', data)
})

// 不推荐：使用 emit（缺乏明确性）
eventBus.emit('my-event', data)
```

### ✅ 新方式（推荐）
```typescript
// 推荐：明确的发送目标
eventBus.send('my-event', SendTarget.ALL_WINDOWS, data)

// 或者更具体的方法
eventBus.sendToMain('internal-event', data)
eventBus.sendToRenderer('ui-update', SendTarget.ALL_WINDOWS, data)
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

## 预定义的自动转发事件

以下事件在使用 `emit()` 时会自动转发到渲染进程：
- `stream:error`
- `conversation:activated`
- `conversation:deactivated`
- `conversation:message-edited`
- `mcp:server-started`
- `mcp:server-stopped`
- `mcp:config-changed`
- `mcp:tool-call-result`
- `ollama:pull-model-progress`
- `notification:show-error`
- `shortcut:go-settings`
- `shortcut:clean-chat-history`

## 注意事项

1. **推荐使用 `send()` 方法**：明确指定事件的发送目标
2. **逐步废弃 `emit()`**：虽然仍可使用，但缺乏明确性
3. **无需手动配置**：常见事件已预定义，无需手动注册
4. **类型安全**：使用 TypeScript 获得更好的开发体验

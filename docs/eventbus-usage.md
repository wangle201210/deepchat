# EventBus 使用指南

## 概述

新的 EventBus 类提供了更优雅的主进程和渲染进程之间的事件通信机制。

## 主要功能

### 1. 发送到主进程
```typescript
import { eventBus } from '@/eventbus'

// 仅发送到主进程
eventBus.sendToMain('my-event', data)
```

### 2. 发送到渲染进程
```typescript
import { eventBus, SendTarget } from '@/eventbus'

// 发送到所有窗口（默认）
eventBus.sendToRenderer('my-event', SendTarget.ALL_WINDOWS, data)

// 发送到默认标签页
eventBus.sendToRenderer('my-event', SendTarget.DEFAULT_TAB, data)
```

### 3. 同时发送到主进程和渲染进程
```typescript
// 使用 send 方法（推荐）
eventBus.send('my-event', SendTarget.ALL_WINDOWS, data)

// 使用 emit 方法（如果事件已注册为 renderer 事件）
eventBus.emit('my-event', data)
```

## 配置

### 注册渲染进程事件
```typescript
// 单个事件
eventBus.addRendererEvent('my-event')

// 批量注册
eventBus.registerRendererEvents([
  'event1',
  'event2',
  'event3'
])
```

### 设置 WindowPresenter
```typescript
eventBus.setWindowPresenter(windowPresenter)
```

## 迁移指南

### 旧方式
```typescript
// 之前的复杂转发逻辑
eventBus.on('my-event', (data) => {
  windowPresenter.sendToAllWindows('my-event', data)
})
```

### 新方式
```typescript
// 1. 注册事件
eventBus.addRendererEvent('my-event')

// 2. 直接使用 emit（自动转发）
eventBus.emit('my-event', data)

// 或者显式发送
eventBus.send('my-event', SendTarget.ALL_WINDOWS, data)
```

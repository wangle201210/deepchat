# EventBus 重构总结

## 🎯 重构目标

将原本复杂的事件转发逻辑重构为更优雅、更清晰的事件通信机制，明确区分主进程内部通信和主进程到渲染进程的通信，推进使用精确的发送方法替代模糊的 `emit()`。

## 🚀 主要改进

### 1. EventBus 类优化

- **继承 EventEmitter**：保持向后兼容性
- **精确的发送方法**：
  - `sendToMain()`：仅发送到主进程
  - `sendToRenderer()`：发送到渲染进程（支持指定目标）
  - `send()`：同时发送到主进程和渲染进程（推荐）
- **简化的 emit()**：默认发送到两端，但推荐废弃使用
- **预定义事件常量**：无需手动注册，常见事件已内置

### 2. SendTarget 枚举

```typescript
enum SendTarget {
  ALL_WINDOWS = 'all_windows',    // 广播到所有窗口（默认）
  DEFAULT_TAB = 'default_tab'     // 发送到默认标签页
}
```

### 3. 设计理念转变

- **从动态配置到静态定义**：移除复杂的事件注册逻辑
- **从模糊到精确**：推荐使用具体的 `send` 方法
- **从复杂到简单**：WindowPresenter 通过标准方式设置

## 📊 事件分类处理

### 配置相关事件（需要通知所有标签页）
✅ **已优化为直接发送**：
- `CONFIG_EVENTS.LANGUAGE_CHANGED` - 语言变更
- `CONFIG_EVENTS.SOUND_ENABLED_CHANGED` - 音效开关
- `CONFIG_EVENTS.COPY_WITH_COT_CHANGED` - 拷贝设置
- `CONFIG_EVENTS.MODEL_LIST_CHANGED` - 模型列表变更
- `CONFIG_EVENTS.MODEL_STATUS_CHANGED` - 模型状态变更
- `CONFIG_EVENTS.PROVIDER_CHANGED` - 提供商变更
- `CONFIG_EVENTS.PROXY_MODE_CHANGED` - 代理模式变更
- `CONFIG_EVENTS.CUSTOM_PROXY_URL_CHANGED` - 自定义代理地址
- `CONFIG_EVENTS.ARTIFACTS_EFFECT_CHANGED` - 动画效果设置
- `CONFIG_EVENTS.SYNC_SETTINGS_CHANGED` - 同步设置变更
- `CONFIG_EVENTS.SEARCH_ENGINES_UPDATED` - 搜索引擎更新
- `CONFIG_EVENTS.CONTENT_PROTECTION_CHANGED` - 投屏保护设置
- `CONFIG_EVENTS.CUSTOM_PROMPTS_CHANGED` - 自定义提示词变更
- `SYSTEM_EVENTS.SYSTEM_THEME_UPDATED` - 系统主题更新

### OAuth 相关事件（需要通知所有标签页）
✅ **已优化为直接发送**：
- `CONFIG_EVENTS.OAUTH_LOGIN_START` - OAuth 登录开始
- `CONFIG_EVENTS.OAUTH_LOGIN_SUCCESS` - OAuth 登录成功
- `CONFIG_EVENTS.OAUTH_LOGIN_ERROR` - OAuth 登录失败

### 同步相关事件（需要通知所有标签页）
✅ **已优化为直接发送**：
- `SYNC_EVENTS.BACKUP_STARTED` - 备份开始
- `SYNC_EVENTS.BACKUP_COMPLETED` - 备份完成
- `SYNC_EVENTS.BACKUP_ERROR` - 备份错误
- `SYNC_EVENTS.IMPORT_STARTED` - 导入开始
- `SYNC_EVENTS.IMPORT_COMPLETED` - 导入完成
- `SYNC_EVENTS.IMPORT_ERROR` - 导入错误

### 快捷键相关事件
✅ **已优化分类处理**：
- `SHORTCUT_EVENTS.ZOOM_IN` - 放大字体（所有窗口）
- `SHORTCUT_EVENTS.ZOOM_OUT` - 缩小字体（所有窗口）
- `SHORTCUT_EVENTS.ZOOM_RESUME` - 重置字体（所有窗口）
- `SHORTCUT_EVENTS.CREATE_NEW_WINDOW` - 创建新窗口（主进程）
- `SHORTCUT_EVENTS.CREATE_NEW_TAB` - 创建新标签页（主进程）
- `SHORTCUT_EVENTS.CLOSE_CURRENT_TAB` - 关闭当前标签页（主进程）

### 通知相关事件
✅ **已优化为直接发送**：
- `NOTIFICATION_EVENTS.SYS_NOTIFY_CLICKED` - 系统通知点击（所有窗口）

### 窗口相关事件（主进程内部）
✅ **已优化为主进程内部**：
- `WINDOW_EVENTS.WINDOW_CREATED` - 窗口创建
- `WINDOW_EVENTS.WINDOW_FOCUSED` - 窗口获得焦点
- `WINDOW_EVENTS.WINDOW_BLURRED` - 窗口失去焦点

### 预定义自动转发事件
✅ **内置常量定义**：
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

## 🔧 重构成果

### 架构简化
- **移除动态配置**：事件类型预定义，无需手动注册
- **简化初始化**：构造函数无需参数
- **标准化设置**：WindowPresenter 通过标准方法设置

### 代码质量提升
- **精确控制**：推荐使用具体的 `send` 方法
- **类型安全**：完全移除 `any` 类型使用
- **废弃警告**：为过时方法添加 `@deprecated` 标记

### 可维护性提升
- **清晰的分类**：主进程 vs 渲染进程事件
- **预定义常量**：减少配置复杂性
- **渐进式迁移**：保持向后兼容，逐步推进使用新方法

## 🎨 推荐用法

### 现代化写法（推荐）
```typescript
// 配置变更：通知所有标签页
eventBus.send('config:language-changed', SendTarget.ALL_WINDOWS, language)

// 窗口管理：仅主进程内部
eventBus.sendToMain('window:created', windowId)

// UI 更新：仅渲染进程
eventBus.sendToRenderer('notification:show-error', SendTarget.ALL_WINDOWS, error)

// 特殊操作：发送到默认标签页
eventBus.sendToRenderer('deeplink:mcp-install', SendTarget.DEFAULT_TAB, data)
```

### 传统写法（逐步废弃）
```typescript
// 仍可使用，但缺乏明确性
eventBus.emit('some-event', data)
```

## 🎉 总结

这次优化成功地：

1. **简化了架构**：从复杂的动态配置转为简单的静态定义
2. **提高了精确性**：推荐使用明确的发送方法
3. **改善了开发体验**：减少配置，专注业务逻辑
4. **保持了兼容性**：渐进式迁移，不破坏现有代码
5. **解决了核心问题**：**语言变更等设置项现在能够正确广播到所有标签页**

特别重要的是，现在的设计更加清晰和可预测：
- 配置变更事件自动通知所有界面
- 窗口管理事件仅在主进程内部流转
- 开发者可以精确控制事件的发送目标
- 无需复杂的事件注册和配置

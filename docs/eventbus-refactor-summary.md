# EventBus 重构总结

## 🎯 重构目标

将原本复杂的事件转发逻辑重构为更优雅、更清晰的事件通信机制，明确区分主进程内部通信和主进程到渲染进程的通信。

## 🚀 主要改进

### 1. EventBus 类扩展

- **继承 EventEmitter**：保持向后兼容性
- **新增方法**：
  - `sendToMain()`：仅发送到主进程
  - `sendToRenderer()`：发送到渲染进程（支持指定目标）
  - `send()`：同时发送到主进程和渲染进程
  - 重写 `emit()`：自动转发已注册的渲染进程事件

### 2. SendTarget 枚举

```typescript
enum SendTarget {
  ALL_WINDOWS = 'all_windows',    // 广播到所有窗口（默认）
  DEFAULT_TAB = 'default_tab'     // 发送到默认标签页
}
```

### 3. 事件分类处理

#### 配置相关事件（需要通知所有标签页）
- ✅ `CONFIG_EVENTS.LANGUAGE_CHANGED` - 语言变更
- ✅ `CONFIG_EVENTS.SOUND_ENABLED_CHANGED` - 音效开关
- ✅ `CONFIG_EVENTS.COPY_WITH_COT_CHANGED` - 拷贝设置
- ✅ `CONFIG_EVENTS.MODEL_LIST_CHANGED` - 模型列表变更
- ✅ `CONFIG_EVENTS.MODEL_STATUS_CHANGED` - 模型状态变更
- ✅ `CONFIG_EVENTS.PROVIDER_CHANGED` - 提供商变更
- ✅ `CONFIG_EVENTS.PROXY_MODE_CHANGED` - 代理模式变更
- ✅ `CONFIG_EVENTS.CUSTOM_PROXY_URL_CHANGED` - 自定义代理地址
- ✅ `CONFIG_EVENTS.ARTIFACTS_EFFECT_CHANGED` - 动画效果设置
- ✅ `CONFIG_EVENTS.SYNC_SETTINGS_CHANGED` - 同步设置变更
- ✅ `CONFIG_EVENTS.SEARCH_ENGINES_UPDATED` - 搜索引擎更新
- ✅ `CONFIG_EVENTS.CONTENT_PROTECTION_CHANGED` - 投屏保护设置
- ✅ `CONFIG_EVENTS.CUSTOM_PROMPTS_CHANGED` - 自定义提示词变更
- ✅ `SYSTEM_EVENTS.SYSTEM_THEME_UPDATED` - 系统主题更新

#### OAuth 相关事件（需要通知所有标签页）
- ✅ `CONFIG_EVENTS.OAUTH_LOGIN_START` - OAuth 登录开始
- ✅ `CONFIG_EVENTS.OAUTH_LOGIN_SUCCESS` - OAuth 登录成功
- ✅ `CONFIG_EVENTS.OAUTH_LOGIN_ERROR` - OAuth 登录失败

#### 同步相关事件（需要通知所有标签页）
- ✅ `SYNC_EVENTS.BACKUP_STARTED` - 备份开始
- ✅ `SYNC_EVENTS.BACKUP_COMPLETED` - 备份完成
- ✅ `SYNC_EVENTS.BACKUP_ERROR` - 备份错误
- ✅ `SYNC_EVENTS.IMPORT_STARTED` - 导入开始
- ✅ `SYNC_EVENTS.IMPORT_COMPLETED` - 导入完成
- ✅ `SYNC_EVENTS.IMPORT_ERROR` - 导入错误

#### 快捷键相关事件
- ✅ `SHORTCUT_EVENTS.ZOOM_IN` - 放大字体（所有窗口）
- ✅ `SHORTCUT_EVENTS.ZOOM_OUT` - 缩小字体（所有窗口）
- ✅ `SHORTCUT_EVENTS.ZOOM_RESUME` - 重置字体（所有窗口）
- ✅ `SHORTCUT_EVENTS.CREATE_NEW_WINDOW` - 创建新窗口（主进程）
- ✅ `SHORTCUT_EVENTS.CREATE_NEW_TAB` - 创建新标签页（主进程）
- ✅ `SHORTCUT_EVENTS.CLOSE_CURRENT_TAB` - 关闭当前标签页（主进程）

#### 通知相关事件
- ✅ `NOTIFICATION_EVENTS.SYS_NOTIFY_CLICKED` - 系统通知点击（所有窗口）

#### 窗口相关事件（主进程内部）
- ✅ `WINDOW_EVENTS.WINDOW_CREATED` - 窗口创建
- ✅ `WINDOW_EVENTS.WINDOW_FOCUSED` - 窗口获得焦点
- ✅ `WINDOW_EVENTS.WINDOW_BLURRED` - 窗口失去焦点

#### 特殊处理事件（保持原有逻辑）
- ✅ `STREAM_EVENTS.RESPONSE` - 流响应（删除原始数据）
- ✅ `STREAM_EVENTS.END` - 流结束（日志记录）
- ✅ `UPDATE_EVENTS.*` - 更新相关事件（日志记录）
- ✅ `DEEPLINK_EVENTS.START` - 深链接开始（日志记录）
- ✅ `DEEPLINK_EVENTS.MCP_INSTALL` - MCP 安装（发送到默认标签页）

## 📊 重构成果

### 代码简化
- **移除复杂的转发逻辑**：原本 40+ 行的复杂 `forward` 函数被简化
- **分离关注点**：每个 presenter 负责自己的事件发送
- **减少重复代码**：统一的事件发送接口

### 类型安全
- **明确的接口定义**：`IWindowPresenter` 接口
- **类型化参数**：使用 `unknown[]` 替代 `any[]`
- **枚举类型**：`SendTarget` 枚举提供类型安全

### 可维护性提升
- **清晰的事件分类**：主进程 vs 渲染进程事件
- **统一的发送方式**：`send()`, `sendToMain()`, `sendToRenderer()`
- **自动转发机制**：注册后自动处理的事件

### 性能优化
- **减少事件监听器**：移除不必要的转发监听器
- **精确的目标定位**：支持发送到特定标签页

## 🔧 使用示例

```typescript
// 仅发送到主进程（窗口管理等）
eventBus.sendToMain('window:created', windowId)

// 发送到所有渲染进程窗口（配置变更等）
eventBus.send('config:language-changed', SendTarget.ALL_WINDOWS, language)

// 发送到默认标签页（特殊操作）
eventBus.sendToRenderer('deeplink:mcp-install', SendTarget.DEFAULT_TAB, data)

// 自动转发（如果事件已注册）
eventBus.emit('config:provider-changed')
```

## 🎉 总结

这次重构成功地：
1. **简化了事件处理逻辑**：从复杂的条件判断转为清晰的分类处理
2. **提高了代码可读性**：每个事件的处理意图更加明确
3. **增强了类型安全**：减少了 `any` 类型的使用
4. **改善了可维护性**：新增事件时更容易确定处理方式
5. **保持了向后兼容**：现有代码无需大幅修改

特别重要的是，**语言变更等设置项事件现在能够正确广播到所有标签页**，解决了之前配置变更不能及时同步到所有界面的问题。

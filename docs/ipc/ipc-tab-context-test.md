# IPC Tab上下文功能测试

## 测试目标

验证多tab环境下IPC调用能够正确识别调用来源并提供精确的事件路由。

## 测试场景

### 1. 基础Tab上下文识别

- **目标**: 验证主进程能正确通过webContentsId识别tab
- **步骤**:
  1. 创建多个tab
  2. 在不同tab中调用presenter方法
  3. 检查日志中的tab ID标识是否正确

### 2. 事件精确路由

- **目标**: 验证EventBus能将事件发送到正确的tab
- **步骤**:
  1. 在tab A中触发需要回调的操作
  2. 验证回调事件只发送到tab A，不影响其他tab

### 3. 错误处理增强

- **目标**: 验证错误日志包含正确的tab上下文
- **步骤**:
  1. 在不同tab中触发错误情况
  2. 检查错误日志是否包含正确的tab ID信息

## 验证点

### 主进程日志格式

```
[IPC Call] Tab:123 Window:456 -> presenterName.methodName
[IPC Warning] Tab:123 calling wrong presenter: invalidName
[IPC Error] Tab:123 presenterName.methodName: Error message
```

### 渲染进程日志格式

```
[Renderer IPC] WebContents:789 -> presenterName.methodName
[Renderer IPC Error] WebContents:789 presenterName.methodName: Error message
```

### EventBus新功能验证

- `eventBus.sendToTab(tabId, eventName, ...args)` - 发送到指定tab
- `eventBus.sendToActiveTab(windowId, eventName, ...args)` - 发送到活跃tab
- `eventBus.broadcastToTabs(tabIds, eventName, ...args)` - 广播到多个tab

## 预期结果

1. 所有IPC调用日志都包含正确的tab标识
2. 事件能够精确路由到目标tab
3. 不再出现tab间事件错乱问题
4. 错误追踪更加精准

## 回归测试

确保以下现有功能不受影响：

- 单tab环境下的正常运行
- 现有的广播事件机制
- WindowPresenter的功能
- 所有presenter的现有API接口

## 性能验证

- IPC调用延迟不应显著增加
- 内存使用应保持稳定
- Tab创建/销毁的性能不受影响

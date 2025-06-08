# 多Tab IPC通信优化实施方案

## 方案概述

本方案采用**渐进式优化**策略，确保向后兼容的同时逐步解决多tab环境下的IPC通信问题。

## 实施阶段

### 阶段一: 增强型Tab上下文识别 (短期 - 1-2周)

#### 目标

- 在现有架构基础上添加tab上下文识别
- 实现精确的tab级事件路由
- 保持完全向后兼容

#### 具体实施

##### 1. 扩展 `presenter:call` 协议

```typescript
// 新的调用协议结构
interface PresenterCallRequest {
  tabId?: number // 调用来源tab ID
  windowId?: number // 调用来源窗口 ID
  name: string // presenter名称
  method: string // 方法名
  payloads: unknown[] // 参数
}
```

##### 2. 改进 `usePresenter.ts`

- 自动注入当前tab上下文信息
- 支持新旧协议的兼容处理
- 增强错误处理和日志记录

##### 3. 升级主进程IPC处理器

- 解析tab上下文信息
- 建立调用来源映射
- 改进错误响应机制

##### 4. 扩展 EventBus 功能

- 添加 `sendToTab(tabId, eventName, ...args)` 方法
- 添加 `sendToWindow(windowId, eventName, ...args)` 方法
- 保持现有广播机制的兼容性

#### 预期效果

- 解决90%的tab间事件错乱问题
- 提供清晰的调用链路追踪
- 为后续优化奠定基础

### 阶段二: IPC通道管理优化 (中期 - 2-3周)

#### 目标

- 实现基于tab的IPC通道隔离
- 优化性能和资源使用
- 支持更复杂的多tab场景

#### 具体实施

##### 1. 设计Tab级IPC管理器

```typescript
class TabIPCManager {
  private tabChannels: Map<number, IPCChannel>

  createTabChannel(tabId: number): IPCChannel
  destroyTabChannel(tabId: number): void
  getTabChannel(tabId: number): IPCChannel | null
}
```

##### 2. 实现Presenter上下文隔离

- 支持tab级别的presenter状态
- 实现tab间数据隔离
- 提供共享状态管理机制

##### 3. 优化事件订阅机制

- 支持tab级事件订阅
- 实现智能事件路由
- 减少不必要的事件传播

#### 预期效果

- 完全消除tab间干扰
- 提升系统性能和稳定性
- 支持复杂的多tab业务逻辑

### 阶段三: 架构现代化升级 (长期 - 3-4周)

#### 目标

- 采用现代化IPC架构设计
- 支持未来扩展需求
- 提供最佳的开发体验

#### 具体实施

##### 1. 设计新一代IPC协议

- 支持异步流式通信
- 内置错误处理和重试机制
- 支持类型安全的接口定义

##### 2. 实现智能路由系统

- 基于规则的事件路由
- 动态负载均衡
- 支持插件化扩展

##### 3. 建立完整的监控体系

- IPC调用性能监控
- 错误统计和分析
- 开发调试工具集成

## 技术实现细节

### 1. Tab上下文获取策略

#### WebContents ID映射方案

```typescript
// 在 TabPresenter 中维护映射关系
private webContentsToTabId: Map<number, number> = new Map();

// 在创建tab时建立映射
async createTab(windowId: number, url: string, options: TabCreateOptions) {
  const view = new WebContentsView(/* ... */);
  const tabId = view.webContents.id;
  this.webContentsToTabId.set(view.webContents.id, tabId);
  // ...
}

// 在IPC处理器中获取tabId
ipcMain.handle('presenter:call', (event, ...args) => {
  const webContentsId = event.sender.id;
  const tabId = presenter.tabPresenter.getTabIdByWebContentsId(webContentsId);
  // ...
});

// 在渲染进程中通过preload API获取webContentsId (已有实现)
const webContentsId = window.api.getWebContentsId();
// 主进程自动通过webContentsId映射到tabId和windowId
```

### 2. 事件路由实现

#### EventBus扩展设计

```typescript
export class EventBus extends EventEmitter {
  // 新增方法
  sendToTab(tabId: number, eventName: string, ...args: unknown[]) {
    const tabView = this.getTabView(tabId)
    if (tabView && !tabView.webContents.isDestroyed()) {
      tabView.webContents.send(eventName, ...args)
    }
  }

  sendToActiveTab(windowId: number, eventName: string, ...args: unknown[]) {
    const activeTabId = this.getActiveTabId(windowId)
    if (activeTabId) {
      this.sendToTab(activeTabId, eventName, ...args)
    }
  }

  broadcastToTabs(tabIds: number[], eventName: string, ...args: unknown[]) {
    tabIds.forEach((tabId) => this.sendToTab(tabId, eventName, ...args))
  }
}
```

### 3. 错误处理和日志增强

#### 错误上下文结构

```typescript
interface IPCError {
  tabId?: number
  windowId?: number
  presenterName: string
  methodName: string
  timestamp: number
  error: Error
  callStack?: string
}
```

#### 日志记录策略

```typescript
class IPCLogger {
  logCall(context: IPCCallContext) {
    console.log(`[IPC Call] Tab:${context.tabId} -> ${context.presenterName}.${context.methodName}`)
  }

  logError(error: IPCError) {
    console.error(
      `[IPC Error] Tab:${error.tabId} ${error.presenterName}.${error.methodName}:`,
      error.error
    )
  }
}
```

## 兼容性保证

### 1. 渐进式升级路径

- 阶段一完全兼容现有代码
- 阶段二提供迁移工具和指南
- 阶段三支持新旧协议并存

### 2. API兼容性保证

```typescript
// 保持现有API不变
export function usePresenter<T extends keyof IPresenter>(name: T): IPresenter[T] {
  // 内部升级，外部接口不变
  return createEnhancedProxy(name)
}
```

### 3. 配置化升级

```typescript
// 通过配置控制新功能的启用
interface IPCConfig {
  enableTabContext: boolean
  enableAdvancedRouting: boolean
  enablePerformanceMonitoring: boolean
}
```

## 测试策略

### 1. 单元测试覆盖

- IPC调用路由正确性
- 事件分发准确性
- 错误处理完整性

### 2. 集成测试场景

- 多tab并发操作
- tab切换状态一致性
- 窗口关闭资源清理

### 3. 性能测试指标

- IPC调用延迟
- 内存使用优化
- 事件处理吞吐量

## 风险控制

### 1. 回滚机制

- 支持配置开关控制新功能
- 保留原有代码路径
- 提供快速回滚方案

### 2. 监控和告警

- 实时监控IPC调用异常
- 性能指标自动告警
- 用户体验数据收集

### 3. 灰度发布

- 按功能模块逐步启用
- 小范围用户测试
- 根据反馈调整策略

## 预期收益

### 短期收益 (阶段一完成)

- 消除tab间事件错乱问题
- 提升调试和维护效率
- 改善用户体验

### 中期收益 (阶段二完成)

- 系统稳定性显著提升
- 支持更复杂的多tab功能
- 开发效率大幅提升

### 长期收益 (阶段三完成)

- 具备现代化的IPC架构
- 支持未来业务扩展
- 成为技术标杆实践

## 实施时间表

| 阶段     | 周期 | 主要里程碑              |
| -------- | ---- | ----------------------- |
| 准备阶段 | 1周  | 代码审计、环境准备      |
| 阶段一   | 2周  | Tab上下文识别、基础路由 |
| 阶段二   | 3周  | 通道管理、性能优化      |
| 阶段三   | 4周  | 架构升级、监控体系      |
| 测试验证 | 1周  | 全面测试、性能验证      |

## 下一步行动

1. **立即开始**: 代码审计和现状分析
2. **本周内**: 完成阶段一的详细设计
3. **下周开始**: 实施tab上下文识别功能
4. **持续进行**: 与团队同步进展和反馈

# MCP Streamable HTTP Session 自动恢复机制

## 问题背景

在MCP (Model Context Protocol) Streamable HTTP传输协议中，当服务器重启或session过期时，客户端会收到以下错误：

```
Error POSTing to endpoint (HTTP 400): Bad Request: No valid session ID provided
```

根据[MCP Streamable HTTP规范](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports#streamable-http)：

- 服务器可以在初始化时分配session ID，通过`Mcp-Session-Id`头返回
- 客户端必须在后续所有HTTP请求中包含这个session ID
- 服务器可以随时终止session，之后必须对包含该session ID的请求返回HTTP 404
- 当客户端收到HTTP 404时，必须通过发送新的`InitializeRequest`来启动新的session
- 对于没有session ID的请求（除了初始化），服务器应该返回HTTP 400

## 解决方案

我们在`McpClient`类中实现了简单且高效的session错误处理机制：**当检测到session错误时，立即重启服务并清理缓存，让上层调用者重新发起请求**。

### 1. Session错误检测

```typescript
function isSessionError(error: unknown): error is SessionError {
  if (error instanceof Error) {
    const message = error.message.toLowerCase()

    // 检查特定的MCP Streamable HTTP session错误模式
    const sessionErrorPatterns = [
      'no valid session',
      'session expired',
      'session not found',
      'invalid session',
      'session id',
      'mcp-session-id'
    ]

    const httpErrorPatterns = [
      'http 400',
      'http 404',
      'bad request',
      'not found'
    ]

    // 优先检查session相关错误（高置信度）
    const hasSessionPattern = sessionErrorPatterns.some(pattern => message.includes(pattern))
    if (hasSessionPattern) {
      return true
    }

    // 检查可能与session相关的HTTP错误（低置信度）
    // 仅当是HTTP传输时才视为session错误
    const hasHttpPattern = httpErrorPatterns.some(pattern => message.includes(pattern))
    if (hasHttpPattern && (message.includes('posting') || message.includes('endpoint'))) {
      return true
    }
  }
  return false
}
```

### 2. 简单的服务重启处理

```typescript
private async checkAndHandleSessionError(error: unknown): Promise<void> {
  if (isSessionError(error) && !this.isRecovering) {
    // 如果已经重启过一次且仍然出现session错误，停止服务
    if (this.hasRestarted) {
      console.error(`Session error persists after restart for server ${this.serverName}, stopping service...`, error)
      await this.stopService()
      throw new Error(`MCP服务 ${this.serverName} 重启后仍然出现session错误，已停止服务`)
    }

    console.warn(`Session error detected for server ${this.serverName}, restarting service...`, error)

    this.isRecovering = true

    try {
      // 清理当前连接
      this.cleanupResources()

      // 清除所有缓存以确保下次获取新数据
      this.cachedTools = null
      this.cachedPrompts = null
      this.cachedResources = null

      // 标记为已重启
      this.hasRestarted = true

      console.info(`Service ${this.serverName} restarted due to session error`)
    } catch (restartError) {
      console.error(`Failed to restart service ${this.serverName}:`, restartError)
    } finally {
      this.isRecovering = false
    }
  }
}

// 完全停止服务（由于持续的session错误）
private async stopService(): Promise<void> {
  try {
    // 使用内部断开方法，提供特定的错误原因
    await this.internalDisconnect('persistent session errors')
  } catch (error) {
    console.error(`Failed to stop service ${this.serverName}:`, error)
  }
}

// 内部断开方法，支持自定义原因
private async internalDisconnect(reason?: string): Promise<void> {
  // 清理所有资源
  this.cleanupResources()

  const logMessage = reason
    ? `MCP service ${this.serverName} has been stopped due to ${reason}`
    : `Disconnected from MCP server: ${this.serverName}`

  console.log(logMessage)

  // 触发服务器状态变更事件通知系统
  eventBus.send(MCP_EVENTS.SERVER_STATUS_CHANGED, SendTarget.ALL_WINDOWS, {
    name: this.serverName,
    status: 'stopped'
  })
}
```

## 使用方法

所有MCP客户端操作现在都自动包含session错误处理，当session过期时会自动重启服务：

```typescript
try {
  // 调用工具 - 如果session过期，会自动重启服务，然后抛出错误
  const result = await mcpClient.callTool('tool_name', { param: 'value' })
} catch (error) {
  // 服务已重启，重新调用即可
  const result = await mcpClient.callTool('tool_name', { param: 'value' })
}

try {
  // 列出工具 - 如果session过期，会自动重启服务，然后抛出错误
  const tools = await mcpClient.listTools()
} catch (error) {
  // 服务已重启，重新调用即可
  const tools = await mcpClient.listTools()
}
```

## 工作流程

1. **正常操作**: 客户端执行MCP操作
2. **错误检测**: 如果收到session相关错误，`isSessionError`函数检测到
3. **首次重启**: 如果是第一次遇到session错误，立即清理当前连接和缓存，重置服务状态
4. **抛出错误**: 向上层抛出原始错误，让调用者知道需要重试
5. **重新调用**: 上层调用者重新发起请求，此时会建立新的连接和session
6. **持续错误检测**: 如果重启后再次出现session错误，**彻底停止服务**
7. **服务停止**: 清理所有资源，通知系统服务已停止，避免无限重试

## 错误处理策略

- **首次Session错误**: 自动重启服务，抛出错误让上层重试
- **重启后再次Session错误**: 彻底停止服务，避免无限重试循环
- **非Session错误**: 直接抛出，不进行任何特殊处理
- **防止重复重启**: 使用`isRecovering`标志防止同时多个重启操作
- **成功重置**: 成功操作后重置`hasRestarted`标志，允许将来再次重启

## 日志输出

系统会输出简洁的日志信息：

**首次session错误（重启）:**
```
Session error detected for server doris_server, restarting service...
Service doris_server restarted due to session error
```

**重启后仍有session错误（停止服务）:**
```
Session error persists after restart for server doris_server, stopping service...
MCP service doris_server has been stopped due to persistent session errors
```

## 优势

1. **简单高效**: 不需要复杂的重试逻辑，直接重启服务
2. **状态清理**: 确保重启后状态完全干净
3. **上层控制**: 让上层调用者决定是否重试和如何重试
4. **避免复杂性**: 不需要管理重试次数、超时等复杂逻辑
5. **符合规范**: 完全遵循MCP规范的session管理要求
6. **防止无限重试**: 重启后如果仍然失败，自动停止服务避免无限循环

## `disconnect()` vs `stopService()` 的区别

| 方法 | 访问性 | 使用场景 | 检查连接状态 | 日志信息 |
|------|--------|----------|--------------|----------|
| `disconnect()` | 公共方法 | 正常断开连接 | ✅ 检查是否已连接 | "Disconnected from MCP server" |
| `stopService()` | 私有方法 | Session错误后强制停止 | ❌ 直接清理 | "stopped due to persistent session errors" |

两个方法现在都使用相同的内部方法 `internalDisconnect(reason?)` 来避免代码重复，只是传入不同的原因参数。

## 注意事项

1. **缓存清理**: 重启后会清空所有缓存，确保获取最新数据
2. **错误传播**: 错误会正常传播到上层，不会被吞掉
3. **防止并发**: 使用标志位防止并发重启
4. **简单重试**: 上层可以简单地重新调用相同的方法
5. **服务停止**: 如果重启后仍然出现session错误，服务会被完全停止
6. **状态通知**: 服务停止时会通过事件总线通知整个系统
7. **代码复用**: `disconnect()` 和 `stopService()` 都使用统一的内部断开逻辑

## 使用建议

当您的代码遇到MCP操作失败时，可以这样处理：

```typescript
try {
  const result = await mcpClient.callTool('tool_name', { param: 'value' })
  // 成功处理
} catch (error) {
  if (error.message.includes('已停止服务')) {
    // 服务已被停止，不要再重试
    console.error('MCP service has been stopped due to persistent issues')
    return
  }

  // 其他错误，可以重试一次
  try {
    const result = await mcpClient.callTool('tool_name', { param: 'value' })
    // 重试成功
  } catch (retryError) {
    // 重试失败，放弃
    console.error('MCP operation failed after retry:', retryError)
  }
}
```

这个设计确保了系统的稳定性，避免了无限重试循环，同时保持了简单易用的特性。

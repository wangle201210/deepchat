# MCP Presenter 架构文档

## 模块概述

MCP (Model Context Protocol) Presenter 是 DeepChat 中负责管理 MCP 服务器和工具的核心模块，主要功能包括：

1.  **MCP 服务器管理**: 启动、停止、配置管理、默认服务器设置、npm registry 速度测试。
2.  **MCP 工具管理**: 定义获取、名称冲突处理、缓存、权限检查和调用。
3.  **LLM 适配**: 在 MCP 工具格式与不同 LLM 提供商 (OpenAI, Anthropic, Gemini) 的工具格式之间进行转换。
4.  **状态与事件**: 监控服务器状态并通过 `eventBus` 发布相关事件。

## 核心组件

```mermaid
classDiagram
    class IMCPPresenter {
        <<Interface>>
        +getMcpServers()
        +getMcpClients()
        +startServer()
        +stopServer()
        +callTool()
        +getAllToolDefinitions()
        +mcpToolsToOpenAITools()
        +openAIToolsToMcpTool()
        +mcpToolsToAnthropicTools()
        +anthropicToolUseToMcpTool()
        +mcpToolsToGeminiTools()
        +geminiFunctionCallToMcpTool()
        +addMcpServer()
        +removeMcpServer()
        +updateMcpServer()
        +getMcpDefaultServers()
        +addMcpDefaultServer()
        +removeMcpDefaultServer()
        +toggleMcpDefaultServer()
        +getMcpEnabled()
        +setMcpEnabled()
        +resetToDefaultServers()
    }

    class McpPresenter {
        -serverManager: ServerManager
        -toolManager: ToolManager
        -configPresenter: IConfigPresenter
        +initialize()
        +getMcpServers()
        +getMcpClients()
        +startServer()
        +stopServer()
        +callTool()
        +getAllToolDefinitions()
        +mcpToolsToOpenAITools()
        +openAIToolsToMcpTool()
        +mcpToolsToAnthropicTools()
        +anthropicToolUseToMcpTool()
        +mcpToolsToGeminiTools()
        +geminiFunctionCallToMcpTool()
        +addMcpServer()
        +removeMcpServer()
        +updateMcpServer()
        +getMcpDefaultServers()
        +addMcpDefaultServer()
        +removeMcpDefaultServer()
        +toggleMcpDefaultServer()
        +getMcpEnabled()
        +setMcpEnabled()
        +resetToDefaultServers()
    }

    class ServerManager {
        -clients: Map<string, McpClient>
        -configPresenter: IConfigPresenter
        -npmRegistry: string | null
        +testNpmRegistrySpeed()
        +getNpmRegistry()
        +startServer()
        +stopServer()
        +getRunningClients()
        +getDefaultServerNames()
        +getDefaultClients()
        +getClient()
        +isServerRunning()
    }

    class ToolManager {
        -configPresenter: IConfigPresenter
        -serverManager: ServerManager
        -cachedToolDefinitions: MCPToolDefinition[] | null
        -toolNameToTargetMap: Map<string, object> | null
        +getAllToolDefinitions()
        +callTool()
        +checkToolPermission()
        +handleServerListUpdate()
        +getRunningClients()
    }

    class McpClient {
        +serverName: string
        +serverConfig: Record<string, unknown>
        -client: Client | null
        -transport: Transport | null
        -isConnected: boolean
        -npmRegistry: string | null
        +connect()
        +disconnect()
        +callTool()
        +listTools()
        +readResource()
        +isServerRunning()
    }

    class McpConfHelper {
        -mcpStore: ElectronStore<IMcpSettings>
        +getMcpServers()
        +setMcpServers()
        +getMcpDefaultServers()
        +addMcpDefaultServer()
        +removeMcpDefaultServer()
        +toggleMcpDefaultServer()
        +setMcpEnabled()
        +getMcpEnabled()
        +addMcpServer()
        +removeMcpServer()
        +updateMcpServer()
        +resetToDefaultServers()
        +onUpgrade()
    }

    class IConfigPresenter {
        <<Interface>>
        +getMcpServers()
        +setMcpServers()
        +getMcpDefaultServers()
        +addMcpDefaultServer()
        +removeMcpDefaultServer()
        +toggleMcpDefaultServer()
        +setMcpEnabled()
        +getMcpEnabled()
        +addMcpServer()
        +removeMcpServer()
        +updateMcpServer()
        +resetToDefaultServers()
        +getLanguage()
        // ... other config methods
    }


    McpPresenter ..|> IMCPPresenter
    McpPresenter o-- ServerManager
    McpPresenter o-- ToolManager
    McpPresenter o-- IConfigPresenter

    ServerManager o-- IConfigPresenter
    ServerManager "1" *-- "0..*" McpClient : manages

    ToolManager o-- IConfigPresenter
    ToolManager o-- ServerManager : uses

    McpConfHelper ..> IConfigPresenter : (typically implements relevant parts)
```

## 数据流

### 1. 初始化与默认服务器启动

```mermaid
sequenceDiagram
    participant AppStartup
    participant McpPresenter
    participant ServerManager
    participant IConfigPresenter
    participant McpClient

    AppStartup->>McpPresenter: constructor(configPresenter)
    McpPresenter->>ServerManager: constructor(configPresenter)
    McpPresenter->>ToolManager: constructor(configPresenter, serverManager)
    AppStartup->>McpPresenter: initialize()
    McpPresenter->>IConfigPresenter: getMcpServers()
    McpPresenter->>IConfigPresenter: getMcpDefaultServers()
    McpPresenter->>ServerManager: testNpmRegistrySpeed()
    ServerManager-->>McpPresenter: (registry selected)
    loop For each defaultServerName
        McpPresenter->>ServerManager: startServer(defaultServerName)
        ServerManager->>IConfigPresenter: getMcpServers() (to get config)
        ServerManager->>McpClient: new McpClient(name, config, npmRegistry)
        ServerManager->>McpClient: connect()
        McpClient->>McpClient: Establish Transport (stdio/sse/http/inmemory)
        McpClient->>MCP Server: Connect Request
        MCP Server-->>McpClient: Connected
        McpClient-->>ServerManager: Connected (triggers status event)
        ServerManager-->>McpPresenter: Success / Error
    end
```

### 2. LLM 工具调用流程 (以 OpenAI 为例)

```mermaid
sequenceDiagram
    participant LLM Provider
    participant McpPresenter
    participant ToolManager
    participant McpClient
    participant MCP Server

    Note over LLM Provider, McpPresenter: 1. 获取和转换工具定义 (按需)
    LLM Provider->>McpPresenter: getAllToolDefinitions()
    McpPresenter->>ToolManager: getAllToolDefinitions()
    ToolManager->>ServerManager: getRunningClients()
    ServerManager-->>ToolManager: List<McpClient>
    loop For each client
        ToolManager->>McpClient: listTools()
        McpClient-->>ToolManager: Raw Tool List
    end
    ToolManager->>ToolManager: 处理冲突, 缓存定义和映射
    ToolManager-->>McpPresenter: Processed MCPToolDefinition[]
    McpPresenter->>McpPresenter: mcpToolsToOpenAITools(definitions)
    McpPresenter-->>LLM Provider: OpenAI Tool Format

    Note over LLM Provider, McpPresenter: 2. LLM 生成工具调用请求
    LLM Provider->>LLM Provider: LLM decides to call tool(s)
    LLM Provider->>LLM Provider: Generates tool_calls (OpenAI Format)

    Note over LLM Provider, McpPresenter: 3. 转换并执行工具调用
    loop For each tool_call from LLM
        LLM Provider->>McpPresenter: openAIToolsToMcpTool(tool_call)
        McpPresenter-->>LLM Provider: Standard MCPToolCall
        LLM Provider->>McpPresenter: callTool(mcpToolCall)
        McpPresenter->>ToolManager: callTool(mcpToolCall)
        ToolManager->>ToolManager: Lookup target client & original name
        ToolManager->>ToolManager: checkToolPermission()
        alt Permission Denied
            ToolManager-->>McpPresenter: Error Response
        else Permission Granted
            ToolManager->>McpClient: callTool(originalToolName, args)
            McpClient->>MCP Server: Execute Tool
            MCP Server-->>McpClient: Raw Result
            McpClient-->>ToolManager: ToolCallResult
            ToolManager-->>McpPresenter: MCPToolResponse (triggers event)
        end
        McpPresenter-->>LLM Provider: Formatted Response (Success or Error)
    end

    Note over LLM Provider: 4. 处理结果并继续
    LLM Provider->>LLM Provider: Add tool response(s) to context
    LLM Provider->>LLM Provider: Generate next response or further calls

```

## 关键设计

1.  **分层架构**：
    *   接口层 (`IMCPPresenter`): 定义公共 API。
    *   展示层 (`McpPresenter`): 协调者，处理 LLM 适配和委托。
    *   管理层 (`ServerManager`, `ToolManager`): 处理服务器生命周期和工具管理/调用逻辑。
    *   配置层 (`IConfigPresenter`, `McpConfHelper`): 提供和持久化配置。
    *   客户端层 (`McpClient`): 封装与单个 MCP 服务器的通信。

2.  **多协议支持**：
    *   `McpClient` 通过不同的 `Transport` 实现支持 stdio, SSE, HTTP, InMemory。

3.  **工具管理与适配**：
    *   `ToolManager` 集中处理工具定义获取、**名称冲突解决**和缓存。
    *   `McpPresenter` 负责在 MCP 格式与各 LLM 特定格式间转换。
    *   `ToolManager` 使用映射表 (`toolNameToTargetMap`) 将（可能重命名的）工具调用路由到正确的 `McpClient` 和原始工具名称。

4.  **配置驱动与持久化**：
    *   行为由 `McpConfHelper` 管理的配置驱动。
    *   使用 `electron-store` 进行持久化。

5.  **错误处理与事件通知**：
    *   在服务器启动 (`ServerManager`)、工具调用 (`ToolManager`) 等环节包含错误处理。
    *   通过 `eventBus` 发布状态变更和结果事件。

6.  **性能与环境优化**：
    *   `ServerManager` 自动测试并选择最快的 npm registry。
    *   `McpClient` 精细化处理 `stdio` 进程的环境变量 (PATH, 代理, npm registry)。

# ConfigPresenter 架构图

## 类关系图

```mermaid
classDiagram
    class IConfigPresenter {
        <<interface>>
        +getSetting()
        +setSetting()
        +getProviders()
        +setProviders()
        +getModelStatus()
        +setModelStatus()
        +getMcpServers()
        +setMcpServers()
    }

    class ConfigPresenter {
        -store: ElectronStore~IAppSettings~
        -providersModelStores: Map~string, ElectronStore~IModelStore~~
        -mcpConfHelper: McpConfHelper
        +constructor()
        +migrateModelData()
    }

    class ElectronStore~T~ {
        +get()
        +set()
        +delete()
    }

    class McpConfHelper {
        +getMcpServers()
        +setMcpServers()
        +onUpgrade()
    }

    class eventBus {
        +emit()
        +on()
    }

    IConfigPresenter <|.. ConfigPresenter
    ConfigPresenter *-- ElectronStore~IAppSettings~
    ConfigPresenter *-- "1" McpConfHelper
    ConfigPresenter *-- "*" ElectronStore~IModelStore~
    ConfigPresenter ..> eventBus
```

## 数据流图

```mermaid
sequenceDiagram
    participant Renderer
    participant ConfigPresenter
    participant ElectronStore
    participant McpConfHelper

    Renderer->>ConfigPresenter: getSetting('language')
    ConfigPresenter->>ElectronStore: get('language')
    ElectronStore-->>ConfigPresenter: 'en-US'
    ConfigPresenter-->>Renderer: 'en-US'

    Renderer->>ConfigPresenter: setMcpEnabled(true)
    ConfigPresenter->>McpConfHelper: setMcpEnabled(true)
    McpConfHelper-->>ConfigPresenter: Promise~void~
    ConfigPresenter->>eventBus: emit('mcp-enabled-changed', true)
    ConfigPresenter-->>Renderer: Promise~void~
```

## 存储结构

### 主配置存储 (app-settings.json)

```json
{
  "language": "en-US",
  "providers": [
    {
      "id": "openai",
      "name": "OpenAI",
      "apiKey": "sk-...",
      "enable": true
    }
  ],
  "model_status_openai_gpt-4": true,
  "proxyMode": "system",
  "syncEnabled": false
}
```

### 模型存储 (models_openai.json)

```json
{
  "models": [
    {
      "id": "gpt-4",
      "name": "GPT-4",
      "maxTokens": 8192,
      "vision": false,
      "functionCall": true
    }
  ],
  "custom_models": [
    {
      "id": "gpt-4-custom",
      "name": "GPT-4 Custom",
      "maxTokens": 8192
    }
  ]
}
```

## 组件交互

```mermaid
flowchart TD
    A[Renderer] -->|调用| B[ConfigPresenter]
    B -->|读取/写入| C[主配置存储]
    B -->|管理| D[模型存储]
    B -->|委托| E[McpConfHelper]
    B -->|触发| F[事件总线]
    F -->|通知| G[其他Presenter]
    F -->|通知| A
```

## 关键设计点

1. **接口隔离**：通过 IConfigPresenter 接口定义公共API
2. **单一职责**：McpConfHelper 处理MCP相关逻辑
3. **事件驱动**：通过事件总线通知配置变更
4. **版本兼容**：内置数据迁移机制
5. **类型安全**：使用泛型接口保证类型安全

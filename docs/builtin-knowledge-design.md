# BuiltinKnowledge 设计文档

## 1. 核心类设计

### 1.1 KnowledgePresenter

`KnowledgePresenter` (`src/main/presenter/knowledgePresenter/index.ts`) 是模块主入口，实现了 `IKnowledgePresenter` 接口，主要职责：

- 依赖 `IConfigPresenter` 获取和管理知识库配置。
- 监听 `MCP_EVENTS.CONFIG_CHANGED`，自动同步配置，按 diff 结果分别处理新增、删除、更新。
- 管理 RAG 实例缓存，负责知识库的创建、重置、删除、文件增删查、相似度检索等。
- 通过 eventBus 触发知识库相关事件。

**关键方法**：

- `create(config)`: 创建知识库（初始化 RAG 实例）。
- `reset(id)`: 重置知识库内容。
- `delete(id)`: 删除知识库及本地存储。
- `addFile(id, filePath)`: 添加文件到知识库。
- `deleteFile(id, fileId)`: 删除知识库中的文件。
- `reAddFile(id, fileId)`: 重新处理文件。
- `queryFile(id, fileId)`, `listFiles(id)`: 查询/列出知识库文件。
- `similarityQuery(id, key)`: 相似度检索。
- `closeAll()`: 关闭所有 RAG 实例。

### 1.2 RagPresenter

`RagPresenter` (`src/main/presenter/knowledgePresenter/RagPresenter.ts`) 负责知识库的核心业务逻辑：

- 文件分块、嵌入生成、向量入库、相似度检索。
- 依赖 `IVectorDatabasePresenter` 进行底层向量存储和检索。
- 处理文件状态、异步任务和异常。

**关键方法**：

- `addFile(filePath)`: 文件分块、嵌入、入库。
- `deleteFile(fileId)`: 删除文件及其向量。
- `reAddFile(fileId)`: 重新处理文件。
- `queryFile(fileId)`, `listFiles()`: 查询/列出文件。
- `similarityQuery(key)`: 相似度检索。
- `reset()`, `destroy()`, `close()`: 管理生命周期。

### 1.3 IVectorDatabasePresenter

`IVectorDatabasePresenter`（接口，DuckDBPresenter 实现）负责本地向量数据库操作：

- 初始化、打开、关闭数据库。
- 插入文件、插入/删除向量、文件查询、向量检索等。

### 1.4 ConfigPresenter

`ConfigPresenter` 负责知识库配置的持久化、读取、diff（增删改对比）等能力。

- `getKnowledgeConfigs()`, `setKnowledgeConfigs()`, `diffKnowledgeConfigs()` 等。

## 2. 文件入库与检索流程

```mermaid
sequenceDiagram
    participant User
    participant KnowledgePresenter
    participant RagPresenter
    participant LLMProvider
    participant IVectorDatabasePresenter
    participant EventBus

    %% 文件入库流程
    User->>KnowledgePresenter: addFile(id, filePath)
    KnowledgePresenter->>RagPresenter: addFile(filePath)
    RagPresenter->>LLMProvider: getMimeType(filePath)
    LLMProvider-->>RagPresenter: mimeType
    RagPresenter->>LLMProvider: prepareFileCompletely(filePath, mimeType)
    LLMProvider-->>RagPresenter: fileInfo (name, path, content, size)
    RagPresenter->>IVectorDatabasePresenter: insertFile(fileMessage)
    RagPresenter->>LLMProvider: 分块+嵌入 (splitText+getEmbeddings)
    LLMProvider-->>RagPresenter: chunks, vectors
    RagPresenter->>IVectorDatabasePresenter: insertVectors(vectors)
    RagPresenter->>IVectorDatabasePresenter: updateFile(status=completed)
    RagPresenter->>EventBus: RAG_EVENTS.FILE_UPDATED (文件处理完成)
    RagPresenter-->>KnowledgePresenter: fileTask Promise resolve
    KnowledgePresenter-->>User: 返回文件入库结果
    Note over RagPresenter,IVectorDatabasePresenter: 异常时更新status=error并通知EventBus

    %% 文件检索流程
    User->>KnowledgePresenter: similarityQuery(id, key)
    KnowledgePresenter->>RagPresenter: similarityQuery(key)
    RagPresenter->>LLMProvider: getEmbeddings(key)
    LLMProvider-->>RagPresenter: embedding
    RagPresenter->>IVectorDatabasePresenter: similarityQuery(embedding)
    IVectorDatabasePresenter-->>RagPresenter: 检索结果
    RagPresenter-->>KnowledgePresenter: 检索结果
    KnowledgePresenter-->>User: 检索结果
```

## 3. 事件系统

BuiltinKnowledge 通过 eventBus 发出以下事件：

| 事件名称                           | 触发时机                         | 触发源            | 参数                      |
| ---------------------------------- | -------------------------------- | ----------------- | ------------------------- |
| `MCP_EVENTS.CONFIG_CHANGED`        | 配置变更                         | eventBus          | configs                  |
| `RAG_EVENTS.FILE_UPDATED`          | 文件处理完成/状态变更             | KnowledgePresenter | KnowledgeFileMessage      |
| ...                                | ...                              | ...               | ...                      |

## 4. 配置管理

知识库相关配置通过 `ConfigPresenter` 管理，持久化存储。

**核心配置项**:

- `knowledgeConfigs`: `BuiltinKnowledgeConfig[]` - 所有知识库实例配置。

**`BuiltinKnowledgeConfig` 接口**:

```typescript
type BuiltinKnowledgeConfig = {
  id: string
  description: string
  embedding: ModelProvider
  dimensions: number
  normalized: boolean
  chunkSize?: number
  chunkOverlap?: number
  fragmentsNumber: number
  enabled: boolean
}
```

## 5. 扩展指南

### 5.1 添加新向量数据库

1. 实现 `IVectorDatabasePresenter` 接口。
2. 在 `KnowledgePresenter` 中根据配置选择不同数据库实现。

### 5.2 支持新嵌入模型

1. 扩展 `ModelProvider` 类型和相关调用逻辑。
2. 在 `RagPresenter` 中适配新模型。

### 5.3 自定义事件与回调

1. 在 `KnowledgePresenter`/`RagPresenter` 中增加事件触发点。
2. 在前端 UI 层监听并响应相关事件。

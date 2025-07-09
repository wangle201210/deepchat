# BuiltinKnowledge 架构文档

## 模块概述

BuiltinKnowledge（内置知识库）模块是 DeepChat 中负责本地知识存储、检索与管理的核心组件，主要功能包括：

1. **知识库生命周期管理**：创建、重置、删除、文件增删查、RAG 实例管理。
2. **配置驱动**：监听 MCP 配置变更事件，自动同步知识库配置。
3. **嵌入与向量检索**：集成本地嵌入模型与 DuckDB 向量数据库，支持高效检索。
4. **事件与状态**：通过 eventBus 监控配置和知识库状态，发布相关事件。

## 核心组件

```mermaid
classDiagram
    class KnowledgePresenter {
        -configPresenter: IConfigPresenter
        -storageDir: string
        -ragPresenterCache: Map<string, RagPresenter>
        +create()
        +reset()
        +delete()
        +addFile()
        +deleteFile()
        +reAddFile()
        +queryFile()
        +listFiles()
        +similarityQuery()
        +closeAll()
    }

    class RagPresenter {
        -vectorP: IVectorDatabasePresenter
        -config: BuiltinKnowledgeConfig
        +addFile()
        +deleteFile()
        +reAddFile()
        +queryFile()
        +listFiles()
        +similarityQuery()
        +reset()
        +destroy()
        +close()
    }

    class IVectorDatabasePresenter {
        <<Interface>>
        +initialize()
        +open()
        +close()
        +insertFile()
        +insertVectors()
        +deleteVectorsByFile()
        +deleteFile()
        +queryFile()
        +listFiles()
        +similarityQuery()
        +destroy()
    }

    KnowledgePresenter o-- RagPresenter : manages
    RagPresenter o-- IVectorDatabasePresenter
```

## 数据流

### 1. 配置变更与知识库同步

```mermaid
sequenceDiagram
    participant eventBus
    participant KnowledgePresenter
    participant ConfigPresenter

    eventBus->>KnowledgePresenter: MCP_EVENTS.CONFIG_CHANGED
    KnowledgePresenter->>ConfigPresenter: diffKnowledgeConfigs(configs)
    KnowledgePresenter->>ConfigPresenter: setKnowledgeConfigs(configs)
    KnowledgePresenter->>KnowledgePresenter: create/delete/reset等
```

### 2. 文件入库与检索流程

```mermaid
sequenceDiagram
    participant User
    participant KnowledgePresenter
    participant RagPresenter
    participant IVectorDatabasePresenter

    User->>KnowledgePresenter: addFile(id, filePath)
    KnowledgePresenter->>RagPresenter: addFile(filePath)
    RagPresenter->>IVectorDatabasePresenter: insertFile/insertVectors
    RagPresenter-->>KnowledgePresenter: 任务完成事件
    KnowledgePresenter-->>User: 文件入库结果

    User->>KnowledgePresenter: similarityQuery(id, key)
    KnowledgePresenter->>RagPresenter: similarityQuery(key)
    RagPresenter->>IVectorDatabasePresenter: similarityQuery
    RagPresenter-->>KnowledgePresenter: 检索结果
    KnowledgePresenter-->>User: 检索结果
```

## 关键设计

1. **分层架构**：接口层（IKnowledgePresenter）、管理层（KnowledgePresenter）、业务层（RagPresenter）、存储层（IVectorDatabasePresenter）、配置层（ConfigPresenter）。
2. **事件驱动**：通过 eventBus 监听 MCP 配置变更，自动同步知识库。
3. **高性能本地检索**：集成 DuckDB 向量数据库和本地嵌入模型。
4. **配置驱动与持久化**：所有知识库配置通过 ConfigPresenter 管理和持久化。
5. **健壮性**：事件回调均有校验和异常处理，防止脏数据和异常中断。

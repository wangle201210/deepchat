# MCP 工具在 Thread 中启用机制的分析与改进方案 (v2)

## 1. 当前机制与 UI 分析

### 1.1. 后端机制

通过对 `ServerManager`、`ToolManager` 和 `ThreadPresenter` 的代码分析，当前 MCP (Multi-Codepath) 工具在会话（Thread）中的启用机制是**全局性**的：

1.  **服务启动**: `ServerManager` 根据全局配置启动默认的 MCP 服务器。
2.  **工具发现**: `ToolManager` 的 `getAllToolDefinitions` 方法会扫描所有**正在运行**的 MCP 服务器，收集它们提供的**所有**工具。
3.  **线程集成**: `ThreadPresenter` 在每次生成 AI 响应前，都会调用 `getAllToolDefinitions` 来获取**全部**可用工具，并将它们提供给大语言模型。

结论是，一个工具是否可用，仅取决于其所属的 MCP 服务器当前是否正在运行，缺乏会话级别的细粒度控制。

### 1.2. 前端 UI 分析 (`mcpToolsList.vue`)

`mcpToolsList.vue` 是 MCP 的主控制面板，其核心功能点如下：

- **全局总开关**: 一个顶层开关 (`mcpEnabled`) 用于启用或禁用整个 MCP 功能。
- **服务器独立启停**: 在总开关打开后，UI 会列出所有已配置的 MCP 服务器，并为每个服务器提供一个独立的开关。用户可以在此**手动启动或停止**任何一个服务器。
- **工具信息展示**: 对于正在运行的服务器，UI 会显示其提供的工具数量，并允许用户点击查看具体的工具列表。

这个 UI 已经为用户建立了“服务”和“工具”是两个不同层级的心理模型，非常适合在其基础上进行扩展。

---

## 2. 改进方案：分层工具选择模型

结合现有的后端机制和前端 UI，我们提出一个分层的工具选择模型，以实现会话级别的工具启用控制，同时保持用户体验的一致性。

### 2.1. 核心思路

将工具的管理分为两个清晰的层次：

1.  **全局服务管理层 (现状)**: 用户在 `mcpToolsList.vue` 中启动或停止 MCP 服务器。这决定了整个应用中“可能可用”的工具池。
2.  **会话工具配置层 (新增)**: 在每个会话各自的设置中，用户可以从“全局可用工具池”里，为当前会话挑选一个或多个工具子集来启用。

### 2.2. 具体实施步骤

#### **步骤 1: 扩展会话设置 (`CONVERSATION_SETTINGS`)**

在共享类型定义文件中，为 `CONVERSATION_SETTINGS` 接口添加一个新字段，用于存储会话级别的工具选择。

- **文件**: `src/shared/presenter.d.ts`
- **修改**:
  ```typescript
  export interface CONVERSATION_SETTINGS {
    // ... existing fields
    enabledMcpTools?: string[]; // 新增字段：存储此会话启用的工具名称
  }
  ```
  该字段为可选。如果 `enabledMcpTools` 未定义或为空，系统将默认使用所有“全局可用”的工具，以实现向后兼容。

#### **步骤 2: 修改 `ToolManager` 以支持过滤 (与原方案一致)**

修改 `getAllToolDefinitions` 方法，使其能够根据传入的启用列表过滤工具。

- **文件**: `src/main/presenter/mcpPresenter/toolManager.ts`
- **修改**: 为 `getAllToolDefinitions` 方法增加一个可选参数 `enabledTools?: string[]`。
  - 如果 `enabledTools` 数组被提供且不为空，则在聚合所有工具后，只返回那些名称存在于 `enabledTools` 列表中的工具。
  - **匹配逻辑**: 过滤时应同时检查工具的最终名称（可能包含服务器前缀）和原始名称，以确保匹配的健壮性。
  - 如果 `enabledTools` 未提供，则返回所有工具。

#### **步骤 3: 修改 `ThreadPresenter` 以传递会话配置 (与原方案一致)**

更新 `ThreadPresenter`，使其在准备 Prompt 时，从当前会话的设置中读取 `enabledMcpTools` 列表并传递给 `ToolManager`。

- **文件**: `src/main/presenter/threadPresenter/index.ts`
- **修改**: 在 `preparePromptContent` 方法中：
  ```typescript
  // in preparePromptContent method of ThreadPresenter
  private async preparePromptContent(...) {
    // ...
    const enabledMcpTools = conversation.settings.enabledMcpTools;
    const mcpTools = await presenter.mcpPresenter.getAllToolDefinitions(enabledMcpTools);
    // ...
  }
  ```

#### **步骤 4: 新增“会话工具配置”前端 UI**

这是新方案的核心 UI 部分，需要**在会话设置界面中新增一个配置区域**，而不是修改 `mcpToolsList.vue`。

- **位置**: 在每个会话的设置面板中（例如，一个模态框或侧边栏）。
- **功能**: 
    1.  **数据源**: 该 UI 从 `useMcpStore` 获取所有“全局可用”的工具列表（即所有已启动服务器提供的工具）。
    2.  **展示**: 使用多选框列表来展示这些工具，最好按服务器进行分组，以保持与 `mcpToolsList.vue` 的视觉一致性。
    3.  **状态同步**: 
        - UI 加载时，读取当前会话已保存的 `enabledMcpTools` 列表，并设置复选框的初始选中状态。
        - 当用户修改复选框时，立即或通过“保存”按钮更新会话设置，调用 `ThreadPresenter.updateConversationSettings` 将新的 `enabledMcpTools` 数组持久化到数据库。

- **UI Mockup 示例 (在会话设置面板中)**:
  ```
  -----------------------------------------
  | 会话设置                              |
  |---------------------------------------|
  | ... (模型、温度等其他设置) ...        |
  |---------------------------------------|
  | ✓ 启用会话工具                        |
  |   从此会话可用的工具中进行选择。      |
  |                                       |
  | ▼ 🌐 a-server (2/2)                   |
  |     [x] a-server_tool_1             |
  |     [x] a-server_tool_2             |
  |                                       |
  | ▼ 💻 another-server (1/2)             |
  |     [x] another-server_read_file    |
  |     [ ] another-server_write_file   |
  |                                       |
  | ► ☁️ cloud-service (0/1) - 已停止   |
  |                                       |
  -----------------------------------------
  ```
  - 可以在 UI 中提示哪些服务器当前未运行，其下的工具为不可选状态，引导用户去 `mcpToolsList.vue` 启动服务。

### 2.3. 新方案的优势

- **清晰的职责分离**: `mcpToolsList.vue` 负责**服务启停**（管理“工具箱”），会话设置负责**工具选用**（从“工具箱”里拿工具到“工作台”），逻辑清晰。
- **一致的用户体验**: 沿用了用户已经熟悉的 UI 模式（服务器列表和开关），降低了学习成本。
- **强大的灵活性**: 用户可以实现“启动所有服务，但在会话 A 中只用文件工具，在会话 B 中只用搜索工具”这样的精细化控制。
- **完全向后兼容**: 对于旧会話或未做任何配置的新会话，系统默认使用所有可用工具，不影响现有功能。
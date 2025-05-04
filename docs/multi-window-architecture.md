# 多窗口与多标签页架构设计与改造计划

## 目标

将 DeepChat 的 Electron 应用从当前的单窗口模式重构为支持多个等价窗口，并且每个窗口内支持多个标签页（使用 `WebContentsView`）。用户应该能够：

1.  打开多个独立的 DeepChat 窗口，每个窗口功能一致。
2.  在每个窗口内打开、关闭、切换多个标签页。
3.  将标签页从一个窗口拖拽到另一个窗口中。

## 当前架构的挑战 (原始)

原始架构强耦合于一个"主窗口" (`MAIN_WIN`) 的概念，不支持多窗口，更不用说多标签页。

## 新架构设计

核心思路是分离窗口管理和标签页管理，并实现它们之间的协作。

1.  **核心组件:**

    - **`WindowPresenter`**: 管理 `BrowserWindow` 实例的生命周期和集合。
    - **`TabPresenter` (新增)**: 全局管理所有 `WebContentsView` (标签页) 实例的生命周期、状态、窗口归属以及跨窗口移动。
    - **`BrowserWindow`**: 作为顶级容器，包含一个用于渲染标签栏 UI 的轻量级页面，并管理一组由 `TabPresenter` 控制的 `WebContentsView`。

2.  **`WindowPresenter` 改造:**

    - **职责:** 创建、管理 `BrowserWindow` 实例（窗口本身的最小化、最大化、关闭等）。
    - **窗口集合:** 使用 `Map<number, BrowserWindow>` 存储窗口实例，`key` 为 `BrowserWindow` 的 `id`。
    - **窗口创建:** `createWindow` 负责创建配置好标签栏 UI 和 `WebContentsView` 容器的 `BrowserWindow`。
    - **移除单窗口引用:** 废弃 `MAIN_WIN` 常量和 `mainWindow` getter。
    - **窗口操作:** `minimize`, `maximize`, `close` 等方法修改为接受 `windowId` 或操作当前聚焦窗口。关闭窗口时需通知 `TabPresenter` 清理关联的标签页。
    - **事件广播:** 应用级事件（如主题更改）需要广播到所有窗口；窗口级事件需要正确处理。

3.  **`TabPresenter` (新增):**

    - **职责:** 核心的标签页管理器。
    - **数据结构:**
      - `tabs: Map<number, { view: WebContentsView, state: TabState, windowId: number }>`: 全局标签页实例及其状态存储。 Key 为 `tabId` (`webContents.id`), Value 为一个包含 `WebContentsView` 实例、状态对象 (`TabState`: { URL, title, favicon, isActive, etc. }) 以及所属窗口 ID (`windowId`) 的对象。
      - `windowTabs: Map<number, number[]>`: 窗口ID (`windowId`) 到其包含的标签页ID列表 (`tabId[]`) 的映射，维护标签页在窗口内的顺序。
    - **核心方法:**
      - `createTab(windowId, url, options)`: 创建 `WebContentsView`，生成 `TabInfo` 对象存入 `tabs` Map，并将 `tabId` 添加到对应 `windowId` 的 `windowTabs` 数组中。将其添加到 `windowId` 对应的 `BrowserWindow` 的视图层级中 (e.g., `window.contentView.addChildView()`)。
      - `destroyTab(tabId)`: 从 `tabs` Map 中获取 `TabInfo`，找到 `windowId` 和 `view`。从窗口视图层级移除 `view`，销毁 `WebContentsView`，从 `tabs` Map 中删除条目，并从 `windowTabs` 中移除 `tabId`。
      - `activateTab(tabId)`: 在 `tabs` 中找到对应的 `TabInfo`，更新其 `state.isActive`，并在其所属窗口内将 `view` 提升到最前。可能还需要将同一窗口内其他标签的 `isActive` 设为 `false`。
      - `detachTab(tabId)`: 从 `tabs` 中获取 `TabInfo`，从其当前窗口的视图层级移除 `view`。更新 `TabInfo` 中的 `windowId` (可能设为 `null` 或特殊值表示已分离)，并从旧窗口的 `windowTabs` 中移除 `tabId`。**注意：此时 `WebContentsView` 实例本身不销毁。**
      - `attachTab(tabId, targetWindowId, index?)`: 找到 `tabs` 中的 `TabInfo`。将其 `view` 添加到 `targetWindowId` 对应窗口的视图层级。更新 `TabInfo` 中的 `windowId` 为 `targetWindowId`。将 `tabId` 插入到 `targetWindowId` 对应的 `windowTabs` 数组的指定 `index` (或末尾)。
      - `moveTab(tabId, targetWindowId, index?)`: 协调 `detachTab` 和 `attachTab` 完成标签移动。
    - **事件/IPC 处理:** 监听 `WebContentsView` 事件更新 `tabs` 中对应 `TabInfo` 的 `state`，处理来自渲染进程的标签操作请求。

4.  **IPC 通信:**

    - **Renderer -> Main:**
      - `requestNewTab(windowId, url)` -> `TabPresenter.createTab`
      - `requestCloseTab(windowId, tabId)` -> `TabPresenter.destroyTab`
      - `requestSwitchTab(windowId, tabId)` -> `TabPresenter.activateTab`
      - `notifyTabDragStart(windowId, tabId)`: 通知拖拽开始。
      - `notifyTabDrop(sourceWindowId, tabId, targetWindowId, targetIndex)`: 通知拖拽结束及放置目标 -> `TabPresenter.moveTab`。
    - **Main -> Renderer:**
      - `updateWindowTabs(windowId, tabListData)`: 发送标签列表 `{ id, title, faviconUrl, isActive }[]` 给对应窗口渲染进程用于更新UI。
      - `setActiveTab(windowId, tabId)`: 指示渲染进程高亮活动标签。

5.  **`TrayPresenter` & `ContextMenuHelper`:**

    - 需要能访问窗口和标签列表 (`WindowPresenter`, `TabPresenter`)。
    - 明确托盘图标点击行为（如显示窗口列表、激活最近使用的标签页等）。
    - 上下文菜单能根据当前的 `WebContentsView` 提供相关操作。

6.  **渲染进程 (Renderer): 多入口架构**

    为了清晰地分离窗口外壳 (Window Shell) 和标签页内容 (Tab Content) 的职责与构建产物，渲染层将采用多入口构建策略。这将需要修改 `electron.vite.config.ts` 以支持多个 `renderer` 输入。

    - **入口 1: Window Shell (窗口外壳)**

      - **代码目录:** `src/renderer/shell/`
      - **入口文件:** `src/renderer/shell/index.html` (及其关联的 `main.ts`)
      - **职责:**
        - 渲染 `BrowserWindow` 的主界面框架，主要是顶部的**标签栏 UI** (`TabBar.vue`)。
        - 运行一个独立的、轻量级的 Vue 应用实例。
        - **获取 `windowId`:** 必须能识别自身所属的 `BrowserWindow` ID (通过 preload 脚本注入或 IPC 获取)。
        - **处理标签栏交互:** 响应用户对标签的点击（切换、关闭）、新建标签按钮的点击，并**触发相应的 IPC 消息** (`requestSwitchTab`, `requestCloseTab`, `requestNewTab`) 到主进程。
        - **实现标签拖拽:** 在标签栏内实现标签的拖拽排序和跨窗口拖拽的启动，通过 IPC **通知主进程** (`notifyTabDragStart`, `notifyTabDrop`)。
        - **接收状态更新:** 监听主进程发送的针对该窗口的标签列表更新 (`updateWindowTabs`) 和活动标签变更 (`setActiveTab`) 消息，并更新 UI。
      - **加载方式:** 主进程的 `WindowPresenter` 在创建 `BrowserWindow` 时，应加载此入口的 `index.html` (例如 `dist/renderer/shell/index.html`)。

    - **入口 2: Tab Content (标签页内容)**

      - **代码目录:** `src/renderer/content/`
      - **入口文件:** `src/renderer/content/index.html` (及其关联的 `main.ts`)
      - **职责:**
        - 渲染**指定标签页内的实际应用视图** (例如聊天界面、设置页面等)。
        - 运行另一个独立的 Vue 应用实例，包含应用本身的状态管理 (Pinia) 和路由 (Vue Router)。
        - **路由:** 使用 Vue Router 根据加载到 `WebContentsView` 中的 URL (由 `TabPresenter` 控制，例如 `dist/renderer/content/index.html#/chat/123` 或 `dist/renderer/content/index.html#/settings`) 来决定显示哪个具体的视图组件 (`ChatView.vue`, `SettingsView.vue` 等)。
        - **与主进程通信:** 处理视图内部的业务逻辑，并通过 IPC 与主进程交互（例如发送消息、保存设置）。
        - **更新标签状态:** 如果内容需要改变标签的外观（如标题、图标），需通过 IPC 通知主进程 (`TabPresenter`) 更新状态。
      - **加载方式:** 主进程的 `TabPresenter` 在创建 `WebContentsView` 实例时，应加载此入口的 `index.html` 并附加相应的 URL hash/path 以进行内容路由。

    - **共享代码:**

      - 通用的类型定义、工具函数、常量等应放置在 `@shared` 目录中，供主进程和两个渲染进程入口共享。
      - 如果有跨 `shell` 和 `content` 的共享 Vue 组件或 UI 库，需要规划好共享方式 (例如通过 `@shared` 或独立的 UI 包)。

    - **构建配置 (`electron.vite.config.ts`)**
      - 需要将 `renderer` 配置修改为支持多入口的形式，明确指定 `shell` 和 `content` 的 `input` HTML 文件，并可能需要配置不同的 `resolve.alias` 指向各自的源代码目录 (`src/renderer/shell`, `src/renderer/content`)。

## 改造计划

1.  **设计并实现 `TabPresenter`**: 核心数据结构、标签页生命周期管理、状态管理、窗口关联及移动逻辑 (`detachTab`, `attachTab`, `moveTab`)。
2.  **重构 `WindowPresenter`**: 调整窗口创建逻辑以包含标签容器，与 `TabPresenter` 协作处理窗口事件和关闭逻辑。
3.  **实现 `WebContentsView` 容器**: 在 `BrowserWindow` 中设置合适的视图来容纳和管理 `WebContentsView` 实例 (e.g., using `contentView` API)。
4.  **实现 Main Process IPC**: 建立 `Renderer <-> Main (TabPresenter/WindowPresenter)` 的通信通道和消息处理器。
5.  **实现 Renderer 标签栏 UI**: 使用前端框架（如 Vue）创建组件显示标签，处理用户交互并触发 IPC 调用。
6.  **实现 Renderer 标签拖拽逻辑**: 处理拖拽事件、计算放置目标、通过 IPC 通知主进程 (`notifyTabDragStart`, `notifyTabDrop`)。
7.  **实现 Main Process 标签移动处理**: `TabPresenter` 响应 `notifyTabDrop`，调用 `moveTab` 来实际操作 `WebContentsView`。
8.  **实现 State 同步**: 确保标签状态 (title, URL, favicon, active status) 在 Main (`TabPresenter`) 和 Renderer (UI) 之间正确同步。
9.  **调整 `TrayPresenter` & `ContextMenuHelper`**: 使其适应多窗口多标签环境。
10. **审阅生命周期管理**: 确保标签关闭、窗口关闭、应用退出逻辑的健壮性。
11. **更新文档**: 将此详细设计写入 `docs/multi-window-architecture.md`。（本步骤）
12. **测试**: 全面测试多窗口创建/关闭、多标签创建/关闭/切换、跨窗口拖拽、状态同步、IPC 通信等功能。

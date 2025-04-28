# 多窗口架构设计与改造计划

## 目标

将 DeepChat 的 Electron 应用从当前的单窗口模式重构为支持多个等价窗口的模式。用户应该能够打开多个独立的 DeepChat 窗口，每个窗口都具有完整的功能，并且表现一致。

## 当前架构的挑战

当前的 `WindowPresenter` (`src/main/presenter/windowPresenter.ts`) 设计强耦合于一个"主窗口" (`MAIN_WIN`) 的概念。这导致：

- 窗口创建、管理和生命周期都围绕单个窗口实例。
- IPC 消息和事件处理默认以单个主窗口为目标。
- 托盘图标、上下文菜单等功能也基于单窗口假设。

## 新架构设计

核心思路是移除对单一主窗口的依赖，将窗口管理视为一个可扩展的集合。

1.  **`WindowPresenter` 改造:**

    - **窗口集合:** 使用 `Map<number, BrowserWindow>` 存储窗口实例，`key` 为 `BrowserWindow` 的 `id`。
    - **窗口创建:** `createMainWindow` 重命名为 `createWindow`，负责创建、配置新窗口、设置事件监听器，并将其添加到集合中。
    - **移除单窗口引用:** 废弃 `MAIN_WIN` 常量和 `mainWindow` getter。
    - **窗口操作:** `minimize`, `maximize`, `close`, `hide`, `show`, `isMaximized`, `previewFile` 等方法修改为接受 `windowId` 或操作当前聚焦窗口。
    - **事件广播:** 应用级事件（如主题更改）需要广播到所有窗口；窗口级事件（如最大化）需发送到特定窗口。
    - **生命周期:** 正确处理单个窗口关闭（从集合移除）和所有窗口关闭（退出应用）的逻辑。

2.  **IPC 通信:**

    - **Main -> Renderer:** 明确消息目标，是特定窗口还是所有窗口。
    - **Renderer -> Main:** IPC 消息应包含来源窗口的 `windowId`，以便主进程知道上下文。渲染进程需要能获取自身的 `windowId` (通过 preload 注入)。

3.  **`TrayPresenter`:**

    - 能够访问所有窗口列表。
    - 明确点击托盘图标的行为（如显示所有窗口、显示选择菜单、激活最近窗口）。

4.  **`ContextMenuHelper`:**

    - 能够为指定的 `BrowserWindow` 实例应用和管理上下文菜单。

5.  **渲染进程 (Renderer):**
    - 实现获取自身 `windowId` 的机制。
    - 提供创建新窗口的用户界面入口（如菜单项）。
    - 考虑多窗口下的状态管理策略（共享状态为主）。

## 改造计划

1.  **重构 `WindowPresenter`:** 实现核心的窗口集合管理、创建、操作和事件处理逻辑。
2.  **调整 `TrayPresenter`:** 更新其与多窗口的交互。
3.  **调整 `contextMenuHelper`:** 支持按窗口应用菜单。
4.  **修改 IPC 机制:** 实现窗口 ID 的传递和消息路由。
5.  **修改渲染进程:** 添加窗口 ID 获取和新窗口创建功能。
6.  **审阅生命周期管理:** 确保应用和窗口的关闭/退出逻辑健壮。
7.  **全局代码审阅:** 查找并修复其他模块对单窗口的隐式依赖。
8.  **编写文档:** 将此设计和计划写入 `docs/multi-window-architecture.md`。 （本步骤）
9.  **测试:** 对多窗口功能进行全面测试，包括创建、关闭、交互、状态同步、IPC 通信等。

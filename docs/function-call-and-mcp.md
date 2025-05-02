# 从 MCP 到 Tool Use

- [从 MCP 到 Tool Use](#从-mcp-到-tool-use)
  - [MCP Tools 映射和定义](#mcp-tools-映射和定义)
  - [Anthropic tool API和上下文组织格式](#anthropic-tool-api和上下文组织格式)
    - [格式转换](#格式转换)
    - [上下文组织](#上下文组织)
    - [流式处理](#流式处理)
  - [范例 Anthropic的Tool Use实现](#范例-anthropic的tool-use实现)
    - [工具定义](#工具定义)
    - [用户请求示例](#用户请求示例)
    - [大模型响应](#大模型响应)
    - [MCP 模块执行命令](#mcp-模块执行命令)
    - [最终大模型结合上下文给出答案](#最终大模型结合上下文给出答案)
  - [Gemini tool API 和上下文组织格式](#gemini-tool-api-和上下文组织格式)
    - [格式转换](#格式转换-1)
    - [上下文组织](#上下文组织-1)
    - [流式处理](#流式处理-1)
  - [范例：Gemini 的 Tool Use 实现](#范例gemini-的-tool-use-实现)
    - [工具定义](#工具定义-1)
    - [用户请求示例](#用户请求示例-1)
    - [大模型响应（调用工具）](#大模型响应调用工具)
    - [MCP 模块执行命令](#mcp-模块执行命令-1)
    - [最终大模型结合上下文给出答案](#最终大模型结合上下文给出答案-1)
  - [OpenAI tool API 和上下文组织格式](#openai-tool-api-和上下文组织格式)
    - [格式转换](#格式转换-2)
    - [上下文组织](#上下文组织-2)
    - [流式处理](#流式处理-2)
  - [范例：OpenAI 的 Tool Use 实现](#范例openai-的-tool-use-实现)
    - [工具定义](#工具定义-2)
    - [用户请求示例](#用户请求示例-2)
    - [大模型响应（调用工具）](#大模型响应调用工具-1)
    - [MCP 模块执行命令](#mcp-模块执行命令-2)
    - [最终大模型结合上下文给出答案](#最终大模型结合上下文给出答案-2)
  - [不支持 Tool Use 的模型如何用提示词工程来实现，流式内容如何正确解析函数信息](#不支持-tool-use-的模型如何用提示词工程来实现流式内容如何正确解析函数信息)
    - [提示词包装](#提示词包装)
    - [流式内容解析](#流式内容解析)
    - [使用同样的getTime示例，提示词工程方案的流程如下：](#使用同样的gettime示例提示词工程方案的流程如下)

## MCP Tools 映射和定义

MCP (Model Context Protocol) 是一种用于标准化与各种模型交互的协议。在本项目中，MCP工具定义通过`McpClient`类统一管理，为不同LLM提供商提供一致的工具调用接口。

MCP 工具的基本结构定义如下（官方额外还有一些注释字段，目前没用到）：
```typescript
{
  name: string;          // Unique identifier for the tool
  description?: string;  // Human-readable description
  inputSchema: {         // JSON Schema for the tool's parameters
    type: "object",
    properties: { ... }  // Tool-specific parameters
  }
}
```

通过`mcpClient.ts`的`callTool`方法，可以实现跨提供商的工具调用：
```typescript
async callTool(toolName: string, args: Record<string, unknown>): Promise<ToolCallResult>
```

工具调用结果遵循统一格式：
```typescript
interface ToolCallResult {
  isError?: boolean;
  content: Array<{
    type: string;
    text: string;
  }>;
}
```

当需要将MCP工具映射到不同提供商时，会通过以下流程：
1. 使用`presenter.mcpPresenter.mcpToolsToOpenAITools`、`presenter.mcpPresenter.mcpToolsToAnthropicTools`或`presenter.mcpPresenter.mcpToolsToGeminiTools`等方法进行转换
2. 这些方法会将MCP工具的`inputSchema`转换为各提供商期望的参数格式
3. 确保工具名称和描述在转换过程中保持一致

## Anthropic tool API和上下文组织格式

Anthropic的Tool API是通过`AnthropicProvider`类实现的，支持Claude 3系列中具备tool use能力的模型。

### 格式转换
Anthropic要求工具定义通过`tools`参数传递，格式遵循以下结构：
```typescript
{
  tools: [
    {
      name: string;
      description: string;
      input_schema: object; // JSON Schema格式
    }
  ]
}
```

### 上下文组织
Anthropic对消息格式有特殊要求，特别是工具调用相关的消息结构：
1. 系统消息（system）：独立于对话消息，通过`system`参数传递
2. 用户消息（user）：包含`content`数组，可以包含文本和图像
3. 助手消息（assistant）：可以包含工具调用，使用`tool_use`类型的内容块
4. 工具响应：作为用户消息的一部分，使用`tool_result`类型的内容块

`formatMessages`方法负责将标准聊天消息转换为Anthropic格式：
```typescript
private formatMessages(messages: ChatMessage[]): {
  system?: string;
  messages: Anthropic.MessageParam[];
}
```

### 流式处理
Claude API返回的工具调用事件包括：
- `content_block_start`（类型为`tool_use`）：工具调用开始
- `content_block_delta`（带有`input_json_delta`）：工具参数流式更新
- `content_block_stop`：工具调用结束
- `message_delta`（带有`stop_reason: 'tool_use'`）：因工具调用而停止生成

这些事件被转换为标准化的`LLMCoreStreamEvent`事件：
```typescript
{
  type: 'tool_call_start' | 'tool_call_chunk' | 'tool_call_end';
  tool_call_id?: string;
  tool_call_name?: string;
  tool_call_arguments_chunk?: string;
  tool_call_arguments_complete?: string;
}
```

## 范例 Anthropic的Tool Use实现
### 工具定义
首先，定义一个getTime工具：
``` json
{
  "name": "getTime",
  "description": "获取特定时间偏移量的时间戳（毫秒）。可用于获取过去或未来的时间。正数表示未来时间，负数表示过去时间。例如，要获取昨天的时间戳，使用-86400000作为偏移量（一天的毫秒数）。",
  "input_schema": {
    "type": "object",
    "properties": {
      "offset_ms": {
        "type": "number",
        "description": "相对于当前时间的毫秒数偏移量。负值表示过去时间，正值表示未来时间。"
      }
    },
    "required": ["offset_ms"]
  }
}
```
### 用户请求示例
```json
{
  "role": "user",
  "content": [
    {
      "type": "text",
      "text": "请告诉我昨天的日期是什么时候？"
    }
  ]
}
```
### 大模型响应
```json
{
  "role": "assistant",
  "content": [
    {
      "type": "text",
      "text": "为了告诉您昨天的日期，我需要获取昨天的时间戳。"
    },
    {
      "type": "tool_use",
      "id": "toolu_01ABCDEFGHIJKLMNOPQRST",
      "name": "getTime",
      "input": {"offset_ms": -86400000}
    }
  ]
}
```
### MCP 模块执行命令
```json
{
  "role": "user",
  "content": [
    {
      "type": "tool_result",
      "tool_use_id": "toolu_01ABCDEFGHIJKLMNOPQRST",
      "result": "1684713600000"
    }
  ]
}
```
### 最终大模型结合上下文给出答案
```json
{
  "role": "assistant",
  "content": [
    {
      "type": "text",
      "text": "根据获取的时间戳1684713600000，昨天的日期是2023年5月22日。这个时间戳表示从1970年1月1日至昨天的毫秒数。"
    }
  ]
}
```
## Gemini tool API 和上下文组织格式

Gemini通过`GeminiProvider`类实现工具调用功能，支持Gemini Pro及更新版本的模型。

### 格式转换
Gemini要求工具定义传递为以下格式：
```typescript
{
  tools: [
    {
      functionDeclarations: [
        {
          name: string,
          description: string,
          parameters: object // OpenAPI格式的JSON Schema
        }
      ]
    }
  ]
}
```

### 上下文组织
Gemini的消息结构相对简单，但有一些特殊处理：
1. 系统指令（systemInstruction）：作为独立参数传递
2. 内容数组（contents）：包含用户和模型消息
3. 工具调用：通过`functionCall`对象表示
4. 工具响应：通过`functionResponse`对象表示

### 流式处理
Gemini的流式响应需要处理以下特殊情况：
- `functionCall`对象表示工具调用开始
- 函数参数通过`functionCall.args`对象传递
- `functionCallResult`事件表示工具响应

这些事件同样被转换为标准的`LLMCoreStreamEvent`格式，方便统一处理。

## 范例：Gemini 的 Tool Use 实现

### 工具定义
```json
{
  "tools": [
    {
      "functionDeclarations": [
        {
          "name": "getTime",
          "description": "获取特定时间偏移量的时间戳（毫秒）。",
          "parameters": {
            "type": "object",
            "properties": {
              "offset_ms": {
                "type": "number",
                "description": "相对于当前时间的毫秒偏移量，负数表示过去，正数表示未来。"
              }
            },
            "required": ["offset_ms"]
          }
        }
      ]
    }
  ]
}
```

### 用户请求示例
```json
{
  "role": "user",
  "parts": [
    {
      "text": "请告诉我昨天的日期是什么时候？"
    }
  ]
}
```

### 大模型响应（调用工具）
```json
{
  "role": "model",
  "parts": [
    {
      "functionCall": {
        "name": "getTime",
        "args": {
          "offset_ms": -86400000
        }
      }
    }
  ]
}
```

### MCP 模块执行命令
```json
{
  "role": "user",
  "parts": [
    {
      "functionResponse": {
        "name": "getTime",
        "response": 1684713600000
      }
    }
  ]
}
```

### 最终大模型结合上下文给出答案
```json
{
  "role": "model",
  "parts": [
    {
      "text": "根据获取的时间戳1684713600000，昨天的日期是2023年5月22日。"
    }
  ]
}
```

## OpenAI tool API 和上下文组织格式

OpenAI的工具调用实现在`OpenAICompatibleProvider`类中，支持GPT-3.5-Turbo和GPT-4系列模型。

### 格式转换
OpenAI的函数调用格式最为广泛使用：
```typescript
{
  tools: [
    {
      type: "function",
      function: {
        name: string,
        description: string,
        parameters: object // JSON Schema格式
      }
    }
  ]
}
```

### 上下文组织
OpenAI的消息格式比较标准化：
1. 消息数组（messages）：包含role和content
2. 工具调用：记录在assistant消息中的`tool_calls`数组
3. 工具响应：作为单独的`tool`角色消息，包含`tool_call_id`引用

### 流式处理
OpenAI的流式事件包括：
- `tool_calls`数组表示工具调用
- 流式API返回`delta.tool_calls`表示工具调用的增量更新
- 流式工具参数通过`tool_calls[i].function.arguments`传递

这些事件同样被标准化为通用的`LLMCoreStreamEvent`格式。

## 范例：OpenAI 的 Tool Use 实现

### 工具定义
```json
{
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "getTime",
        "description": "获取特定时间偏移量的时间戳（毫秒）。",
        "parameters": {
          "type": "object",
          "properties": {
            "offset_ms": {
              "type": "number",
              "description": "相对于当前时间的毫秒偏移量，负数表示过去，正数表示未来。"
            }
          },
          "required": ["offset_ms"]
        }
      }
    }
  ]
}
```

### 用户请求示例
```json
[
  {
    "role": "user",
    "content": "请告诉我昨天的日期是什么时候？"
  }
]
```

### 大模型响应（调用工具）
```json
[
  {
    "role": "assistant",
    "content": null,
    "tool_calls": [
      {
        "id": "call_abc123",
        "type": "function",
        "function": {
          "name": "getTime",
          "arguments": "{ \"offset_ms\": -86400000 }"
        }
      }
    ]
  }
]
```

### MCP 模块执行命令
```json
[
  {
    "role": "tool",
    "tool_call_id": "call_abc123",
    "content": "1684713600000"
  }
]
```

### 最终大模型结合上下文给出答案
```json
[
  {
    "role": "assistant",
    "content": "根据获取的时间戳1684713600000，昨天的日期是2023年5月22日。"
  }
]
```

## 不支持 Tool Use 的模型如何用提示词工程来实现，流式内容如何正确解析函数信息

对于不支持原生工具调用的模型，项目实现了基于提示词工程的替代方案：

### 提示词包装
在`OpenAICompatibleProvider`中的`prepareFunctionCallPrompt`方法实现了这一功能：
```typescript
private prepareFunctionCallPrompt(
  messages: ChatCompletionMessageParam[],
  mcpTools: MCPToolDefinition[]
): ChatCompletionMessageParam[]
```

该方法将工具定义作为指令添加到系统消息中，包括：
1. 工具调用格式说明（通常使用XML风格标签如`<function_call>`）
2. 工具定义的JSON Schema
3. 使用示例和格式要求

### 流式内容解析
从流式文本中解析函数调用通过正则表达式和状态机实现：
```typescript
protected parseFunctionCalls(
  response: string,
  fallbackIdPrefix: string = 'tool-call'
): Array<{ id: string; type: string; function: { name: string; arguments: string } }>
```

解析过程处理以下挑战：
1. 检测函数调用的开始和结束标记
2. 处理嵌套的JSON结构
3. 处理不完整或格式错误的函数调用
4. 为函数调用分配唯一ID

流式解析通过状态机（`TagState`）跟踪标签状态：
```typescript
type TagState = 'none' | 'start' | 'inside' | 'end'
```

这使得即使在复杂的流式生成中，也能准确识别和提取函数调用信息。

### 使用同样的getTime示例，提示词工程方案的流程如下：

1. 添加函数描述到系统提示中：
```
你是一个有用的AI助手。当需要时，你可以使用以下工具帮助回答问题:

function getTime(offset_ms: number): number
描述: 获取当前时间偏移后的毫秒数时间戳
参数:
  - offset_ms: 时间偏移量(毫秒)

使用工具时，请使用以下格式:
<function_call>
{
  "name": "getTime",
  "arguments": {
    "offset_ms": -86400000
  }
}
</function_call>
```

2. 模型生成带有函数调用标记的回复：
```
我需要获取昨天的日期。我将调用getTime函数获取昨天的时间戳。

<function_call>
{
  "name": "getTime",
  "arguments": {
    "offset_ms": -86400000
  }
}
</function_call>
```

3. 通过正则表达式解析函数调用：
```typescript
// 使用状态机和正则匹配提取<function_call>标签内容
const functionCallMatch = response.match(/<function_call>([\s\S]*?)<\/function_call>/);
if (functionCallMatch) {
  try {
    const parsedCall = JSON.parse(functionCallMatch[1]);
    // 调用函数并获取结果
  } catch (error) {
    // 处理解析错误
  }
}
```

4. 将函数结果添加到上下文中：
```
函数结果: 1684713600000

根据获取的时间戳，昨天是5月22日。
```

这种方法通过精心设计的提示词和文本解析技术，使不支持原生工具调用的模型也能模拟工具调用功能。



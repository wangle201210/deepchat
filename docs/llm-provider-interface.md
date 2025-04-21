# LLM Provider 接口设计文档

本文档详细介绍了DeepChat中LLM Provider的接口设计，特别是`completions`和`streamCompletions`方法的区别及使用场景。

## 基础架构设计

DeepChat采用了基于抽象类`BaseLLMProvider`的设计模式，所有特定的LLM提供商（如OpenAI、Anthropic、Gemini、Ollama等）都继承自这个基类并实现其抽象方法。

### BaseLLMProvider的主要职责

1. 定义所有LLM提供商必须实现的通用接口（如`completions`, `streamCompletions`）
2. 提供模型管理相关的核心逻辑（例如，验证模型配置、与特定Provider API交互以获取或管理模型信息），但不负责触发全局的模型列表更新事件。模型列表的变更通知由配置系统（`ConfigPresenter`）负责。
3. 提供工具调用相关的公共实用方法
4. 处理提供商初始化、验证和代理配置

## completions与streamCompletions的区别

### completions方法

`completions`方法提供了同步（一次性）返回完整响应的能力：

```typescript
abstract completions(
  messages: ChatMessage[],
  modelId: string,
  temperature?: number,
  maxTokens?: number
): Promise<LLMResponse>
```

**特点**：
- 一次性返回完整的响应结果
- 包含完整的token使用统计
- 解析并处理`<think>`标签，提取reasoning_content
- 不进行工具调用（工具调用仅在stream版本中处理）
- 适合需要等待完整结果的场景，如离线总结、标题生成等

**返回数据**：
- content：生成的主要内容
- reasoning_content：思考过程（如果有）
- totalUsage：token使用统计

### streamCompletions方法

`streamCompletions`方法提供了流式响应的能力：

```typescript
abstract streamCompletions(
  messages: ChatMessage[],
  modelId: string,
  temperature?: number,
  maxTokens?: number
): AsyncGenerator<LLMResponseStream>
```

**特点**：
- 实时流式返回部分响应
- 支持工具调用（通过function calling）
- 支持思考过程的实时展示
- 支持多轮工具调用的连续对话
- 适合需要即时反馈的交互场景

**流式返回数据**：
- content：当前生成的内容片段
- reasoning_content：当前生成的思考内容片段
- tool_call相关信息：工具调用的各种状态和数据
- totalUsage：最终的token使用统计（仅在流结束时）

## 实现细节

每个LLM提供商实现这两个方法的方式各不相同，但遵循相同的接口规范：

1. **OpenAICompatibleProvider**：使用OpenAI官方SDK实现，支持原生function calling
2. **AnthropicProvider**：使用Anthropic官方SDK实现，支持Claude的tool use功能
3. **GeminiProvider**：使用Google AI SDK实现，通过额外处理实现工具调用
4. **OllamaProvider**：使用Ollama API实现，通过特殊提示词实现工具调用

## 常见处理流程

### completions处理流程

1. 格式化消息（用户、系统、助手消息）
2. 配置请求参数（温度、最大token等）
3. 发送请求获取完整响应
4. 提取token使用统计
5. 处理`<think>`标签，分离普通内容和思考内容
6. 返回结构化响应

### streamCompletions处理流程

1. 格式化消息
2. 配置工具定义（如果有）
3. 创建流式请求
4. 处理流式响应片段：
   - 普通内容片段
   - 思考内容片段
   - 工具调用识别和处理
5. 如果有工具调用，处理工具调用并继续对话
6. 最终返回token统计

## 设计考虑

1. **一致性**：所有提供商实现相同的接口，确保上层应用可以无缝切换
2. **可扩展性**：新的LLM提供商只需继承BaseLLMProvider并实现其抽象方法
3. **错误处理**：统一的错误处理机制，确保应用稳定性
4. **代理支持**：内置代理配置支持，适应不同网络环境
5. **自定义模型**：支持添加和管理自定义模型

## 使用最佳实践

- 对于需要即时反馈的对话场景，使用`streamCompletions`
- 对于后台处理任务，如生成摘要或标题，使用`completions`
- 对于需要工具调用的场景，使用`streamCompletions`
- 使用`<think>`标签可以让模型展示思考过程

## 内部机制

### Token计数处理

不同提供商提供的token计数机制不同：
- OpenAI提供准确的token计数
- Anthropic在响应中包含input_tokens和output_tokens
- Gemini需要估算token数量
- Ollama通过prompt_eval_count和eval_count提供估计

### 思考内容处理

通过`<think>`标签识别模型的思考过程：
- 识别`<think>`和`</think>`标签
- 提取标签之间的内容作为reasoning_content
- 将标签外的内容作为普通content返回

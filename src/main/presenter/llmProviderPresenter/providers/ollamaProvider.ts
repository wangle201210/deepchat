import {
  LLM_PROVIDER,
  LLMResponse,
  LLMResponseStream,
  MODEL_META,
  OllamaModel,
  ProgressResponse,
  MCPToolDefinition
} from '@shared/presenter'
import { BaseLLMProvider, ChatMessage } from '../baseProvider'
import { ConfigPresenter } from '../../configPresenter'
import { Ollama, Message, ShowResponse } from 'ollama'
import { presenter } from '@/presenter'

// 定义 Ollama 工具类型
interface OllamaTool {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: {
      type: 'object'
      properties: {
        [key: string]: {
          type: string
          description: string
          enum?: string[]
        }
      }
      required: string[]
    }
  }
}

export class OllamaProvider extends BaseLLMProvider {
  private ollama: Ollama
  constructor(provider: LLM_PROVIDER, configPresenter: ConfigPresenter) {
    super(provider, configPresenter)
    this.ollama = new Ollama({ host: this.provider.baseUrl })
    this.init()
  }

  // 基础 Provider 功能实现
  protected async fetchProviderModels(): Promise<MODEL_META[]> {
    try {
      console.log('Ollama service check', this.ollama, this.provider)
      // 获取 Ollama 本地已安装的模型列表
      const ollamaModels = await this.listModels()

      // 将 Ollama 模型格式转换为应用程序的 MODEL_META 格式
      return ollamaModels.map((model) => ({
        id: model.name,
        name: model.name,
        providerId: this.provider.id,
        contextLength: 8192, // 默认值，可以根据实际模型信息调整
        maxTokens: 2048, // 添加必需的 maxTokens 字段
        isCustom: false,
        group: model.details?.family || 'default',
        description: `${model.details?.parameter_size || ''} ${model.details?.family || ''} model`
      }))
    } catch (error) {
      console.error('Failed to fetch Ollama models:', error)
      return []
    }
  }

  // 辅助方法：格式化消息
  private formatMessages(messages: ChatMessage[]): Message[] {
    return messages.map((msg) => {
      if (typeof msg.content === 'string') {
        return {
          role: msg.role,
          content: msg.content
        }
      } else {
        // 分离文本和图片内容
        const text = msg.content
          .filter((c) => c.type === 'text')
          .map((c) => c.text)
          .join('\n')

        const images = msg.content
          .filter((c) => c.type === 'image_url')
          .map((c) => c.image_url?.url) as string[]

        return {
          role: msg.role,
          content: text,
          ...(images.length > 0 && { images })
        }
      }
    })
  }

  public async check(): Promise<{ isOk: boolean; errorMsg: string | null }> {
    try {
      // 尝试获取模型列表来检查 Ollama 服务是否可用
      await this.ollama.list()
      return { isOk: true, errorMsg: null }
    } catch (error) {
      console.error('Ollama service check failed:', error)
      return {
        isOk: false,
        errorMsg: `无法连接到 Ollama 服务: ${(error as Error).message}`
      }
    }
  }

  public async summaryTitles(messages: ChatMessage[], modelId: string): Promise<string> {
    try {
      const prompt = `根据以下对话生成一个简短的标题（不超过6个字）：\n\n${messages
        .map((m) => `${m.role}: ${m.content}`)
        .join('\n')}`

      const response = await this.ollama.generate({
        model: modelId,
        prompt: prompt,
        options: {
          temperature: 0.3,
          num_predict: 30
        }
      })

      return response.response.trim()
    } catch (error) {
      console.error('Failed to generate title with Ollama:', error)
      return '新对话'
    }
  }

  public async completions(
    messages: ChatMessage[],
    modelId: string,
    temperature?: number,
    maxTokens?: number
  ): Promise<LLMResponse> {
    try {
      const response = await this.ollama.chat({
        model: modelId,
        messages: this.formatMessages(messages),
        options: {
          temperature: temperature || 0.7,
          num_predict: maxTokens
        }
      })

      const resultResp: LLMResponse = {
        content: ''
      }

      // Ollama可能不提供完整的token计数
      if (response.prompt_eval_count !== undefined || response.eval_count !== undefined) {
        resultResp.totalUsage = {
          prompt_tokens: response.prompt_eval_count || 0,
          completion_tokens: response.eval_count || 0,
          total_tokens: (response.prompt_eval_count || 0) + (response.eval_count || 0)
        }
      }

      // 处理<think>标签
      const content = response.message?.content || ''
      if (content.includes('<think>')) {
        const thinkStart = content.indexOf('<think>')
        const thinkEnd = content.indexOf('</think>')

        if (thinkEnd > thinkStart) {
          // 提取reasoning_content
          resultResp.reasoning_content = content.substring(thinkStart + 7, thinkEnd).trim()

          // 合并<think>前后的普通内容
          const beforeThink = content.substring(0, thinkStart).trim()
          const afterThink = content.substring(thinkEnd + 8).trim()
          resultResp.content = [beforeThink, afterThink].filter(Boolean).join('\n')
        } else {
          // 如果没有找到配对的结束标签，将所有内容作为普通内容
          resultResp.content = content
        }
      } else {
        // 没有think标签，所有内容作为普通内容
        resultResp.content = content
      }

      return resultResp
    } catch (error) {
      console.error('Ollama completions failed:', error)
      throw error
    }
  }

  public async summaries(
    text: string,
    modelId: string,
    temperature?: number,
    maxTokens?: number
  ): Promise<LLMResponse> {
    try {
      const prompt = `请对以下内容进行总结：\n\n${text}`

      const response = await this.ollama.generate({
        model: modelId,
        prompt: prompt,
        options: {
          temperature: temperature || 0.5,
          num_predict: maxTokens
        }
      })

      return {
        content: response.response,
        reasoning_content: undefined
      }
    } catch (error) {
      console.error('Ollama summaries failed:', error)
      throw error
    }
  }

  public async generateText(
    prompt: string,
    modelId: string,
    temperature?: number,
    maxTokens?: number
  ): Promise<LLMResponse> {
    try {
      const response = await this.ollama.generate({
        model: modelId,
        prompt: prompt,
        options: {
          temperature: temperature || 0.7,
          num_predict: maxTokens
        }
      })

      return {
        content: response.response,
        reasoning_content: undefined
      }
    } catch (error) {
      console.error('Ollama generate text failed:', error)
      throw error
    }
  }

  public async suggestions(
    context: string,
    modelId: string,
    temperature?: number,
    maxTokens?: number
  ): Promise<string[]> {
    try {
      const prompt = `基于以下上下文，生成5个可能的后续问题或建议：\n\n${context}`

      const response = await this.ollama.generate({
        model: modelId,
        prompt: prompt,
        options: {
          temperature: temperature || 0.8,
          num_predict: maxTokens || 200
        }
      })

      // 简单处理返回的文本，按行分割，并过滤掉空行
      return response.response
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && line.length > 0)
        .slice(0, 5) // 最多返回5个建议
    } catch (error) {
      console.error('Ollama suggestions failed:', error)
      return []
    }
  }

  public async *streamCompletions(
    messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
    modelId: string,
    temperature?: number,
    maxTokens?: number
  ): AsyncGenerator<LLMResponseStream> {
    try {
      // 获取MCP工具定义
      const mcpTools = await presenter.mcpPresenter.getAllToolDefinitions()

      // 记录已处理的工具响应ID
      const processedToolCallIds = new Set<string>()

      // 维护消息上下文
      const conversationMessages = [...messages].map((m) => ({
        role: m.role,
        content: m.content
      })) as Message[]

      // 记录是否需要继续对话
      let needContinueConversation = false

      // 添加工具调用计数
      let toolCallCount = 0
      const MAX_TOOL_CALLS = BaseLLMProvider.MAX_TOOL_CALLS // 最大工具调用次数限制

      // 初始化 usage 统计
      const totalUsage = {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0
      }

      // 启动初始流
      let stream = await this.ollama.chat({
        model: modelId,
        messages: conversationMessages,
        options: {
          temperature: temperature || 0.7,
          num_predict: maxTokens
        },
        stream: true,
        tools: mcpTools.length > 0 ? await this.convertToOllamaTools(mcpTools) : undefined
      })

      let hasCheckedFirstChunk = false
      let hasReasoningContent = false
      let buffer = ''
      let isInThinkTag = false
      let initialBuffer = '' // 用于累积开头的内容
      const WINDOW_SIZE = 10 // 滑动窗口大小

      // 辅助函数：清理标签并返回清理后的位置
      const cleanTag = (text: string, tag: string): { cleanedPosition: number; found: boolean } => {
        const tagIndex = text.indexOf(tag)
        if (tagIndex === -1) return { cleanedPosition: 0, found: false }

        // 查找标签结束位置（跳过可能的空白字符）
        let endPosition = tagIndex + tag.length
        while (endPosition < text.length && /\s/.test(text[endPosition])) {
          endPosition++
        }
        return { cleanedPosition: endPosition, found: true }
      }

      // 收集完整的助手响应
      let fullAssistantResponse = ''
      let pendingToolCalls: Array<{
        id: string
        function: { name: string; arguments: string }
        type: 'function'
        index: number
      }> = []

      while (true) {
        // 当前对话回合的usage计数
        const currentUsage = {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0
        }

        for await (const chunk of stream) {
          const choice = chunk.message

          // 更新usage统计（估算，因为Ollama可能不提供完整的token计数）
          if (chunk.eval_count) {
            // 如果Ollama提供了eval_count（完成的token数量）
            currentUsage.completion_tokens = chunk.eval_count
            currentUsage.total_tokens = chunk.eval_count + currentUsage.prompt_tokens
          }

          if (chunk.prompt_eval_count) {
            // 如果Ollama提供了prompt_eval_count（提示的token数量）
            currentUsage.prompt_tokens = chunk.prompt_eval_count
            currentUsage.total_tokens = chunk.prompt_eval_count + currentUsage.completion_tokens
          }

          // 处理工具调用
          if (choice?.tool_calls && choice.tool_calls.length > 0) {
            // 初始化tool_calls数组（如果尚未初始化）
            if (!pendingToolCalls) {
              pendingToolCalls = []
            }

            // 更新工具调用
            for (const toolCall of choice.tool_calls) {
              const existingToolCall = pendingToolCalls.find(
                (tc) => tc.id === toolCall.function.name
              )

              if (existingToolCall) {
                // 更新现有工具调用
                if (toolCall.function) {
                  if (toolCall.function.name && !existingToolCall.function.name) {
                    existingToolCall.function.name = toolCall.function.name
                  }

                  if (toolCall.function.arguments) {
                    existingToolCall.function.arguments = JSON.stringify(
                      toolCall.function.arguments
                    )
                  }
                }
              } else {
                // 添加新的工具调用
                pendingToolCalls.push({
                  id: toolCall.function.name,
                  type: 'function',
                  index: pendingToolCalls.length,
                  function: {
                    name: toolCall.function.name,
                    arguments: JSON.stringify(toolCall.function.arguments)
                  }
                })
              }
            }

            // 通知工具调用更新
            yield {
              content: ''
            }

            continue
          }

          // 处理工具调用完成的情况
          if (
            (choice?.content?.length == 0 || choice?.content === null) &&
            pendingToolCalls.length > 0
          ) {
            needContinueConversation = true

            // 添加助手消息到上下文
            conversationMessages.push({
              role: 'assistant',
              content: fullAssistantResponse
            })

            // 处理工具调用并获取工具响应
            for (const toolCall of pendingToolCalls) {
              if (processedToolCallIds.has(toolCall.id)) {
                continue
              }

              processedToolCallIds.add(toolCall.id)
              const mcpTool = await presenter.mcpPresenter.openAIToolsToMcpTool(
                {
                  function: {
                    name: toolCall.function.name,
                    arguments: toolCall.function.arguments
                  }
                },
                this.provider.id
              )
              try {
                // 转换为MCP工具

                if (!mcpTool) {
                  console.warn(`Tool not found: ${toolCall.function.name}`)
                  continue
                }
                // 增加工具调用计数
                toolCallCount++

                // 检查是否达到最大工具调用次数
                if (toolCallCount >= MAX_TOOL_CALLS) {
                  yield {
                    maximum_tool_calls_reached: true,
                    tool_call_id: toolCall.id,
                    tool_call_name: toolCall.function.name,
                    tool_call_params: toolCall.function.arguments,
                    tool_call_server_name: mcpTool.server.name,
                    tool_call_server_icons: mcpTool.server.icons,
                    tool_call_server_description: mcpTool.server.description
                  }
                  needContinueConversation = false
                  break
                }
                yield {
                  content: '',
                  tool_call: 'start',
                  tool_call_name: toolCall.function.name,
                  tool_call_params: toolCall.function.arguments,
                  tool_call_server_name: mcpTool.server.name,
                  tool_call_server_icons: mcpTool.server.icons,
                  tool_call_server_description: mcpTool.server.description,
                  tool_call_id: `ollama-${toolCall.id}`
                }
                // 调用工具
                const toolCallResponse = await presenter.mcpPresenter.callTool(mcpTool)
                // 通知调用工具结束
                yield {
                  content: '',
                  tool_call: 'end',
                  tool_call_name: toolCall.function.name,
                  tool_call_params: toolCall.function.arguments,
                  tool_call_response:
                    typeof toolCallResponse.content === 'string'
                      ? toolCallResponse.content
                      : JSON.stringify(toolCallResponse.content),
                  tool_call_id: `ollama-${toolCall.id}`,
                  tool_call_server_name: mcpTool.server.name,
                  tool_call_server_icons: mcpTool.server.icons,
                  tool_call_server_description: mcpTool.server.description,
                  tool_call_response_raw: toolCallResponse.rawData
                }
                // 将工具响应添加到消息中
                conversationMessages.push({
                  role: 'tool',
                  content:
                    typeof toolCallResponse.content === 'string'
                      ? toolCallResponse.content
                      : JSON.stringify(toolCallResponse.content)
                })
              } catch (error: unknown) {
                const errorMessage = error instanceof Error ? error.message : '未知错误'
                console.error(`Error calling tool ${toolCall.function.name}:`, error)

                // 通知工具调用失败
                yield {
                  content: '',
                  tool_call: 'error',
                  tool_call_name: toolCall.function.name,
                  tool_call_params: toolCall.function.arguments,
                  tool_call_response: errorMessage,
                  tool_call_id: `ollama-${toolCall.id}`,
                  tool_call_server_name: mcpTool?.server.name,
                  tool_call_server_icons: mcpTool?.server.icons,
                  tool_call_server_description: mcpTool?.server.description
                }

                // 添加错误响应到消息中
                conversationMessages.push({
                  role: 'tool',
                  content: `Error: ${errorMessage}`
                })
              }
            }

            // 如果达到最大工具调用次数，则跳出循环
            if (toolCallCount >= MAX_TOOL_CALLS) {
              break
            }

            // 重置变量，准备继续对话
            pendingToolCalls = []
            fullAssistantResponse = ''
            break
          }

          // 处理普通内容
          const content = choice?.content || ''
          if (!content) continue

          // 累积完整响应
          fullAssistantResponse += content

          // 检查是否包含 <think> 标签
          if (!hasCheckedFirstChunk) {
            initialBuffer += content
            if (
              initialBuffer.includes('<think>') ||
              (initialBuffer.length >= 6 && !'<think>'.startsWith(initialBuffer.trimStart()))
            ) {
              hasCheckedFirstChunk = true
              const trimmedContent = initialBuffer.trimStart()
              hasReasoningContent = trimmedContent.includes('<think>')

              if (!hasReasoningContent) {
                yield {
                  content: initialBuffer
                }
                initialBuffer = ''
              } else {
                buffer = initialBuffer
                initialBuffer = ''
                if (buffer.includes('<think>')) {
                  isInThinkTag = true
                  const thinkStart = buffer.indexOf('<think>')
                  if (thinkStart > 0) {
                    yield {
                      content: buffer.substring(0, thinkStart)
                    }
                  }
                  const { cleanedPosition } = cleanTag(buffer, '<think>')
                  buffer = buffer.substring(cleanedPosition)
                }
              }
              continue
            } else {
              continue
            }
          }

          if (!hasReasoningContent) {
            yield {
              content: content
            }
            continue
          }

          if (!isInThinkTag && buffer.includes('<think>')) {
            isInThinkTag = true
            const thinkStart = buffer.indexOf('<think>')
            if (thinkStart > 0) {
              yield {
                content: buffer.substring(0, thinkStart)
              }
            }
            const { cleanedPosition } = cleanTag(buffer, '<think>')
            buffer = buffer.substring(cleanedPosition)
          } else if (isInThinkTag) {
            buffer += content
            const { found: hasEndTag, cleanedPosition } = cleanTag(buffer, '</think>')
            if (hasEndTag) {
              const thinkEnd = buffer.indexOf('</think>')
              if (thinkEnd > 0) {
                yield {
                  reasoning_content: buffer.substring(0, thinkEnd)
                }
              }
              buffer = buffer.substring(cleanedPosition)
              isInThinkTag = false
              hasReasoningContent = false

              if (buffer) {
                yield {
                  content: buffer
                }
                buffer = ''
              }
            } else {
              if (buffer.length > WINDOW_SIZE) {
                const contentToYield = buffer.slice(0, -WINDOW_SIZE)
                yield {
                  reasoning_content: contentToYield
                }
                buffer = buffer.slice(-WINDOW_SIZE)
              }
            }
          } else {
            buffer += content
            yield {
              content: buffer
            }
            buffer = ''
          }
        }

        // 累加当前对话回合的usage到总usage
        totalUsage.prompt_tokens += currentUsage.prompt_tokens
        totalUsage.completion_tokens += currentUsage.completion_tokens
        totalUsage.total_tokens += currentUsage.total_tokens

        // 如果达到最大工具调用次数，则跳出循环
        if (toolCallCount >= MAX_TOOL_CALLS) {
          break
        }

        // 如果需要继续对话，创建新的流
        if (needContinueConversation) {
          needContinueConversation = false
          stream = await this.ollama.chat({
            model: modelId,
            messages: conversationMessages,
            options: {
              temperature: temperature || 0.7,
              num_predict: maxTokens
            },
            stream: true,
            tools: mcpTools.length > 0 ? await this.convertToOllamaTools(mcpTools) : undefined
          })
        } else {
          // 对话结束
          break
        }
      }

      // 处理剩余的 buffer
      if (initialBuffer) {
        yield {
          content: initialBuffer
        }
      }
      if (buffer) {
        if (isInThinkTag) {
          yield {
            reasoning_content: buffer
          }
        } else {
          yield {
            content: buffer
          }
        }
      }

      // 最后输出总usage统计
      yield {
        totalUsage: totalUsage
      }
    } catch (error) {
      console.error('Ollama stream completions failed:', error)
      throw error
    }
  }

  public async *streamSummaries(
    text: string,
    modelId: string,
    temperature?: number,
    maxTokens?: number
  ): AsyncGenerator<LLMResponseStream> {
    try {
      const prompt = `请对以下内容进行总结：\n\n${text}`

      const stream = await this.ollama.generate({
        model: modelId,
        prompt: prompt,
        options: {
          temperature: temperature || 0.5,
          num_predict: maxTokens
        },
        stream: true
      })

      for await (const chunk of stream) {
        if (chunk.response) {
          yield {
            content: chunk.response,
            reasoning_content: undefined
          }
        }
      }

      // 最终流结束时不需要传递 isEnd 参数
    } catch (error) {
      console.error('Ollama stream summaries failed:', error)
      throw error
    }
  }

  public async *streamGenerateText(
    prompt: string,
    modelId: string,
    temperature?: number,
    maxTokens?: number
  ): AsyncGenerator<LLMResponseStream> {
    try {
      const stream = await this.ollama.generate({
        model: modelId,
        prompt: prompt,
        options: {
          temperature: temperature || 0.7,
          num_predict: maxTokens
        },
        stream: true
      })

      for await (const chunk of stream) {
        if (chunk.response) {
          yield {
            content: chunk.response,
            reasoning_content: undefined
          }
        }
      }

      // 最终流结束时不需要传递 isEnd 参数
    } catch (error) {
      console.error('Ollama stream generate text failed:', error)
      throw error
    }
  }

  // Ollama 特有的模型管理功能
  public async listModels(): Promise<OllamaModel[]> {
    try {
      const response = await this.ollama.list()
      // 返回类型转换，适应我们的 OllamaModel 接口
      return response.models as unknown as OllamaModel[]
    } catch (error) {
      console.error('Failed to list Ollama models:', (error as Error).message)
      return []
    }
  }

  public async listRunningModels(): Promise<OllamaModel[]> {
    try {
      const response = await this.ollama.ps()
      return response.models as unknown as OllamaModel[]
    } catch (error) {
      console.error('Failed to list running Ollama models:', (error as Error).message)
      return []
    }
  }

  public async pullModel(
    modelName: string,
    onProgress?: (progress: ProgressResponse) => void
  ): Promise<boolean> {
    try {
      const stream = await this.ollama.pull({
        model: modelName,
        insecure: true,
        stream: true
      })

      for await (const chunk of stream) {
        if (onProgress) {
          onProgress(chunk as ProgressResponse)
        }
      }

      return true
    } catch (error) {
      console.error(`Failed to pull Ollama model ${modelName}:`, (error as Error).message)
      return false
    }
  }

  public async deleteModel(modelName: string): Promise<boolean> {
    try {
      await this.ollama.delete({
        model: modelName
      })
      return true
    } catch (error) {
      console.error(`Failed to delete Ollama model ${modelName}:`, (error as Error).message)
      return false
    }
  }

  public async showModelInfo(modelName: string): Promise<ShowResponse> {
    try {
      const response = await this.ollama.show({
        model: modelName
      })
      return response
    } catch (error) {
      console.error(`Failed to show Ollama model info for ${modelName}:`, (error as Error).message)
      throw error
    }
  }

  // 辅助方法：将 MCP 工具转换为 Ollama 工具格式
  private async convertToOllamaTools(mcpTools: MCPToolDefinition[]): Promise<OllamaTool[]> {
    const openAITools = await presenter.mcpPresenter.mcpToolsToOpenAITools(
      mcpTools,
      this.provider.id
    )
    return openAITools.map((rawTool) => {
      const tool = rawTool as unknown as {
        function: {
          name: string
          description?: string
          parameters: { properties: Record<string, unknown>; required?: string[] }
        }
      }
      const properties = tool.function.parameters.properties || {}
      const convertedProperties: Record<
        string,
        { type: string; description: string; enum?: string[] }
      > = {}

      for (const [key, value] of Object.entries(properties)) {
        if (typeof value === 'object' && value !== null) {
          const param = value as { type: unknown; description: unknown; enum?: string[] }
          convertedProperties[key] = {
            type: String(param.type || 'string'),
            description: String(param.description || ''),
            ...(param.enum ? { enum: param.enum } : {})
          }
        }
      }

      return {
        type: 'function' as const,
        function: {
          name: tool.function.name,
          description: tool.function.description || '',
          parameters: {
            type: 'object' as const,
            properties: convertedProperties,
            required: tool.function.parameters.required || []
          }
        }
      }
    })
  }
  public onProxyResolved(): void {
    console.log('ollama onProxyResolved')
  }
}

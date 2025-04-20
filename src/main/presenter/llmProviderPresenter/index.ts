import {
  ILlmProviderPresenter,
  LLM_PROVIDER,
  LLMResponse,
  LLMResponseStream,
  MCPToolDefinition,
  MCPToolCall,
  MODEL_META,
  OllamaModel
} from '@shared/presenter'
import { BaseLLMProvider, ChatMessage, ChatMessageContent } from './baseProvider'
import { OpenAIProvider } from './providers/openAIProvider'
import { DeepseekProvider } from './providers/deepseekProvider'
import { SiliconcloudProvider } from './providers/siliconcloudProvider'
import { eventBus } from '@/eventbus'
import { OpenAICompatibleProvider } from './providers/openAICompatibleProvider'
import { PPIOProvider } from './providers/ppioProvider'
import { getModelConfig } from './modelConfigs'
import { OLLAMA_EVENTS, STREAM_EVENTS } from '@/events'
import { ConfigPresenter } from '../configPresenter'
import { GeminiProvider } from './providers/geminiProvider'
import { GithubProvider } from './providers/githubProvider'
import { OllamaProvider } from './providers/ollamaProvider'
import { AnthropicProvider } from './providers/anthropicProvider'
import { DoubaoProvider } from './providers/doubaoProvider'
import { ShowResponse } from 'ollama'
import { CONFIG_EVENTS } from '@/events'
import { GrokProvider } from './providers/grokProvider'
import { presenter } from '@/presenter'

// 流的状态
interface StreamState {
  isGenerating: boolean
  providerId: string
  modelId: string
  abortController: AbortController
  provider: BaseLLMProvider
}

// 配置项
interface ProviderConfig {
  maxConcurrentStreams: number
}

export class LLMProviderPresenter implements ILlmProviderPresenter {
  private providers: Map<string, LLM_PROVIDER> = new Map()
  private providerInstances: Map<string, BaseLLMProvider> = new Map()
  private currentProviderId: string | null = null
  // 通过 eventId 管理所有的 stream
  private activeStreams: Map<string, StreamState> = new Map()
  // 配置
  private config: ProviderConfig = {
    maxConcurrentStreams: 10
  }
  private configPresenter: ConfigPresenter

  constructor(configPresenter: ConfigPresenter) {
    this.configPresenter = configPresenter
    this.init()
    // 监听代理更新事件
    eventBus.on(CONFIG_EVENTS.PROXY_RESOLVED, () => {
      // 遍历所有活跃的 provider 实例，调用 onProxyResolved
      for (const provider of this.providerInstances.values()) {
        provider.onProxyResolved()
      }
    })
  }

  private init() {
    const providers = this.configPresenter.getProviders()
    for (const provider of providers) {
      this.providers.set(provider.id, provider)
      if (provider.enable) {
        try {
          console.log('init provider', provider.id, provider.apiType)
          let instance: BaseLLMProvider
          if (provider.apiType === 'deepseek') {
            instance = new DeepseekProvider(provider, this.configPresenter)
          } else if (provider.apiType === 'silicon' || provider.apiType === 'siliconcloud') {
            instance = new SiliconcloudProvider(provider, this.configPresenter)
          } else if (provider.apiType === 'ppio') {
            instance = new PPIOProvider(provider, this.configPresenter)
          } else if (provider.apiType === 'gemini') {
            instance = new GeminiProvider(provider, this.configPresenter)
          } else if (provider.apiType === 'github') {
            instance = new GithubProvider(provider, this.configPresenter)
          } else if (provider.apiType === 'ollama') {
            instance = new OllamaProvider(provider, this.configPresenter)
          } else if (provider.apiType === 'anthropic') {
            instance = new AnthropicProvider(provider, this.configPresenter)
          } else if (provider.apiType === 'doubao') {
            instance = new DoubaoProvider(provider, this.configPresenter)
          } else if (provider.apiType === 'grok' || provider.id === 'grok') {
            console.log('match grok')
            instance = new GrokProvider(provider, this.configPresenter)
          } else if (provider.apiType === 'openai') {
            instance = new OpenAIProvider(provider, this.configPresenter)
          } else if (provider.apiType === 'openai-compatible') {
            instance = new OpenAICompatibleProvider(provider, this.configPresenter)
          } else {
            console.warn(`Unknown provider type: ${provider.apiType}`)
            continue
          }
          this.providerInstances.set(provider.id, instance)
        } catch (error) {
          console.error(`Failed to initialize provider ${provider.id}:`, error)
        }
      }
    }
  }

  getProviders(): LLM_PROVIDER[] {
    return Array.from(this.providers.values())
  }

  getCurrentProvider(): LLM_PROVIDER | null {
    return this.currentProviderId ? this.providers.get(this.currentProviderId) || null : null
  }

  getProviderById(id: string): LLM_PROVIDER {
    const provider = this.providers.get(id)
    if (!provider) {
      throw new Error(`Provider ${id} not found`)
    }
    return provider
  }

  async setCurrentProvider(providerId: string): Promise<void> {
    // 如果有正在生成的流，先停止它们
    await this.stopAllStreams()

    const provider = this.getProviderById(providerId)
    if (!provider) {
      throw new Error(`Provider ${providerId} not found`)
    }

    this.currentProviderId = providerId
    // 确保新的 provider 实例已经初始化
    this.getProviderInstance(providerId)
  }

  setProviders(providers: LLM_PROVIDER[]): void {
    // 如果有正在生成的流，先停止它们
    this.stopAllStreams()

    this.providers.clear()
    providers.forEach((provider) => {
      this.providers.set(provider.id, provider)
    })
    this.providerInstances.clear()
    const enabledProviders = Array.from(this.providers.values()).filter(
      (provider) => provider.enable
    )
    for (const provider of enabledProviders) {
      this.getProviderInstance(provider.id)
    }

    // 如果当前 provider 不在新的列表中，清除当前 provider
    if (this.currentProviderId && !providers.find((p) => p.id === this.currentProviderId)) {
      this.currentProviderId = null
    }
  }

  private getProviderInstance(providerId: string): BaseLLMProvider {
    let instance = this.providerInstances.get(providerId)
    if (!instance) {
      const provider = this.getProviderById(providerId)
      switch (provider.id) {
        case 'grok':
          instance = new GrokProvider(provider, this.configPresenter)
          break
        case 'openai':
          instance = new OpenAIProvider(provider, this.configPresenter)
          break
        case 'deepseek':
          instance = new DeepseekProvider(provider, this.configPresenter)
          break
        case 'silicon':
          instance = new SiliconcloudProvider(provider, this.configPresenter)
          break
        case 'ppio':
          instance = new PPIOProvider(provider, this.configPresenter)
          break
        case 'gemini':
          instance = new GeminiProvider(provider, this.configPresenter)
          break
        case 'github':
          instance = new GithubProvider(provider, this.configPresenter)
          break
        // 添加其他provider的实例化逻辑
        case 'ollama':
          instance = new OllamaProvider(provider, this.configPresenter)
          break
        case 'anthropic':
          instance = new AnthropicProvider(provider, this.configPresenter)
          break
        case 'doubao':
          instance = new DoubaoProvider(provider, this.configPresenter)
          break
        default:
          instance = new OpenAICompatibleProvider(provider, this.configPresenter)
          break
      }
      this.providerInstances.set(providerId, instance)
    }
    return instance
  }

  async getModelList(providerId: string): Promise<MODEL_META[]> {
    const provider = this.getProviderInstance(providerId)
    let models = await provider.fetchModels()
    models = models.map((model) => {
      const config = getModelConfig(model.id)
      if (config) {
        model.maxTokens = config.maxTokens
        model.contextLength = config.contextLength
        // 如果模型中已经有这些属性则保留，否则使用配置中的值或默认为false
        model.vision = model.vision !== undefined ? model.vision : config.vision || false
        model.functionCall =
          model.functionCall !== undefined ? model.functionCall : config.functionCall || false
        model.reasoning =
          model.reasoning !== undefined ? model.reasoning : config.reasoning || false
      } else {
        // 确保模型具有这些属性，如果没有配置，默认为false
        model.vision = model.vision || false
        model.functionCall = model.functionCall || false
        model.reasoning = model.reasoning || false
      }
      return model
    })
    return models
  }

  async updateModelStatus(providerId: string, modelId: string, enabled: boolean): Promise<void> {
    this.configPresenter.setModelStatus(providerId, modelId, enabled)
  }

  isGenerating(eventId: string): boolean {
    return this.activeStreams.has(eventId)
  }

  getStreamState(eventId: string): StreamState | null {
    return this.activeStreams.get(eventId) || null
  }

  async stopStream(eventId: string): Promise<void> {
    const stream = this.activeStreams.get(eventId)
    if (stream) {
      stream.abortController.abort()
      this.activeStreams.delete(eventId)
      eventBus.emit(STREAM_EVENTS.END, { eventId, userStop: true })
    }
  }

  private async stopAllStreams(): Promise<void> {
    const promises = Array.from(this.activeStreams.keys()).map((eventId) =>
      this.stopStream(eventId)
    )
    await Promise.all(promises)
  }

  private canStartNewStream(): boolean {
    return this.activeStreams.size < this.config.maxConcurrentStreams
  }

  private async handleStreamOperation(
    operation: () => Promise<void>,
    eventId: string,
    providerId: string,
    modelId: string
  ) {
    if (!this.canStartNewStream()) {
      throw new Error('已达到最大并发流数量限制')
    }

    if (this.activeStreams.has(eventId)) {
      throw new Error('该事件ID已存在正在生成的流')
    }

    const provider = this.getProviderInstance(providerId)
    const abortController = new AbortController()

    // 创建新的流状态
    const streamState: StreamState = {
      isGenerating: true,
      providerId,
      modelId,
      abortController,
      provider
    }

    this.activeStreams.set(eventId, streamState)

    try {
      await operation()
      eventBus.emit(STREAM_EVENTS.END, { eventId, userStop: false })
    } catch (error) {
      eventBus.emit(STREAM_EVENTS.ERROR, { error: String(error), eventId })
      throw error
    } finally {
      this.activeStreams.delete(eventId)
    }
  }

  async startStreamCompletion(
    providerId: string,
    initialMessages: ChatMessage[],
    modelId: string,
    eventId: string,
    temperature?: number,
    maxTokens?: number
  ): Promise<void> {
    console.log('Starting agent loop for event:', eventId, 'with model:', modelId)

    if (!this.canStartNewStream()) {
      throw new Error('已达到最大并发流数量限制')
    }

    const provider = this.getProviderInstance(providerId)
    const abortController = new AbortController()

    this.activeStreams.set(eventId, {
      isGenerating: true,
      providerId,
      modelId,
      abortController,
      provider
    })

    // Agent Loop Variables
    const conversationMessages: ChatMessage[] = [...initialMessages]
    let needContinueConversation = true
    let toolCallCount = 0
    const MAX_TOOL_CALLS = 20
    const totalUsage: {
      prompt_tokens: number
      completion_tokens: number
      total_tokens: number
    } = {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0
    }

    // --- Agent Loop ---
    while (needContinueConversation) {
      if (abortController.signal.aborted) {
        console.log('Agent loop aborted for event:', eventId)
        break
      }

      if (toolCallCount >= MAX_TOOL_CALLS) {
        console.warn('Maximum tool call limit reached for event:', eventId)
        eventBus.emit(STREAM_EVENTS.RESPONSE, {
          eventId,
          maximum_tool_calls_reached: true
        })
        break
      }

      needContinueConversation = false

      // Prepare for LLM call
      let currentContent = ''
      let currentReasoning = ''
      const currentToolCalls: Array<{
        id: string
        name: string
        arguments: string
      }> = []
      const currentToolChunks: Record<string, { name: string; arguments_chunk: string }> = {}

      try {
        console.log(`Loop iteration ${toolCallCount + 1} for event ${eventId}`)
        const mcpTools = await presenter.mcpPresenter.getAllToolDefinitions()

        // Call the provider's core stream method, expecting LLMCoreStreamEvent
        const stream = provider.coreStream(
          conversationMessages,
          modelId,
          temperature,
          maxTokens,
          mcpTools
        )

        // Process the standardized stream events
        for await (const chunk of stream) {
          if (abortController.signal.aborted) {
            break
          }
          // console.log('presenter chunk', JSON.stringify(chunk))

          // --- Event Handling (using LLMCoreStreamEvent structure) ---
          switch (chunk.type) {
            case 'text':
              if (chunk.content) {
                currentContent += chunk.content
                eventBus.emit(STREAM_EVENTS.RESPONSE, {
                  eventId,
                  content: chunk.content
                })
              }
              break
            case 'reasoning':
              if (chunk.reasoning_content) {
                currentReasoning += chunk.reasoning_content
                eventBus.emit(STREAM_EVENTS.RESPONSE, {
                  eventId,
                  reasoning_content: chunk.reasoning_content
                })
              }
              break
            case 'tool_call_start':
              if (chunk.tool_call_id && chunk.tool_call_name) {
                currentToolChunks[chunk.tool_call_id] = {
                  name: chunk.tool_call_name,
                  arguments_chunk: ''
                }
              }
              break
            case 'tool_call_chunk':
              if (
                chunk.tool_call_id &&
                currentToolChunks[chunk.tool_call_id] &&
                chunk.tool_call_arguments_chunk
              ) {
                currentToolChunks[chunk.tool_call_id].arguments_chunk +=
                  chunk.tool_call_arguments_chunk
              }
              break
            case 'tool_call_end':
              if (chunk.tool_call_id && currentToolChunks[chunk.tool_call_id]) {
                const completeArgs =
                  chunk.tool_call_arguments_complete ??
                  currentToolChunks[chunk.tool_call_id].arguments_chunk
                currentToolCalls.push({
                  id: chunk.tool_call_id,
                  name: currentToolChunks[chunk.tool_call_id].name,
                  arguments: completeArgs
                })
                delete currentToolChunks[chunk.tool_call_id]
              }
              break
            case 'usage':
              if (chunk.usage) {
                totalUsage.prompt_tokens += chunk.usage.prompt_tokens
                totalUsage.completion_tokens += chunk.usage.completion_tokens
                totalUsage.total_tokens += chunk.usage.total_tokens
                eventBus.emit(STREAM_EVENTS.RESPONSE, {
                  eventId,
                  totalUsage: { ...totalUsage }
                })
              }
              break
            case 'image_data':
              if (chunk.image_data) {
                eventBus.emit(STREAM_EVENTS.RESPONSE, {
                  eventId,
                  image_data: chunk.image_data
                })
                currentContent += `\n[Image data received: ${chunk.image_data.mimeType}]\n`
              }
              break
            case 'error':
              console.error(`Provider stream error for event ${eventId}:`, chunk.error_message)
              eventBus.emit(STREAM_EVENTS.ERROR, {
                eventId,
                error: chunk.error_message || 'Provider stream error'
              })
              needContinueConversation = false
              break
            case 'stop':
              console.log(
                `Provider stream stopped for event ${eventId}. Reason: ${chunk.stop_reason}`
              )
              if (chunk.stop_reason === 'tool_use') {
                // Consolidate any remaining tool call chunks
                for (const id in currentToolChunks) {
                  currentToolCalls.push({
                    id: id,
                    name: currentToolChunks[id].name,
                    arguments: currentToolChunks[id].arguments_chunk
                  })
                }

                if (currentToolCalls.length > 0) {
                  needContinueConversation = true
                } else {
                  console.warn(
                    `Stop reason was 'tool_use' but no tool calls were fully parsed for event ${eventId}.`
                  )
                  needContinueConversation = false
                }
              } else {
                needContinueConversation = false
              }
              break
          }
        } // End of inner loop (for await...of stream)

        if (abortController.signal.aborted) break // Break outer loop if aborted

        // --- Post-Stream Processing ---

        // 1. Add Assistant Message
        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: currentContent
        }
        conversationMessages.push(assistantMessage)

        // 2. Execute Tool Calls if needed
        if (needContinueConversation && currentToolCalls.length > 0) {
          console.log(`Executing ${currentToolCalls.length} tools for event ${eventId}`)
          for (const toolCall of currentToolCalls) {
            if (toolCallCount >= MAX_TOOL_CALLS) {
              console.warn('Max tool calls reached during execution phase for event:', eventId)
              eventBus.emit(STREAM_EVENTS.RESPONSE, {
                eventId,
                maximum_tool_calls_reached: true,
                tool_call_id: toolCall.id,
                tool_call_name: toolCall.name
              })
              needContinueConversation = false
              break
            }

            toolCallCount++

            // Find the tool definition to get server info
            const toolDef = (await presenter.mcpPresenter.getAllToolDefinitions()).find(
              (t) => t.function.name === toolCall.name
            )

            if (!toolDef) {
              console.error(`Tool definition not found for ${toolCall.name}. Skipping execution.`)
              eventBus.emit(STREAM_EVENTS.RESPONSE, {
                eventId,
                tool_call: 'error',
                tool_call_id: toolCall.id,
                tool_call_name: toolCall.name,
                tool_call_response: 'Tool definition not found'
              })
              conversationMessages.push({
                role: 'user',
                content: `Error: Tool definition for ${toolCall.name} not found.`
              })
              continue // Skip to next tool call
            }

            // Prepare MCPToolCall object for callTool
            const mcpToolInput: MCPToolCall = {
              id: toolCall.id,
              type: 'function',
              function: {
                name: toolCall.name,
                arguments: toolCall.arguments
              },
              server: toolDef.server
            }

            eventBus.emit(STREAM_EVENTS.RESPONSE, {
              eventId,
              tool_call: 'start',
              tool_call_id: toolCall.id,
              tool_call_name: toolCall.name,
              tool_call_params: toolCall.arguments,
              tool_call_server_name: toolDef.server.name,
              tool_call_server_icons: toolDef.server.icons,
              tool_call_server_description: toolDef.server.description
            })

            try {
              // Execute the tool via McpPresenter
              const toolResponse = await presenter.mcpPresenter.callTool(mcpToolInput)

              // 检查模型是否支持原生函数调用
              const modelConfig = getModelConfig(modelId)
              const supportsFunctionCall = modelConfig?.functionCall || false

              if (supportsFunctionCall) {
                // 对于支持原生函数调用的模型，添加tool角色消息
                conversationMessages.push({
                  role: 'tool',
                  content:
                    typeof toolResponse.content === 'string'
                      ? toolResponse.content
                      : JSON.stringify(toolResponse.content),
                  tool_call_id: toolCall.id
                } as ChatMessage)
              } else {
                // 对于不支持原生函数调用的模型，使用更复杂的处理方式

                // 1. 为最后一条assistant消息添加工具调用标记
                const lastAssistantMessage = conversationMessages.findLast(
                  (message) => message.role === 'assistant'
                )
                if (lastAssistantMessage) {
                  const toolCallInfo = `\n<function_call>
                  {
                    "function_call": ${JSON.stringify(
                      {
                        id: toolCall.id,
                        name: toolCall.name,
                        arguments: toolCall.arguments
                      },
                      null,
                      2
                    )}
                  }
                  </function_call>\n`

                  if (typeof lastAssistantMessage.content === 'string') {
                    lastAssistantMessage.content += toolCallInfo
                  }
                }

                // 2. 创建包含工具响应的用户消息
                const toolResponseContent =
                  '以下是刚刚执行的工具调用响应，请根据响应内容更新你的回答：\n' +
                  JSON.stringify({
                    role: 'tool',
                    content:
                      typeof toolResponse.content === 'string'
                        ? toolResponse.content
                        : JSON.stringify(toolResponse.content),
                    tool_call_id: toolCall.id
                  })

                // 检查最后一条消息是否是user角色
                const lastMessage = conversationMessages[conversationMessages.length - 1]

                if (lastMessage && lastMessage.role === 'user') {
                  // 如果是，则将工具调用响应附加到最后一条消息
                  if (typeof lastMessage.content === 'string') {
                    lastMessage.content += '\n' + toolResponseContent
                  } else {
                    // 如果是数组，添加新的文本部分
                    ;(lastMessage.content as ChatMessageContent[]).push({
                      type: 'text',
                      text: toolResponseContent
                    })
                  }
                } else {
                  // 如果不是，则创建新的用户消息
                  conversationMessages.push({
                    role: 'user',
                    content: toolResponseContent
                  })
                }
              }

              eventBus.emit(STREAM_EVENTS.RESPONSE, {
                eventId,
                tool_call: 'end',
                tool_call_id: toolCall.id,
                tool_call_response: toolResponse.content,
                tool_call_name: toolCall.name,
                tool_call_params: toolCall.arguments,
                tool_call_server_name: toolDef.server.name,
                tool_call_server_icons: toolDef.server.icons,
                tool_call_server_description: toolDef.server.description,
                tool_call_response_raw: toolResponse.rawData
              })
            } catch (toolError) {
              console.error(
                `Tool execution error for ${toolCall.name} (event ${eventId}):`,
                toolError
              )
              const errorMessage =
                toolError instanceof Error ? toolError.message : String(toolError)

              eventBus.emit(STREAM_EVENTS.RESPONSE, {
                eventId,
                tool_call: 'error',
                tool_call_id: toolCall.id,
                tool_call_name: toolCall.name,
                tool_call_params: toolCall.arguments,
                tool_call_response: errorMessage,
                tool_call_server_name: toolDef.server.name,
                tool_call_server_icons: toolDef.server.icons,
                tool_call_server_description: toolDef.server.description
              })

              conversationMessages.push({
                role: 'user',
                content: `Error executing tool ${toolCall.name}: ${errorMessage}`
              })
            }
          } // End of tool execution loop

          if (!needContinueConversation) {
            break
          }
        } else {
          needContinueConversation = false
        }
      } catch (error) {
        console.error(`Agent loop error for event ${eventId}:`, error)
        eventBus.emit(STREAM_EVENTS.ERROR, {
          eventId,
          error: error instanceof Error ? error.message : String(error)
        })
        needContinueConversation = false
      }
    } // --- End of Agent Loop (while) ---

    // Finalize stream
    if (!abortController.signal.aborted) {
      // Emit final aggregated usage
      eventBus.emit(STREAM_EVENTS.RESPONSE, {
        eventId,
        totalUsage
      })
      eventBus.emit(STREAM_EVENTS.END, { eventId, userStop: false })
    } else {
      eventBus.emit(STREAM_EVENTS.END, { eventId, userStop: true })
    }

    this.activeStreams.delete(eventId)
    console.log('Agent loop finished for event:', eventId)
  }

  // 非流式方法
  async generateCompletion(
    providerId: string,
    messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
    modelId: string,
    temperature?: number,
    maxTokens?: number
  ): Promise<string> {
    // 记录输入到大模型的消息内容
    console.log('generateCompletion', providerId, modelId, temperature, maxTokens, messages)
    const provider = this.getProviderInstance(providerId)
    const response = await provider.completions(messages, modelId, temperature, maxTokens)
    return response.content
  }

  async generateSummary(
    providerId: string,
    text: string,
    modelId: string,
    temperature?: number,
    maxTokens?: number
  ): Promise<LLMResponse> {
    const provider = this.getProviderInstance(providerId)
    return provider.summaries(text, modelId, temperature, maxTokens)
  }

  async generateText(
    providerId: string,
    prompt: string,
    modelId: string,
    temperature?: number,
    maxTokens?: number
  ): Promise<LLMResponse> {
    const provider = this.getProviderInstance(providerId)
    return provider.generateText(prompt, modelId, temperature, maxTokens)
  }

  async generateCompletionStandalone(
    providerId: string,
    messages: ChatMessage[],
    modelId: string,
    temperature?: number,
    maxTokens?: number
  ): Promise<string> {
    // 记录输入到大模型的消息内容
    console.log('streamCompletionStandalone', messages)
    const provider = this.getProviderInstance(providerId)
    let response = ''
    try {
      const llmResponse = await provider.completions(messages, modelId, temperature, maxTokens)
      response = llmResponse.content

      return response
    } catch (error) {
      console.error('Stream error:', error)
      return ''
    }
  }

  // 配置相关方法
  setMaxConcurrentStreams(max: number): void {
    this.config.maxConcurrentStreams = max
  }

  getMaxConcurrentStreams(): number {
    return this.config.maxConcurrentStreams
  }

  async check(providerId: string): Promise<{ isOk: boolean; errorMsg: string | null }> {
    const provider = this.getProviderInstance(providerId)
    return provider.check()
  }

  async addCustomModel(
    providerId: string,
    model: Omit<MODEL_META, 'providerId' | 'isCustom' | 'group'>
  ): Promise<MODEL_META> {
    const provider = this.getProviderInstance(providerId)
    return provider.addCustomModel(model)
  }

  async removeCustomModel(providerId: string, modelId: string): Promise<boolean> {
    const provider = this.getProviderInstance(providerId)
    return provider.removeCustomModel(modelId)
  }

  async updateCustomModel(
    providerId: string,
    modelId: string,
    updates: Partial<MODEL_META>
  ): Promise<boolean> {
    const provider = this.getProviderInstance(providerId)
    const res = provider.updateCustomModel(modelId, updates)
    this.configPresenter.updateCustomModel(providerId, modelId, updates)
    return res
  }

  async getCustomModels(providerId: string): Promise<MODEL_META[]> {
    const provider = this.getProviderInstance(providerId)
    return provider.getCustomModels()
  }

  async summaryTitles(
    messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
    providerId: string,
    modelId: string
  ): Promise<string> {
    const provider = this.getProviderInstance(providerId)
    return provider.summaryTitles(messages, modelId)
  }

  // 获取 OllamaProvider 实例
  getOllamaProviderInstance(): OllamaProvider | null {
    // 从所有 provider 中找到已经启用的 ollama provider
    for (const provider of this.providers.values()) {
      if (provider.id === 'ollama' && provider.enable) {
        const providerInstance = this.providerInstances.get(provider.id)
        if (providerInstance instanceof OllamaProvider) {
          return providerInstance
        }
      }
    }
    return null
  }
  // ollama api
  listOllamaModels(): Promise<OllamaModel[]> {
    const provider = this.getOllamaProviderInstance()
    if (!provider) {
      // console.error('Ollama provider not found')
      return Promise.resolve([])
    }
    return provider.listModels()
  }
  showOllamaModelInfo(modelName: string): Promise<ShowResponse> {
    const provider = this.getOllamaProviderInstance()
    if (!provider) {
      throw new Error('Ollama provider not found')
    }
    return provider.showModelInfo(modelName)
  }
  listOllamaRunningModels(): Promise<OllamaModel[]> {
    const provider = this.getOllamaProviderInstance()
    if (!provider) {
      // console.error('Ollama provider not found')
      return Promise.resolve([])
    }
    return provider.listRunningModels()
  }
  pullOllamaModels(modelName: string): Promise<boolean> {
    const provider = this.getOllamaProviderInstance()
    if (!provider) {
      throw new Error('Ollama provider not found')
    }
    return provider.pullModel(modelName, (progress) => {
      console.log('pullOllamaModels', {
        eventId: 'pullOllamaModels',
        modelName: modelName,
        ...progress
      })
      eventBus.emit(OLLAMA_EVENTS.PULL_MODEL_PROGRESS, {
        eventId: 'pullOllamaModels',
        modelName: modelName,
        ...progress
      })
    })
  }
  deleteOllamaModel(modelName: string): Promise<boolean> {
    const provider = this.getOllamaProviderInstance()
    if (!provider) {
      throw new Error('Ollama provider not found')
    }
    return provider.deleteModel(modelName)
  }
}

import {
  LLM_PROVIDER,
  LLMResponse,
  MODEL_META,
  LLMCoreStreamEvent,
  ModelConfig,
  MCPToolDefinition
} from '@shared/presenter'
import { BaseLLMProvider } from '../baseProvider'
import { ConfigPresenter } from '../../configPresenter'
import Anthropic from '@anthropic-ai/sdk'
import { ChatMessage } from '../baseProvider'
import { presenter } from '@/presenter'
import { HttpsProxyAgent } from 'https-proxy-agent'
import { proxyConfig } from '../../proxyConfig'
import { getModelConfig } from '../modelConfigs'

export class AnthropicProvider extends BaseLLMProvider {
  private anthropic!: Anthropic
  private defaultModel = 'claude-3-7-sonnet-20250219'

  constructor(provider: LLM_PROVIDER, configPresenter: ConfigPresenter) {
    super(provider, configPresenter)
    this.init()
  }

  public onProxyResolved(): void {
    this.init()
  }

  protected async init() {
    if (this.provider.enable) {
      try {
        const apiKey = this.provider.apiKey || process.env.ANTHROPIC_API_KEY
        const proxyUrl = proxyConfig.getProxyUrl()
        this.anthropic = new Anthropic({
          apiKey: apiKey,
          baseURL: this.provider.baseUrl || 'https://api.anthropic.com',
          httpAgent: proxyUrl ? new HttpsProxyAgent(proxyUrl) : undefined,
          defaultHeaders: {
            ...this.defaultHeaders
          }
        })
        await super.init()
      } catch (error) {
        console.error('Failed to initialize Anthropic provider:', error)
      }
    }
  }

  protected async fetchProviderModels(): Promise<MODEL_META[]> {
    try {
      const models = await this.anthropic.models.list({
        headers: {
          'anthropic-version': '2023-06-01'
        }
      })
      // 引入getModelConfig函数
      if (models && models.data && Array.isArray(models.data)) {
        const processedModels: MODEL_META[] = []

        for (const model of models.data) {
          // 确保模型有必要的属性
          if (model.id) {
            // 从modelConfigs获取额外的配置信息
            const modelConfig = getModelConfig(model.id)

            // 提取模型组名称，通常是Claude后面的版本号

            processedModels.push({
              id: model.id,
              name: model.display_name || model.id,
              providerId: this.provider.id,
              maxTokens: modelConfig?.maxTokens || 200000,
              group: 'Claude',
              isCustom: false,
              contextLength: modelConfig?.contextLength || 200000,
              vision: modelConfig?.vision || false,
              functionCall: modelConfig?.functionCall || false,
              reasoning: modelConfig?.reasoning || false
            })
          }
        }

        // 如果成功解析出模型，则返回
        if (processedModels.length > 0) {
          return processedModels
        }
      }

      // 如果API请求失败或返回数据解析失败，返回默认模型列表
      console.log('从API获取模型列表失败，使用默认模型配置')
    } catch (error) {
      console.error('获取Anthropic模型列表出错:', error)
    }

    // 默认的模型列表（如API调用失败或数据格式不正确）
    return [
      {
        id: 'claude-3-7-sonnet-20250219',
        name: 'Claude 3.7 Sonnet',
        providerId: this.provider.id,
        maxTokens: 200000,
        group: 'Claude 3.7',
        isCustom: false,
        contextLength: 200000,
        vision: true,
        functionCall: true,
        reasoning: true
      },
      {
        id: 'claude-3-5-sonnet-20241022',
        name: 'Claude 3.5 Sonnet',
        providerId: this.provider.id,
        maxTokens: 200000,
        group: 'Claude 3.5',
        isCustom: false,
        contextLength: 200000,
        vision: true,
        functionCall: true,
        reasoning: false
      },
      {
        id: 'claude-3-5-haiku-20241022',
        name: 'Claude 3.5 Haiku',
        providerId: this.provider.id,
        maxTokens: 200000,
        group: 'Claude 3.5',
        isCustom: false,
        contextLength: 200000,
        vision: true,
        functionCall: true,
        reasoning: false
      },
      {
        id: 'claude-3-5-sonnet-20240620',
        name: 'Claude 3.5 Sonnet (Legacy)',
        providerId: this.provider.id,
        maxTokens: 200000,
        group: 'Claude 3.5',
        isCustom: false,
        contextLength: 200000,
        vision: true,
        functionCall: true,
        reasoning: false
      },
      {
        id: 'claude-3-opus-20240229',
        name: 'Claude 3 Opus',
        providerId: this.provider.id,
        maxTokens: 200000,
        group: 'Claude 3',
        isCustom: false,
        contextLength: 200000,
        vision: true,
        functionCall: true,
        reasoning: false
      },
      {
        id: 'claude-3-haiku-20240307',
        name: 'Claude 3 Haiku',
        providerId: this.provider.id,
        maxTokens: 200000,
        group: 'Claude 3',
        isCustom: false,
        contextLength: 200000,
        vision: true,
        functionCall: true,
        reasoning: false
      }
    ]
  }

  public async check(): Promise<{ isOk: boolean; errorMsg: string | null }> {
    try {
      if (!this.anthropic) {
        return { isOk: false, errorMsg: '未初始化 Anthropic SDK' }
      }

      // 发送一个简单请求来检查 API 连接状态
      await this.anthropic.messages.create({
        model: this.defaultModel,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Hello' }]
      })

      return { isOk: true, errorMsg: null }
    } catch (error: unknown) {
      console.error('Anthropic API check failed:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { isOk: false, errorMsg: `API 检查失败: ${errorMessage}` }
    }
  }

  private formatMessages(messages: ChatMessage[]): {
    system?: string
    messages: Anthropic.MessageParam[]
  } {
    const formattedMessages: Anthropic.MessageParam[] = []
    let systemContent = ''

    // 收集所有系统消息
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i]

      // 处理系统消息
      if (msg.role === 'system') {
        systemContent +=
          (typeof msg.content === 'string'
            ? msg.content
            : msg.content && Array.isArray(msg.content)
              ? msg.content
                  .filter((c) => c.type === 'text')
                  .map((c) => c.text || '')
                  .join('\n')
              : '') + '\n'
        continue
      }

      // 处理assistant消息中的tool_calls (原生函数调用)
      if (msg.role === 'assistant' && 'tool_calls' in msg && Array.isArray(msg.tool_calls)) {
        // 先添加正常的assistant消息内容（如果有）
        if (msg.content) {
          const assistantContent: Anthropic.ContentBlockParam[] =
            typeof msg.content === 'string'
              ? [{ type: 'text', text: msg.content }]
              : msg.content.map((c) =>
                  c.type === 'text'
                    ? { type: 'text', text: c.text || '' }
                    : { type: 'text', text: '' }
                ) // 简化处理，只处理文本

          if (assistantContent.length > 0) {
            formattedMessages.push({
              role: 'assistant',
              content: assistantContent
            })
          }
        }

        // 为每个tool_call添加一个tool_use消息
        for (const toolCall of msg.tool_calls) {
          try {
            // @ts-ignore - 转换为Anthropic格式
            formattedMessages.push({
              role: 'assistant',
              content: [
                {
                  type: 'tool_use',
                  id: toolCall.id,
                  name: toolCall.function.name,
                  input: JSON.parse(toolCall.function.arguments || '{}')
                }
              ]
            })

            // 查找对应的tool响应消息
            const nextMsg = i + 1 < messages.length ? messages[i + 1] : null
            if (
              nextMsg &&
              nextMsg.role === 'tool' &&
              'tool_call_id' in nextMsg &&
              nextMsg.tool_call_id === toolCall.id
            ) {
              // 添加工具响应
              formattedMessages.push({
                role: 'user',
                content: [
                  {
                    type: 'tool_result',
                    tool_use_id: toolCall.id,
                    content:
                      typeof nextMsg.content === 'string'
                        ? nextMsg.content
                        : JSON.stringify(nextMsg.content)
                  }
                ]
              })

              // 跳过下一条消息，因为已经处理过了
              i++
            }
          } catch (e) {
            console.error('Error processing tool_call:', e)
          }
        }

        continue
      }

      // 处理tool角色消息（工具响应）
      if (msg.role === 'tool') {
        // 获取tool_call_id
        // @ts-ignore - tool_call_id属性可能不在类型定义中
        const toolCallId = msg.tool_call_id || `tool_${Date.now()}`

        // 格式化响应内容
        const responseContent =
          typeof msg.content === 'string'
            ? msg.content
            : Array.isArray(msg.content)
              ? JSON.stringify(msg.content)
              : ''

        // 添加工具响应消息
        formattedMessages.push({
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: toolCallId,
              content: responseContent
            }
          ]
        })

        continue
      }

      // 处理常规用户和助手消息
      let formattedContent: Anthropic.ContentBlockParam[] = []

      if (typeof msg.content === 'string') {
        // 处理字符串内容
        formattedContent = [{ type: 'text', text: msg.content }]
      } else if (msg.content && Array.isArray(msg.content)) {
        // 处理数组内容（可能包含文本和图像）
        formattedContent = msg.content.map((content) => {
          if (content.type === 'image_url' && content.image_url) {
            // 处理图像
            return {
              type: 'image',
              source: content.image_url.url.startsWith('data:image')
                ? {
                    type: 'base64',
                    data: content.image_url.url.split(',')[1],
                    media_type: content.image_url.url.split(';')[0].split(':')[1] as
                      | 'image/jpeg'
                      | 'image/png'
                      | 'image/gif'
                      | 'image/webp'
                  }
                : { type: 'url', url: content.image_url.url }
            }
          } else {
            // 处理文本
            return { type: 'text', text: content.text || '' }
          }
        })

        // 检查内容数组中是否有特殊的工具使用块
        const toolUseContent = msg.content.find(
          (c) =>
            // @ts-ignore - 可能包含不在类型定义中的属性
            c.type === 'tool_use' && c.name && (c.input || c.id)
        )

        if (toolUseContent) {
          // @ts-ignore - 处理工具使用
          const toolId = toolUseContent.id || `tool_${Date.now()}`
          // @ts-ignore - 处理工具使用
          const toolName = toolUseContent.name
          // @ts-ignore - 处理工具使用
          const toolInput = toolUseContent.input || {}

          // 先添加常规内容
          const textContent: Anthropic.TextBlockParam[] =
            msg.content
              ?.filter((c) => c.type === 'text')
              .map((c) => ({ type: 'text', text: c.text || '' })) || []

          if (textContent.length > 0) {
            formattedMessages.push({
              role: msg.role as 'user' | 'assistant',
              content: textContent
            })
          }

          // 再添加工具使用
          if (msg.role === 'assistant') {
            // @ts-ignore - 转换为Anthropic格式
            formattedMessages.push({
              role: 'assistant',
              content: [
                {
                  type: 'tool_use',
                  id: toolId,
                  name: toolName,
                  input: toolInput
                }
              ]
            })
          }

          continue
        }
      }

      // 添加常规消息
      if (formattedContent.length > 0) {
        formattedMessages.push({
          role: msg.role as 'user' | 'assistant',
          content: formattedContent
        })
      }
    }

    return {
      system: systemContent || undefined,
      messages: formattedMessages
    }
  }

  public async summaryTitles(messages: ChatMessage[], modelId: string): Promise<string> {
    const prompt = `
请为以下对话生成一个简短的标题，不超过6个字：

${messages.map((m) => `${m.role}: ${m.content}`).join('\n')}

只输出标题，不要有任何额外文字。
`
    const response = await this.generateText(prompt, modelId, 0.3, 50)

    return response.content.trim()
  }

  async completions(
    messages: ChatMessage[],
    modelId: string,
    temperature?: number,
    maxTokens?: number
  ): Promise<LLMResponse> {
    try {
      if (!this.anthropic) {
        throw new Error('Anthropic client is not initialized')
      }

      const formattedMessages = this.formatMessages(messages)

      // 创建基本请求参数
      const requestParams: Anthropic.Messages.MessageCreateParams = {
        model: modelId,
        max_tokens: maxTokens || 1024,
        temperature: temperature || 0.7,
        messages: formattedMessages.messages
      }

      // 如果有系统消息，添加到请求参数中
      if (formattedMessages.system) {
        // @ts-ignore - system 属性在类型定义中可能不存在，但API已支持
        requestParams.system = formattedMessages.system
      }

      // 执行请求
      const response = await this.anthropic.messages.create(requestParams)

      const resultResp: LLMResponse = {
        content: ''
      }

      // 添加usage信息
      if (response.usage) {
        resultResp.totalUsage = {
          prompt_tokens: response.usage.input_tokens,
          completion_tokens: response.usage.output_tokens,
          total_tokens: response.usage.input_tokens + response.usage.output_tokens
        }
      }

      // 获取文本内容
      const content = response.content
        .filter((block) => block.type === 'text')
        .map((block) => (block.type === 'text' ? block.text : ''))
        .join('')

      // 处理<think>标签
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
      console.error('Anthropic completions error:', error)
      throw error
    }
  }

  async summaries(
    text: string,
    modelId: string,
    temperature?: number,
    maxTokens?: number,
    systemPrompt?: string
  ): Promise<LLMResponse> {
    const prompt = `请对以下内容进行摘要:

${text}

请提供一个简洁明了的摘要。`

    return this.generateText(prompt, modelId, temperature, maxTokens, systemPrompt)
  }

  async generateText(
    prompt: string,
    modelId: string,
    temperature?: number,
    maxTokens?: number,
    systemPrompt?: string
  ): Promise<LLMResponse> {
    try {
      const requestParams: Anthropic.Messages.MessageCreateParams = {
        model: modelId,
        max_tokens: maxTokens || 1024,
        temperature: temperature || 0.7,
        messages: [{ role: 'user' as const, content: [{ type: 'text' as const, text: prompt }] }]
      }

      // 如果提供了系统提示，添加到请求中
      if (systemPrompt) {
        // @ts-ignore - system 属性在类型定义中可能不存在，但API已支持
        requestParams.system = systemPrompt
      }

      const response = await this.anthropic.messages.create(requestParams)

      return {
        content: response.content
          .filter((block) => block.type === 'text')
          .map((block) => (block.type === 'text' ? block.text : ''))
          .join(''),
        reasoning_content: undefined
      }
    } catch (error) {
      console.error('Anthropic generate text error:', error)
      throw error
    }
  }

  async suggestions(
    context: string,
    modelId: string,
    temperature?: number,
    maxTokens?: number,
    systemPrompt?: string
  ): Promise<string[]> {
    const prompt = `
根据下面的上下文，给出3个可能的回复建议，每个建议一行，不要有编号或者额外的解释：

${context}
`
    try {
      const requestParams: Anthropic.Messages.MessageCreateParams = {
        model: modelId,
        max_tokens: maxTokens || 1024,
        temperature: temperature || 0.7,
        messages: [{ role: 'user' as const, content: [{ type: 'text' as const, text: prompt }] }]
      }

      // 如果提供了系统提示，添加到请求中
      if (systemPrompt) {
        // @ts-ignore - system 属性在类型定义中可能不存在，但API已支持
        requestParams.system = systemPrompt
      }

      const response = await this.anthropic.messages.create(requestParams)

      const suggestions = response.content
        .filter((block) => block.type === 'text')
        .map((block) => (block.type === 'text' ? block.text : ''))
        .join('')
        .split('\n')
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
        .slice(0, 3)

      return suggestions
    } catch (error) {
      console.error('Anthropic suggestions error:', error)
      return ['建议生成失败']
    }
  }

  // 添加coreStream方法
  async *coreStream(
    messages: ChatMessage[],
    modelId: string,
    modelConfig: ModelConfig,
    temperature: number,
    maxTokens: number,
    mcpTools: MCPToolDefinition[]
  ): AsyncGenerator<LLMCoreStreamEvent> {
    if (!this.anthropic) throw new Error('Anthropic client is not initialized')
    if (!modelId) throw new Error('Model ID is required')
    console.log('modelConfig', modelConfig, modelId)
    try {
      // 格式化消息
      const formattedMessagesObject = this.formatMessages(messages)

      // 将MCP工具转换为Anthropic工具格式
      const anthropicTools =
        mcpTools.length > 0
          ? await presenter.mcpPresenter.mcpToolsToAnthropicTools(mcpTools, this.provider.id)
          : undefined

      // 创建基本请求参数
      const streamParams = {
        model: modelId,
        max_tokens: maxTokens || 1024,
        temperature: temperature || 0.7,
        messages: formattedMessagesObject.messages,
        stream: true
      } as Anthropic.Messages.MessageCreateParamsStreaming

      // 启用Claude 3.7模型的思考功能
      if (modelId.includes('claude-3-7')) {
        streamParams.thinking = { budget_tokens: 1024, type: 'enabled' }
      }

      // 如果有系统消息，添加到请求参数中
      if (formattedMessagesObject.system) {
        // @ts-ignore - system属性在类型定义中可能不存在，但API已支持
        streamParams.system = formattedMessagesObject.system
      }

      // 添加工具参数
      if (anthropicTools && anthropicTools.length > 0) {
        // @ts-ignore - 类型不匹配，但格式是正确的
        streamParams.tools = anthropicTools
      }
      console.log('streamParams', JSON.stringify(streamParams.messages))
      // 创建Anthropic流
      const stream = await this.anthropic.messages.create(streamParams)

      // 状态变量
      let accumulatedJson = ''
      let toolUseDetected = false
      let currentToolId = ''
      let currentToolName = ''
      let currentToolInputs: Record<string, unknown> = {}

      // 处理流中的各种事件
      for await (const chunk of stream) {
        // 处理使用统计
        if (chunk.type === 'message_start' && chunk.message.usage) {
          yield {
            type: 'usage',
            usage: {
              prompt_tokens: chunk.message.usage.input_tokens,
              completion_tokens: chunk.message.usage.output_tokens,
              total_tokens: chunk.message.usage.input_tokens + chunk.message.usage.output_tokens
            }
          }
        }

        // 处理工具调用开始
        // @ts-ignore - Anthropic SDK类型定义不完整
        if (chunk.type === 'content_block_start' && chunk.content_block?.type === 'tool_use') {
          toolUseDetected = true
          // @ts-ignore - content_block不在类型定义中
          currentToolId = chunk.content_block.id || `anthropic-tool-${Date.now()}`
          // @ts-ignore - content_block不在类型定义中
          currentToolName = chunk.content_block.name || ''
          currentToolInputs = {}
          accumulatedJson = ''

          // 发送工具调用开始事件
          if (currentToolName) {
            yield {
              type: 'tool_call_start',
              tool_call_id: currentToolId,
              tool_call_name: currentToolName
            }
          }
          continue
        }

        // 处理工具调用参数更新 - input_json_delta
        // @ts-ignore - 类型定义中没有工具相关字段
        if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'input_json_delta') {
          // @ts-ignore - partial_json不在类型定义中
          const partialJson = chunk.delta.partial_json
          if (partialJson) {
            accumulatedJson += partialJson

            // 发送工具调用参数块事件
            yield {
              type: 'tool_call_chunk',
              tool_call_id: currentToolId,
              tool_call_arguments_chunk: partialJson
            }
          }
          continue
        }

        // 处理工具使用更新 - tool_use_delta
        // @ts-ignore - 类型定义中没有工具相关字段
        if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'tool_use_delta') {
          // @ts-ignore - delta.name不在类型定义中
          if (chunk.delta.name && !currentToolName) {
            // @ts-ignore - 访问delta.name
            currentToolName = chunk.delta.name
            yield {
              type: 'tool_call_start',
              tool_call_id: currentToolId,
              tool_call_name: currentToolName
            }
          }

          // @ts-ignore - delta.input不在类型定义中
          if (chunk.delta.input) {
            currentToolInputs = {
              ...currentToolInputs,
              // @ts-ignore - 访问delta.input
              ...chunk.delta.input
            }
          }
          continue
        }

        // 处理内容块结束
        if (chunk.type === 'content_block_stop') {
          // 处理工具调用完成
          if (toolUseDetected && currentToolName && accumulatedJson) {
            try {
              // 尝试解析完整的JSON
              const jsonStr = accumulatedJson.trim()
              if (jsonStr && (jsonStr.startsWith('{') || jsonStr.startsWith('['))) {
                try {
                  const jsonObject = JSON.parse(jsonStr)
                  if (jsonObject && typeof jsonObject === 'object') {
                    currentToolInputs = { ...currentToolInputs, ...jsonObject }
                  }
                } catch (e) {
                  console.error('解析完整JSON失败:', e)
                }
              }
            } catch (e) {
              console.error('处理累积JSON失败:', e)
            }

            // 发送工具调用结束事件
            const argsString = JSON.stringify(currentToolInputs)
            yield {
              type: 'tool_call_end',
              tool_call_id: currentToolId,
              tool_call_arguments_complete: argsString
            }

            // 重置工具调用状态
            accumulatedJson = ''
          }
          continue
        }

        // 检查消息是否因为工具调用而停止
        if (chunk.type === 'message_delta' && chunk.delta?.stop_reason === 'tool_use') {
          // 设置为工具使用停止，主循环会处理工具调用
          continue
        }

        // 处理思考内容（如果有）
        // @ts-ignore - 类型定义中没有thinking相关字段
        if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'thinking_delta') {
          // @ts-ignore - delta.thinking不在类型定义中
          const thinkingText = chunk.delta.thinking
          if (thinkingText) {
            yield {
              type: 'reasoning',
              reasoning_content: thinkingText
            }
          }
          continue
        }

        // 处理常规文本内容
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          const text = chunk.delta.text
          if (text) {
            // 处理<think>标签
            if (text.includes('<think>')) {
              const parts = text.split('<think>')
              if (parts[0]) {
                yield {
                  type: 'text',
                  content: parts[0]
                }
              }

              if (parts[1]) {
                // 检查是否包含</think>
                const thinkParts = parts[1].split('</think>')
                if (thinkParts.length > 1) {
                  yield {
                    type: 'reasoning',
                    reasoning_content: thinkParts[0]
                  }

                  if (thinkParts[1]) {
                    yield {
                      type: 'text',
                      content: thinkParts[1]
                    }
                  }
                } else {
                  yield {
                    type: 'reasoning',
                    reasoning_content: parts[1]
                  }
                }
              }
            } else if (text.includes('</think>')) {
              const parts = text.split('</think>')
              yield {
                type: 'reasoning',
                reasoning_content: parts[0]
              }

              if (parts[1]) {
                yield {
                  type: 'text',
                  content: parts[1]
                }
              }
            } else {
              yield {
                type: 'text',
                content: text
              }
            }
          }
          continue
        }
      }

      // 发送停止事件
      yield {
        type: 'stop',
        stop_reason: toolUseDetected ? 'tool_use' : 'complete'
      }
    } catch (error) {
      console.error('Anthropic coreStream error:', error)
      yield {
        type: 'error',
        error_message: error instanceof Error ? error.message : '未知错误'
      }
      yield { type: 'stop', stop_reason: 'error' }
    }
  }
}

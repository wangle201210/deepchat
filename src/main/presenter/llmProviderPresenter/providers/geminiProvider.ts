import { LLM_PROVIDER, MODEL_META, LLMResponse, LLMResponseStream } from '@shared/presenter'
import { BaseLLMProvider, ChatMessage, ChatMessageContent } from '../baseProvider'
import {
  GoogleGenerativeAI,
  GenerativeModel,
  Part,
  Content,
  GenerationConfig
} from '@google/generative-ai'
import { ConfigPresenter } from '../../configPresenter'
import { presenter } from '@/presenter'

export class GeminiProvider extends BaseLLMProvider {
  private genAI: GoogleGenerativeAI

  constructor(provider: LLM_PROVIDER, configPresenter: ConfigPresenter) {
    super(provider, configPresenter)
    this.genAI = new GoogleGenerativeAI(this.provider.apiKey)
    this.init()
  }

  public onProxyResolved(): void {
    this.init()
  }

  // 实现BaseLLMProvider中的抽象方法fetchProviderModels
  protected async fetchProviderModels(): Promise<MODEL_META[]> {
    // Gemini没有获取模型的API，返回硬编码的模型列表
    return [
      {
        id: 'models/gemini-2.5-flash-preview-04-17',
        name: 'Gemini 2.5 Flash Preview',
        group: 'default',
        providerId: this.provider.id,
        isCustom: false,
        contextLength: 1048576,
        maxTokens: 65536,
        vision: true,
        functionCall: true,
        reasoning: true,
        description:
          'Gemini 2.5 Flash Preview 模型（支持文本、图片、视频、音频输入，预览版本 04-17）'
      },
      {
        id: 'gemini-2.5-pro-preview-03-25',
        name: 'Gemini 2.5 Pro Preview 03-25',
        group: 'default',
        providerId: this.provider.id,
        isCustom: false,
        contextLength: 2048576,
        maxTokens: 8192,
        vision: true,
        functionCall: true,
        reasoning: false,
        description: 'Gemini 2.5 Pro Preview 03-25 模型（付费）'
      },
      {
        id: 'gemini-2.5-pro-exp-03-25',
        name: 'Gemini 2.5 Pro Exp 03-25',
        group: 'default',
        providerId: this.provider.id,
        isCustom: false,
        contextLength: 2048576,
        maxTokens: 8192,
        vision: true,
        functionCall: true,
        reasoning: false,
        description: 'Gemini 2.5 Pro Exp 03-25 模型'
      },
      {
        id: 'models/gemini-2.0-flash',
        name: 'Gemini 2.0 Flash',
        group: 'default',
        providerId: this.provider.id,
        isCustom: false,
        contextLength: 1048576,
        maxTokens: 8192,
        vision: true,
        functionCall: true,
        reasoning: false,
        description: 'Gemini 2.0 Flash 模型'
      },
      {
        id: 'models/gemini-2.0-flash-lite',
        name: 'Gemini 2.0 Flash-Lite',
        group: 'default',
        providerId: this.provider.id,
        isCustom: false,
        contextLength: 1048576,
        maxTokens: 8192,
        vision: true,
        functionCall: true,
        reasoning: false,
        description: 'Gemini 2.0 Flash-Lite 模型（更轻量级）'
      },
      {
        id: 'models/gemini-1.5-flash',
        name: 'Gemini 1.5 Flash',
        group: 'default',
        providerId: this.provider.id,
        isCustom: false,
        contextLength: 1048576,
        maxTokens: 8192,
        vision: true,
        functionCall: true,
        reasoning: false,
        description: 'Gemini 1.5 Flash 模型（更快速、性价比更高）'
      },
      {
        id: 'models/gemini-1.5-flash-8b',
        name: 'Gemini 1.5 Flash-8B',
        group: 'default',
        providerId: this.provider.id,
        isCustom: false,
        contextLength: 1048576,
        maxTokens: 8192,
        vision: true,
        functionCall: true,
        reasoning: false,
        description: 'Gemini 1.5 Flash-8B 模型（8B 参数版本）'
      },
      {
        id: 'models/gemini-1.5-pro',
        name: 'Gemini 1.5 Pro',
        group: 'default',
        providerId: this.provider.id,
        isCustom: false,
        contextLength: 2097152,
        maxTokens: 8192,
        vision: true,
        functionCall: true,
        reasoning: false,
        description: 'Gemini 1.5 Pro 模型（更强大、支持多模态）'
      },
      {
        id: 'gemini-2.0-flash-exp-image-generation',
        name: 'Gemini 2.0 Flash Exp Image Generation',
        group: 'default',
        providerId: this.provider.id,
        isCustom: false,
        contextLength: 1048576,
        maxTokens: 8192,
        vision: true,
        functionCall: true,
        reasoning: false
      }
    ]
  }

  // 实现BaseLLMProvider中的summaryTitles抽象方法
  public async summaryTitles(
    messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
    modelId: string
  ): Promise<string> {
    console.log('gemini ignore modelId', modelId)
    // 使用Gemini API生成对话标题
    try {
      const model = this.getModel('models/gemini-1.5-flash-8b', 0.4)
      const conversationText = messages.map((m) => `${m.role}: ${m.content}`).join('\n')
      const prompt = `请为以下对话生成一个简洁的标题，不超过10个字，不使用标点符号或其他特殊符号，语言应该匹配用户的主要语言：\n\n${conversationText}`

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
      })

      return result.response.text().trim()
    } catch (error) {
      console.error('生成对话标题失败:', error)
      return '新对话'
    }
  }

  // 重载fetchModels方法，因为Gemini没有获取模型的API
  async fetchModels(): Promise<MODEL_META[]> {
    // Gemini没有获取模型的API，直接使用init方法中的硬编码模型列表
    return this.models
  }

  // 重载check方法，使用第一个默认模型进行测试
  async check(): Promise<{ isOk: boolean; errorMsg: string | null }> {
    try {
      if (!this.provider.apiKey) {
        return { isOk: false, errorMsg: '缺少API密钥' }
      }

      // 使用第一个模型进行简单测试
      const testModel = this.getModel('models/gemini-1.5-flash-8b')
      const result = await testModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: 'Hello' }] }]
      })
      return { isOk: result && result.response ? true : false, errorMsg: null }
    } catch (error) {
      console.error('Provider check failed:', this.provider.name, error)
      return { isOk: false, errorMsg: error instanceof Error ? error.message : String(error) }
    }
  }

  protected async init() {
    if (this.provider.enable) {
      try {
        // 更新 Gemini 模型列表为最新版本
        this.models = [
          {
            id: 'models/gemini-2.5-flash-preview-04-17',
            name: 'Gemini 2.5 Flash Preview 0417',
            group: 'default',
            providerId: this.provider.id,
            isCustom: false,
            contextLength: 1048576,
            maxTokens: 65536,
            vision: true,
            functionCall: true,
            reasoning: true,
            description:
              'Gemini 2.5 Flash Preview 模型（支持文本、图片、视频、音频输入，预览版本 04-17）'
          },
          {
            id: 'gemini-2.5-pro-preview-03-25',
            name: 'Gemini 2.5 Pro Preview 03-25',
            group: 'default',
            providerId: this.provider.id,
            isCustom: false,
            contextLength: 2048576,
            maxTokens: 8192,
            vision: true,
            functionCall: true,
            reasoning: false,
            description: 'Gemini 2.5 Pro Preview 03-25 模型（付费)'
          },
          {
            id: 'gemini-2.5-pro-exp-03-25',
            name: 'Gemini 2.5 Pro Exp 03-25',
            group: 'default',
            providerId: this.provider.id,
            isCustom: false,
            contextLength: 2048576,
            maxTokens: 8192,
            vision: true,
            functionCall: true,
            reasoning: false,
            description: 'Gemini 2.5 Pro Exp 03-25 模型'
          },
          {
            id: 'models/gemini-2.0-flash',
            name: 'Gemini 2.0 Flash',
            group: 'default',
            providerId: this.provider.id,
            isCustom: false,
            contextLength: 1048576,
            maxTokens: 8192,
            vision: true,
            functionCall: true,
            reasoning: false,
            description: 'Gemini 2.0 Flash 模型'
          },
          {
            id: 'models/gemini-2.0-flash-lite',
            name: 'Gemini 2.0 Flash-Lite',
            group: 'default',
            providerId: this.provider.id,
            isCustom: false,
            contextLength: 1048576,
            maxTokens: 8192,
            vision: true,
            functionCall: true,
            reasoning: false,
            description: 'Gemini 2.0 Flash-Lite 模型（更轻量级）'
          },
          {
            id: 'models/gemini-1.5-flash',
            name: 'Gemini 1.5 Flash',
            group: 'default',
            providerId: this.provider.id,
            isCustom: false,
            contextLength: 1048576,
            maxTokens: 8192,
            vision: true,
            functionCall: true,
            reasoning: false,
            description: 'Gemini 1.5 Flash 模型（更快速、性价比更高）'
          },
          {
            id: 'models/gemini-1.5-flash-8b',
            name: 'Gemini 1.5 Flash-8B',
            group: 'default',
            providerId: this.provider.id,
            isCustom: false,
            contextLength: 1048576,
            maxTokens: 8192,
            vision: true,
            functionCall: true,
            reasoning: false,
            description: 'Gemini 1.5 Flash-8B 模型（8B 参数版本）'
          },
          {
            id: 'models/gemini-1.5-pro',
            name: 'Gemini 1.5 Pro',
            group: 'default',
            providerId: this.provider.id,
            isCustom: false,
            contextLength: 2097152,
            maxTokens: 8192,
            vision: true,
            functionCall: true,
            reasoning: false,
            description: 'Gemini 1.5 Pro 模型（更强大、支持多模态）'
          },
          {
            id: 'gemini-2.0-flash-exp-image-generation',
            name: 'Gemini 2.0 Flash Exp Image Generation',
            group: 'default',
            providerId: this.provider.id,
            isCustom: false,
            contextLength: 1048576,
            maxTokens: 8192,
            vision: true,
            functionCall: true,
            reasoning: false
          }
        ]
        await this.autoEnableModelsIfNeeded()
        this.isInitialized = true
        console.info('Provider initialized successfully:', this.provider.name)
      } catch (error) {
        console.warn('Provider initialization failed:', this.provider.name, error)
      }
    }
  }

  // 创建模型实例，每次都创建新的实例，不再缓存
  private getModel(modelId: string, temperature?: number, maxTokens?: number): GenerativeModel {
    const generationConfig = {
      temperature,
      maxOutputTokens: maxTokens
    } as GenerationConfig & { responseModalities?: string[] }
    if (modelId == 'gemini-2.0-flash-exp-image-generation') {
      generationConfig.responseModalities = ['Text', 'Image']
    }
    return this.genAI.getGenerativeModel(
      {
        model: modelId,
        generationConfig
      },
      {
        baseUrl: this.provider.baseUrl
      }
    )
  }

  // 将 ChatMessage 转换为 Gemini 格式的消息
  private formatGeminiMessages(messages: ChatMessage[]): {
    systemInstruction: string
    contents: Content[]
  } {
    // 提取系统消息
    const systemMessages = messages.filter((msg) => msg.role === 'system')
    let systemContent = ''
    if (systemMessages.length > 0) {
      systemContent = systemMessages.map((msg) => msg.content).join('\n')
    }

    // 创建Gemini内容数组
    const formattedContents: Content[] = []

    // 处理非系统消息
    const nonSystemMessages = messages.filter((msg) => msg.role !== 'system')
    for (const message of nonSystemMessages) {
      // 为每条消息创建parts数组
      const parts: Part[] = []

      // 处理消息内容 - 可能是字符串或包含图片的数组
      if (typeof message.content === 'string') {
        // 处理纯文本消息
        parts.push({ text: message.content })
      } else if (Array.isArray(message.content)) {
        // 处理多模态消息（带图片等）
        for (const part of message.content) {
          if (part.type === 'text') {
            parts.push({ text: part.text || '' })
          } else if (part.type === 'image_url' && part.image_url) {
            // 处理图片（假设是 base64 格式）
            const matches = part.image_url.url.match(/^data:([^;]+);base64,(.+)$/)
            if (matches && matches.length === 3) {
              const mimeType = matches[1]
              const base64Data = matches[2]
              parts.push({
                inlineData: {
                  data: base64Data,
                  mimeType: mimeType
                }
              })
            }
          }
        }
      }

      // 只有当parts不为空时，才添加到formattedContents中
      if (parts.length > 0) {
        // 将消息角色转换为Gemini支持的角色
        let role: 'user' | 'model' = 'user'
        if (message.role === 'assistant') {
          role = 'model'
        }

        formattedContents.push({
          role: role,
          parts: parts
        })
      }
    }

    return { systemInstruction: systemContent, contents: formattedContents }
  }

  // 处理响应，提取思考内容
  private processResponse(text: string): LLMResponse {
    const resultResp: LLMResponse = {
      content: ''
    }

    // 处理 <think> 标签
    if (text) {
      const content = text.trimStart()
      if (content.includes('<think>')) {
        const thinkStart = content.indexOf('<think>')
        const thinkEnd = content.indexOf('</think>')

        if (thinkEnd > thinkStart) {
          // 提取 reasoning_content
          resultResp.reasoning_content = content.substring(thinkStart + 7, thinkEnd).trim()

          // 合并 <think> 前后的普通内容
          const beforeThink = content.substring(0, thinkStart).trim()
          const afterThink = content.substring(thinkEnd + 8).trim()
          resultResp.content = [beforeThink, afterThink].filter(Boolean).join('\n')
        } else {
          // 如果没有找到配对的结束标签，将所有内容作为普通内容
          resultResp.content = text
        }
      } else {
        // 没有 think 标签，所有内容作为普通内容
        resultResp.content = text
      }
    }

    return resultResp
  }

  // 实现抽象方法
  async completions(
    messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
    modelId: string,
    temperature?: number,
    maxTokens?: number
  ): Promise<LLMResponse> {
    try {
      if (!this.genAI) {
        throw new Error('Google Generative AI client is not initialized')
      }

      const model = this.getModel(modelId, temperature, maxTokens)
      const { systemInstruction, contents } = this.formatGeminiMessages(messages)

      // 创建基本请求参数
      const generationConfig: GenerationConfig = {
        temperature: temperature || 0.7,
        maxOutputTokens: maxTokens
      }

      // 执行请求
      const result = await model.generateContent({
        contents,
        generationConfig,
        systemInstruction
      })

      const response = result.response

      const resultResp: LLMResponse = {
        content: ''
      }

      // 尝试获取tokens信息 - Gemini API可能不提供标准的token计数
      // 我们使用一个估算方法
      try {
        // 估算token数量 - 简单方法，可以根据实际需要调整
        const promptText = messages.map((m) => m.content).join(' ')
        const responseText = response.text()

        // 简单估算: 英文约1个token/4个字符，中文约1个token/1.5个字符
        const estimateTokens = (text: string): number => {
          const chineseCharCount = (text.match(/[\u4e00-\u9fa5]/g) || []).length
          const otherCharCount = text.length - chineseCharCount
          return Math.ceil(chineseCharCount / 1.5 + otherCharCount / 4)
        }

        const promptTokens = estimateTokens(promptText)
        const completionTokens = estimateTokens(responseText)

        resultResp.totalUsage = {
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          total_tokens: promptTokens + completionTokens
        }
      } catch (e) {
        console.warn('Failed to estimate token count for Gemini response', e)
      }

      // 获取文本响应
      const text = response.text()

      // 处理<think>标签
      if (text.includes('<think>')) {
        const thinkStart = text.indexOf('<think>')
        const thinkEnd = text.indexOf('</think>')

        if (thinkEnd > thinkStart) {
          // 提取reasoning_content
          resultResp.reasoning_content = text.substring(thinkStart + 7, thinkEnd).trim()

          // 合并<think>前后的普通内容
          const beforeThink = text.substring(0, thinkStart).trim()
          const afterThink = text.substring(thinkEnd + 8).trim()
          resultResp.content = [beforeThink, afterThink].filter(Boolean).join('\n')
        } else {
          // 如果没有找到配对的结束标签，将所有内容作为普通内容
          resultResp.content = text
        }
      } else {
        // 没有think标签，所有内容作为普通内容
        resultResp.content = text
      }

      return resultResp
    } catch (error) {
      console.error('Gemini completions error:', error)
      throw error
    }
  }

  async summaries(
    text: string,
    modelId: string,
    temperature?: number,
    maxTokens?: number
  ): Promise<LLMResponse> {
    if (!this.isInitialized) {
      throw new Error('Provider not initialized')
    }

    if (!modelId) {
      throw new Error('Model ID is required')
    }

    try {
      // 每次创建新的模型实例，并传入生成配置
      const model = this.getModel(modelId, temperature, maxTokens)
      const prompt = `请为以下内容生成一个简洁的摘要：\n\n${text}`

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
      })

      const response = result.response.text()
      return this.processResponse(response)
    } catch (error) {
      console.error('Gemini summaries error:', error)
      throw error
    }
  }

  async generateText(
    prompt: string,
    modelId: string,
    temperature?: number,
    maxTokens?: number
  ): Promise<LLMResponse> {
    if (!this.isInitialized) {
      throw new Error('Provider not initialized')
    }

    if (!modelId) {
      throw new Error('Model ID is required')
    }

    try {
      // 每次创建新的模型实例，并传入生成配置
      const model = this.getModel(modelId, temperature, maxTokens)

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
      })

      const response = result.response.text()
      return this.processResponse(response)
    } catch (error) {
      console.error('Gemini generateText error:', error)
      throw error
    }
  }

  async suggestions(
    context: string,
    modelId: string,
    temperature?: number,
    maxTokens?: number
  ): Promise<string[]> {
    if (!this.isInitialized) {
      throw new Error('Provider not initialized')
    }

    if (!modelId) {
      throw new Error('Model ID is required')
    }

    try {
      // 每次创建新的模型实例，并传入生成配置
      const model = this.getModel(modelId, temperature, maxTokens)

      const prompt = `根据以下上下文，请提供最多5个合理的建议选项，每个选项不超过100个字符。请以JSON数组格式返回，不要有其他说明：\n\n${context}`

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
      })

      const responseText = result.response.text()

      // 尝试从响应中解析出JSON数组
      try {
        const cleanedText = responseText.replace(/```json|```/g, '').trim()
        const suggestions = JSON.parse(cleanedText)
        if (Array.isArray(suggestions)) {
          return suggestions.map((item) => item.toString())
        }
      } catch (parseError) {
        // 如果解析失败，尝试分行处理
        const lines = responseText
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line && !line.startsWith('```') && !line.includes(':'))
          .map((line) => line.replace(/^[0-9]+\.\s*/, '').replace(/^-\s*/, ''))

        if (lines.length > 0) {
          return lines.slice(0, 5)
        }
      }

      // 如果都失败了，返回一个默认提示
      return ['无法生成建议']
    } catch (error) {
      console.error('Gemini suggestions error:', error)
      return ['发生错误，无法获取建议']
    }
  }

  async *streamCompletions(
    messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
    modelId: string,
    temperature?: number,
    maxTokens?: number
  ): AsyncGenerator<LLMResponseStream> {
    if (!this.isInitialized) {
      throw new Error('Provider not initialized')
    }

    if (!modelId) {
      throw new Error('Model ID is required')
    }

    try {
      // 获取MCP工具定义
      const mcpTools = await presenter.mcpPresenter.getAllToolDefinitions()

      // 将MCP工具转换为Gemini格式的工具
      const geminiTools =
        mcpTools.length > 0
          ? await presenter.mcpPresenter.mcpToolsToGeminiTools(mcpTools, this.provider.id)
          : undefined

      // 添加工具调用计数
      let toolCallCount = 0
      const MAX_TOOL_CALLS = BaseLLMProvider.MAX_TOOL_CALLS // 最大工具调用次数限制

      // 维护消息上下文
      const conversationMessages: ChatMessage[] = [...messages]

      // 记录是否需要继续对话
      let needContinueConversation = false

      // 每次创建新的模型实例，并传入生成配置
      const model = this.getModel(modelId, temperature, maxTokens)
      const totalUsage: {
        prompt_tokens: number
        completion_tokens: number
        total_tokens: number
      } = {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0
      }
      // 主循环，支持多轮工具调用
      while (true) {
        const currentUsage = {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0
        }
        const formattedParts = this.formatGeminiMessages(conversationMessages)

        // 创建流式生成请求
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const requestParams: any = {
          contents: formattedParts.contents
        }
        if (formattedParts.systemInstruction) {
          requestParams.systemInstruction = formattedParts.systemInstruction
        }

        // 只有在有工具且工具列表不为空时才添加工具参数
        if (geminiTools && geminiTools.length > 0) {
          requestParams.tools = geminiTools
          requestParams.toolConfig = {
            functionCallingConfig: {
              mode: 'AUTO' // 允许模型自动决定是否调用工具
            }
          }
        }

        // @ts-ignore - Gemini SDK类型定义与实际API有差异
        const result = await model.generateContentStream(requestParams)

        // 处理流式响应
        let buffer = ''
        let isInThinkTag = false
        let thinkContent = ''
        let hasThinkTag = false
        // 用于存储函数调用信息
        let functionCallDetected = false
        let functionName = ''
        let functionArgs = {}
        let currentContent = ''

        // 重置继续对话标志
        needContinueConversation = false
        for await (const chunk of result.stream) {
          if (chunk.usageMetadata) {
            currentUsage.prompt_tokens = chunk.usageMetadata.promptTokenCount
            currentUsage.completion_tokens = chunk.usageMetadata.candidatesTokenCount
            currentUsage.total_tokens = chunk.usageMetadata.totalTokenCount
          }
          // console.log('gchunk', chunk)
          // 检查是否包含函数调用
          // @ts-ignore - SDK类型定义不完整
          if (chunk.candidates && chunk.candidates[0]?.content?.parts?.[0]?.functionCall) {
            // @ts-ignore - SDK类型定义不完整
            const functionCall = chunk.candidates[0].content.parts[0].functionCall
            functionCallDetected = true
            functionName = functionCall.name
            functionArgs = functionCall.args || {}

            // 停止继续处理流，转为处理工具调用
            break
          }

          // 使用官方文档解析方式解析chunk
          let content = ''
          if (chunk.candidates && chunk.candidates[0]?.content?.parts) {
            for (const part of chunk.candidates[0].content.parts) {
              if (part.text) {
                content += part.text
              } else if (part.inlineData) {
                // 如果有图像数据，转换为markdown图像格式
                const imageBase64 = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`
                const markdownImage = `\n![geminiPic](${imageBase64})\n`
                // 将markdown格式的图片添加到内容中
                content += markdownImage

                // 同时保留原始图像数据，以便渲染层可以使用
                yield {
                  content: '',
                  image_data: {
                    data: part.inlineData.data,
                    mimeType: part.inlineData.mimeType
                  }
                }
              }
            }
          } else {
            // 兼容处理，如果没有按预期结构，尝试使用text()方法
            content = chunk.text() || ''
          }

          if (!content) continue

          currentContent += content
          buffer += content

          // 检查是否包含 <think> 标签
          if (buffer.includes('<think>') && !hasThinkTag) {
            hasThinkTag = true
            const thinkStart = buffer.indexOf('<think>')

            // 发送 <think> 前的内容
            if (thinkStart > 0) {
              yield {
                content: buffer.substring(0, thinkStart)
              }
            }

            buffer = buffer.substring(thinkStart + 7)
            isInThinkTag = true
            continue
          }

          // 检查是否有结束标签 </think>
          if (isInThinkTag && buffer.includes('</think>')) {
            const thinkEnd = buffer.indexOf('</think>')
            thinkContent += buffer.substring(0, thinkEnd)

            // 发送推理内容
            yield {
              reasoning_content: thinkContent
            }

            // 重置并准备处理 </think> 后的内容
            buffer = buffer.substring(thinkEnd + 8)
            isInThinkTag = false
            continue
          }

          // 如果我们在 <think> 标签内，累积推理内容
          if (isInThinkTag) {
            thinkContent += content
            continue
          }
          // 否则，正常发送内容
          yield {
            content
          }
        }
        totalUsage.prompt_tokens += currentUsage.prompt_tokens
        totalUsage.completion_tokens += currentUsage.completion_tokens
        totalUsage.total_tokens += currentUsage.total_tokens

        // 处理函数调用
        if (functionCallDetected && functionName) {
          // 将Gemini函数调用转换为MCP工具调用
          const geminiFunctionCall = {
            name: functionName,
            args: functionArgs
          }

          const mcpToolCall = await presenter.mcpPresenter.geminiFunctionCallToMcpTool(
            geminiFunctionCall,
            this.provider.id
          )

          if (mcpToolCall) {
            // 增加工具调用计数
            toolCallCount++

            // 检查是否达到最大工具调用次数
            if (toolCallCount >= MAX_TOOL_CALLS) {
              // 这里要用mcptool 格式化后的字段，因为continue的时候模型可能会变，其他地方要方便调试要用native 的tool描述
              yield {
                maximum_tool_calls_reached: true,
                tool_call_id: mcpToolCall.id,
                tool_call_name: mcpToolCall.function.name,
                tool_call_params: mcpToolCall.function.arguments,
                tool_call_server_name: mcpToolCall.server.name,
                tool_call_server_icons: mcpToolCall.server.icons,
                tool_call_server_description: mcpToolCall.server.description
              }
              needContinueConversation = false
              break
            }
            try {
              // 通知正在调用工具
              const toolCallId = `gemini-${Date.now()}`
              yield {
                content: '',
                tool_call: 'start',
                tool_call_name: functionName,
                tool_call_params: JSON.stringify(functionArgs),
                tool_call_id: toolCallId,
                tool_call_server_name: mcpToolCall.server.name,
                tool_call_server_icons: mcpToolCall.server.icons,
                tool_call_server_description: mcpToolCall.server.description
              }

              // 调用工具并获取响应
              const toolResponse = await presenter.mcpPresenter.callTool(mcpToolCall)

              // 处理响应内容，为多模态内容做特殊处理
              let responseContent = ''
              const messageParts: ChatMessageContent[] = []

              // 根据内容类型进行不同处理
              if (typeof toolResponse.rawData.content === 'string') {
                // 字符串类型直接使用
                responseContent = toolResponse.rawData.content
                messageParts.push({ type: 'text', text: responseContent })
              } else if (Array.isArray(toolResponse.rawData.content)) {
                // 处理结构化内容数组
                const contentParts: string[] = []

                for (const item of toolResponse.rawData.content) {
                  if (item.type === 'text') {
                    contentParts.push(item.text)
                    messageParts.push({ type: 'text', text: item.text })
                  } else if (item.type === 'image') {
                    // 为Gemini处理图片
                    contentParts.push(`[图片内容]`)
                    // 添加图片到消息部分，Gemini可以理解这种格式
                    messageParts.push({
                      type: 'image_url',
                      image_url: {
                        url: `data:${item.mimeType};base64,${item.data}`
                      }
                    })
                  } else if (item.type === 'resource') {
                    if ('text' in item.resource && item.resource.text) {
                      contentParts.push(`[资源: ${item.resource.uri}]\n${item.resource.text}`)
                      messageParts.push({
                        type: 'text',
                        text: `[资源: ${item.resource.uri}]\n${item.resource.text}`
                      })
                    } else if (
                      'blob' in item.resource &&
                      item.resource.mimeType?.startsWith('image/')
                    ) {
                      // 处理图片类型的二进制资源
                      contentParts.push(`[图片资源: ${item.resource.uri}]`)
                      messageParts.push({
                        type: 'image_url',
                        image_url: {
                          url: `data:${item.resource.mimeType};base64,${item.resource.blob}`
                        }
                      })
                    } else {
                      contentParts.push(`[资源: ${item.resource.uri}]`)
                      messageParts.push({ type: 'text', text: `[资源: ${item.resource.uri}]` })
                    }
                  } else {
                    // 处理其他未知类型
                    const itemStr = JSON.stringify(item)
                    contentParts.push(itemStr)
                    messageParts.push({ type: 'text', text: itemStr })
                  }
                }

                // 合并所有文本内容用于显示
                responseContent = contentParts.join('\n\n')
              } else {
                // 其他情况转为字符串
                responseContent = JSON.stringify(toolResponse.content)
                messageParts.push({ type: 'text', text: responseContent })
              }

              // 添加助手消息到上下文
              conversationMessages.push({
                role: 'assistant',
                content: currentContent || `我将使用${functionName}工具来回答你的问题。`
              } as ChatMessage)

              // 添加工具结果到上下文，使用多模态格式
              conversationMessages.push({
                role: 'user',
                content:
                  messageParts.length > 1
                    ? messageParts
                    : `工具 ${functionName} 的调用结果：${responseContent}`
              } as ChatMessage)

              // 通知工具调用结束
              yield {
                content: '',
                tool_call: 'end',
                tool_call_name: functionName,
                tool_call_params: JSON.stringify(functionArgs),
                tool_call_response: responseContent,
                tool_call_id: toolCallId,
                tool_call_server_name: mcpToolCall.server.name,
                tool_call_server_icons: mcpToolCall.server.icons,
                tool_call_server_description: mcpToolCall.server.description,
                tool_call_response_raw: toolResponse.rawData
              }

              // 设置需要继续对话的标志
              needContinueConversation = true
            } catch (error) {
              console.error('工具调用失败:', error)
              const errorMessage = error instanceof Error ? error.message : String(error)

              yield {
                content: '',
                tool_call: 'error',
                tool_call_name: functionName,
                tool_call_params: JSON.stringify(functionArgs),
                tool_call_response: errorMessage,
                tool_call_id: `gemini-${Date.now()}`,
                tool_call_server_name: mcpToolCall.server.name,
                tool_call_server_icons: mcpToolCall.server.icons,
                tool_call_server_description: mcpToolCall.server.description
              }

              // 添加错误消息到上下文
              conversationMessages.push({
                role: 'assistant',
                content: currentContent || `我尝试使用${functionName}工具，但出现了错误。`
              } as ChatMessage)

              conversationMessages.push({
                role: 'user',
                content: `工具 ${functionName} 调用失败：${errorMessage}`
              } as ChatMessage)

              // 设置需要继续对话的标志，即使工具调用失败也继续
              needContinueConversation = true
            }
          }
        } else {
          // 如果没有工具调用，添加助手消息到上下文并结束对话
          if (currentContent) {
            conversationMessages.push({
              role: 'assistant',
              content: currentContent
            } as ChatMessage)
          }
          needContinueConversation = false
        }

        // 如果不需要继续对话或已达到最大工具调用次数，则结束循环
        if (!needContinueConversation || toolCallCount >= MAX_TOOL_CALLS) {
          break
        }
      }
      yield {
        totalUsage: totalUsage
      }
    } catch (error) {
      console.error('Gemini stream completions error:', error)
      throw error
    }
  }

  async *streamSummaries(
    text: string,
    modelId: string,
    temperature?: number,
    maxTokens?: number
  ): AsyncGenerator<LLMResponseStream> {
    if (!this.isInitialized) {
      throw new Error('Provider not initialized')
    }

    if (!modelId) {
      throw new Error('Model ID is required')
    }

    try {
      // 每次创建新的模型实例，并传入生成配置
      const model = this.getModel(modelId, temperature, maxTokens)

      const prompt = `请为以下内容生成一个简洁的摘要：\n\n${text}`

      const result = await model.generateContentStream({
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
      })

      for await (const chunk of result.stream) {
        // 使用官方文档解析方式解析chunk
        let content = ''
        if (chunk.candidates && chunk.candidates[0]?.content?.parts) {
          for (const part of chunk.candidates[0].content.parts) {
            if (part.text) {
              content += part.text
            } else if (part.inlineData) {
              // 如果有图像数据，转换为markdown图像格式
              const imageBase64 = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`
              const markdownImage = `\n![geminiPic](${imageBase64})\n`

              // 将markdown格式的图片添加到内容中
              content += markdownImage

              // 同时保留原始图像数据，以便渲染层可以使用
              yield {
                content: markdownImage,
                image_data: {
                  data: part.inlineData.data,
                  mimeType: part.inlineData.mimeType
                }
              }
            }
          }
        } else {
          // 兼容处理，如果没有按预期结构，尝试使用text()方法
          content = chunk.text() || ''
        }

        if (!content) continue

        yield {
          content
        }
      }
    } catch (error) {
      console.error('Gemini streamSummaries error:', error)
      throw error
    }
  }

  async *streamGenerateText(
    prompt: string,
    modelId: string,
    temperature?: number,
    maxTokens?: number
  ): AsyncGenerator<LLMResponseStream> {
    if (!this.isInitialized) {
      throw new Error('Provider not initialized')
    }

    if (!modelId) {
      throw new Error('Model ID is required')
    }

    try {
      // 每次创建新的模型实例，并传入生成配置
      const model = this.getModel(modelId, temperature, maxTokens)

      const result = await model.generateContentStream({
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
      })

      for await (const chunk of result.stream) {
        // 使用官方文档解析方式解析chunk
        let content = ''
        if (chunk.candidates && chunk.candidates[0]?.content?.parts) {
          for (const part of chunk.candidates[0].content.parts) {
            if (part.text) {
              content += part.text
            } else if (part.inlineData) {
              // 如果有图像数据，转换为markdown图像格式
              const imageBase64 = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`
              const markdownImage = `\n![geminiPic](${imageBase64})\n`

              // 将markdown格式的图片添加到内容中
              content += markdownImage

              // 同时保留原始图像数据，以便渲染层可以使用
              yield {
                content: markdownImage,
                image_data: {
                  data: part.inlineData.data,
                  mimeType: part.inlineData.mimeType
                }
              }
            }
          }
        } else {
          // 兼容处理，如果没有按预期结构，尝试使用text()方法
          content = chunk.text() || ''
        }

        if (!content) continue

        yield {
          content
        }
      }
    } catch (error) {
      console.error('Gemini streamGenerateText error:', error)
      throw error
    }
  }
}

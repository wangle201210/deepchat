import {
  LLM_PROVIDER,
  MODEL_META,
  LLMResponse,
  LLMResponseStream,
  MCPToolDefinition
} from '@shared/presenter'
import { ConfigPresenter } from '../configPresenter'
import { DevicePresenter } from '../devicePresenter'
import { jsonrepair } from 'jsonrepair'
// 定义ChatMessage接口用于统一消息格式
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string | ChatMessageContent[]
}

export interface ChatMessageContent {
  type: 'text' | 'image_url'
  text?: string
  image_url?: {
    url: string
    detail?: 'auto' | 'low' | 'high'
  }
}

/**
 * 基础LLM提供商抽象类
 *
 * 该类定义了所有LLM提供商必须实现的接口和共享功能，包括：
 * - 模型管理（获取、添加、删除、更新模型）
 * - 统一的消息格式
 * - 工具调用处理
 * - 对话生成和流式处理
 *
 * 所有特定的LLM提供商（如OpenAI、Anthropic、Gemini、Ollama等）都必须继承此类
 * 并实现其抽象方法。
 */
export abstract class BaseLLMProvider {
  // 最大工具调用次数限制
  protected static readonly MAX_TOOL_CALLS = 20

  protected provider: LLM_PROVIDER
  protected models: MODEL_META[] = []
  protected customModels: MODEL_META[] = []
  protected isInitialized: boolean = false
  protected configPresenter: ConfigPresenter

  protected defaultHeaders: Record<string, string> = {
    'HTTP-Referer': 'https://deepchatai.cn',
    'X-Title': 'DeepChat'
  }

  constructor(provider: LLM_PROVIDER, configPresenter: ConfigPresenter) {
    this.provider = provider
    this.configPresenter = configPresenter
    this.defaultHeaders = DevicePresenter.getDefaultHeaders()
  }

  /**
   * 获取最大工具调用次数
   * @returns 配置的最大工具调用次数
   */
  public static getMaxToolCalls(): number {
    return BaseLLMProvider.MAX_TOOL_CALLS
  }

  /**
   * 初始化提供商
   * 包括获取模型列表、配置代理等
   */
  protected async init() {
    if (this.provider.enable) {
      try {
        await this.fetchModels()
        // 检查是否需要自动启用所有模型
        await this.autoEnableModelsIfNeeded()
        this.isInitialized = true
        console.info('Provider initialized successfully:', this.provider.name)
      } catch (error) {
        console.warn('Provider initialization failed:', this.provider.name, error)
      }
    }
  }

  /**
   * 检查并自动启用模型
   * 如果没有任何已启用的模型，则自动启用所有模型
   */
  protected async autoEnableModelsIfNeeded() {
    if (!this.models || this.models.length === 0) return
    const providerId = this.provider.id

    // 检查是否有自定义模型
    const customModels = this.configPresenter.getCustomModels(providerId)
    if (customModels && customModels.length > 0) return

    // 检查是否有任何模型的状态被手动修改过
    const hasManuallyModifiedModels = this.models.some((model) =>
      this.configPresenter.getModelStatus(providerId, model.id)
    )
    if (hasManuallyModifiedModels) return

    // 检查是否有任何已启用的模型
    const hasEnabledModels = this.models.some((model) =>
      this.configPresenter.getModelStatus(providerId, model.id)
    )

    // 如果没有任何已启用的模型，则自动启用所有模型
    // 这部分后续应该改为启用推荐模型
    if (!hasEnabledModels) {
      console.info(`Auto enabling all models for provider: ${this.provider.name}`)
      this.models.forEach((model) => {
        this.configPresenter.enableModel(providerId, model.id)
      })
    }
  }

  /**
   * 获取提供商的模型列表
   * @returns 模型列表
   */
  public async fetchModels(): Promise<MODEL_META[]> {
    try {
      const models = await this.fetchProviderModels()
      console.log('Fetched models:', models?.length)
      this.models = models
      this.configPresenter.setProviderModels(this.provider.id, models)
      return models
    } catch (e) {
      console.error('Failed to fetch models:', e)
      if (!this.models) {
        this.models = []
      }
      return []
    }
  }

  /**
   * 获取特定提供商的模型
   * 此方法由具体的提供商子类实现
   * @returns 提供商支持的模型列表
   */
  protected abstract fetchProviderModels(): Promise<MODEL_META[]>

  /**
   * 获取所有模型（包括自定义模型）
   * @returns 模型列表
   */
  public getModels(): MODEL_META[] {
    return [...this.models, ...this.customModels]
  }

  /**
   * 添加自定义模型
   * @param model 模型基本信息
   * @returns 添加后的完整模型信息
   */
  public addCustomModel(model: Omit<MODEL_META, 'providerId' | 'isCustom' | 'group'>): MODEL_META {
    const newModel: MODEL_META = {
      ...model,
      providerId: this.provider.id,
      isCustom: true,
      group: 'default'
    }

    // 检查是否已存在相同ID的自定义模型
    const existingIndex = this.customModels.findIndex((m) => m.id === newModel.id)
    if (existingIndex !== -1) {
      this.customModels[existingIndex] = newModel
    } else {
      this.customModels.push(newModel)
    }

    return newModel
  }

  /**
   * 删除自定义模型
   * @param modelId 要删除的模型ID
   * @returns 是否删除成功
   */
  public removeCustomModel(modelId: string): boolean {
    const index = this.customModels.findIndex((model) => model.id === modelId)
    if (index !== -1) {
      this.customModels.splice(index, 1)
      return true
    }
    return false
  }

  /**
   * 更新自定义模型
   * @param modelId 要更新的模型ID
   * @param updates 要更新的字段
   * @returns 是否更新成功
   */
  public updateCustomModel(modelId: string, updates: Partial<MODEL_META>): boolean {
    const model = this.customModels.find((m) => m.id === modelId)
    if (model) {
      // 应用更新
      Object.assign(model, updates)
      return true
    }
    return false
  }

  /**
   * 获取所有自定义模型
   * @returns 自定义模型列表
   */
  public getCustomModels(): MODEL_META[] {
    return this.customModels
  }

  /**
   * 获取工具调用的提示词
   * 用于不支持原生工具调用的模型
   * @param tools 工具定义列表
   * @returns 格式化的提示词
   */
  protected getFunctionCallWrapPrompt(tools: MCPToolDefinition[]): string {
    return `
    你将根据用户的问题，选择合适的工具，并调用工具来解决问题，工具会以一个JSON数组的格式提供给你，内容在tool_list标签中:
    <tool_list>
  ${JSON.stringify(tools)}
    </tool_list>
    当需要使用工具时，你必须严格按照以下格式回复，保证函数调用的信息在function_call的标签中,每个标签有且只能有一个调用,如果需要调用多个工具,你需要生成多个function_call标签:
<function_call>
{
  "function_call": {
    "name": "<函数名称>",
    "arguments": { /* 参数对象，要求为有效 JSON 格式 */ }
  }
}
</function_call>
    例如，如果你需要调用函数 "getWeather" 并传入 "location" 和 "date"，请返回如下格式：
    <function_call>
   {
      "function_call": {
        "name": "getWeather",
        "arguments": { "location": "Beijing", "date": "2025-03-20" }
      }
    }
    </function_call>
    `
  }

  /**
   * 解析函数调用标签
   * 从响应文本中提取function_call标签并解析为工具调用
   * @param response 包含工具调用标签的响应文本
   * @returns 解析后的工具调用列表
   */
  protected parseFunctionCalls(
    response: string
  ): { id: string; type: string; function: { name: string; arguments: string } }[] {
    try {
      // 使用正则表达式匹配所有的function_call标签对
      const functionCallMatches = response.match(/<function_call>(.*?)<\/function_call>/gs)

      // 如果没有匹配到任何函数调用，返回空数组
      if (!functionCallMatches) {
        return []
      }

      // 解析每个匹配到的函数调用并组成数组
      const toolCalls = functionCallMatches
        .map((match) => {
          const content = match.replace(/<function_call>|<\/function_call>/g, '').trim()
          try {
            const parsedCall = JSON.parse(jsonrepair(content))
            return {
              id: parsedCall.function_call.name,
              type: 'function',
              function: {
                name: parsedCall.function_call.name,
                arguments: JSON.stringify(parsedCall.function_call.arguments)
              }
            }
          } catch (parseError) {
            console.error('Error parsing function call JSON:', parseError, match, content)
            return null
          }
        })
        .filter((call) => call !== null)

      return toolCalls
    } catch (error) {
      console.error('Error parsing function calls:', error)
      return []
    }
  }

  /**
   * 代理更新回调
   * 当代理配置变更时调用此方法更新提供商的代理设置
   */
  public abstract onProxyResolved(): void

  /**
   * 验证提供商API是否可用
   * @returns 验证结果和错误信息
   */
  public abstract check(): Promise<{ isOk: boolean; errorMsg: string | null }>

  /**
   * 生成对话标题
   *
   * @param messages 对话历史消息
   * @param modelId 模型ID
   * @returns 对话标题
   */
  public abstract summaryTitles(messages: ChatMessage[], modelId: string): Promise<string>

  /**
   * 同步获取完整的LLM响应
   *
   * 该方法发送单一请求获取完整的响应内容，适用于后台处理或需要完整结果的场景。
   * 特点：
   * 1. 一次性返回完整的响应结果
   * 2. 包含完整的token使用统计
   * 3. 解析并处理<think>标签，提取reasoning_content
   * 4. 不进行工具调用（工具调用仅在stream版本中处理）
   *
   * @param messages 对话历史消息
   * @param modelId 模型ID
   * @param temperature 温度参数（影响创造性，值越高创造性越强）
   * @param maxTokens 最大生成token数
   * @returns 包含content, reasoning_content和totalUsage的响应对象
   */
  abstract completions(
    messages: ChatMessage[],
    modelId: string,
    temperature?: number,
    maxTokens?: number
  ): Promise<LLMResponse>

  /**
   * 总结文本内容
   *
   * @param text 需要总结的文本
   * @param modelId 模型ID
   * @param temperature 温度参数
   * @param maxTokens 最大生成token数
   * @returns 总结后的响应
   */
  abstract summaries(
    text: string,
    modelId: string,
    temperature?: number,
    maxTokens?: number
  ): Promise<LLMResponse>

  /**
   * 根据提示生成文本
   *
   * @param prompt 文本提示
   * @param modelId 模型ID
   * @param temperature 温度参数
   * @param maxTokens 最大生成token数
   * @returns 生成的文本响应
   */
  abstract generateText(
    prompt: string,
    modelId: string,
    temperature?: number,
    maxTokens?: number
  ): Promise<LLMResponse>

  /**
   * 生成对话建议
   *
   * @param context 对话上下文
   * @param modelId 模型ID
   * @param temperature 温度参数
   * @param maxTokens 最大生成token数
   * @returns 建议列表
   */
  abstract suggestions(
    context: string,
    modelId: string,
    temperature?: number,
    maxTokens?: number
  ): Promise<string[]>

  /**
   * 流式对话生成
   *
   * 该方法以流的形式实时返回生成内容，适用于交互式对话和需要实时反馈的场景。
   * 特点：
   * 1. 实时流式返回部分响应
   * 2. 支持工具调用（通过function calling）
   * 3. 支持思考过程的实时展示
   * 4. 支持多轮工具调用的连续对话
   *
   * 流式响应包含：
   * - content: 当前生成的内容片段
   * - reasoning_content: 当前生成的思考过程片段
   * - tool_call相关信息: 工具调用的各种状态和数据
   * - totalUsage: 最终的token使用统计（仅在流结束时）
   *
   * @param messages 对话历史消息
   * @param modelId 模型ID
   * @param temperature 温度参数
   * @param maxTokens 最大生成token数
   * @returns 生成内容的异步迭代器
   */
  abstract streamCompletions(
    messages: ChatMessage[],
    modelId: string,
    temperature?: number,
    maxTokens?: number
  ): AsyncGenerator<LLMResponseStream>

  /**
   * 流式总结文本
   *
   * @param text 需要总结的文本
   * @param modelId 模型ID
   * @param temperature 温度参数
   * @param maxTokens 最大生成token数
   * @returns 总结内容的异步迭代器
   */
  abstract streamSummaries(
    text: string,
    modelId: string,
    temperature?: number,
    maxTokens?: number
  ): AsyncGenerator<LLMResponseStream>

  /**
   * 流式生成文本
   *
   * @param prompt 文本提示
   * @param modelId 模型ID
   * @param temperature 温度参数
   * @param maxTokens 最大生成token数
   * @returns 生成内容的异步迭代器
   */
  abstract streamGenerateText(
    prompt: string,
    modelId: string,
    temperature?: number,
    maxTokens?: number
  ): AsyncGenerator<LLMResponseStream>
}

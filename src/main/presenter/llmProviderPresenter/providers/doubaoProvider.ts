import { LLM_PROVIDER, LLMResponse, LLMResponseStream, MODEL_META } from '@shared/presenter'
import { OpenAICompatibleProvider } from './openAICompatibleProvider'
import { ConfigPresenter } from '../../configPresenter'
import { ChatMessage } from '../baseProvider'

export class DoubaoProvider extends OpenAICompatibleProvider {
  constructor(provider: LLM_PROVIDER, configPresenter: ConfigPresenter) {
    // 初始化豆包模型配置
    super(provider, configPresenter)
  }

  protected async fetchOpenAIModels(): Promise<MODEL_META[]> {
    return [
      {
        id: '1.5',
        name: 'doubao-1.5-pro-32k-250115',
        group: 'doubao',
        providerId: this.provider.id,
        isCustom: false,
        contextLength: 32000,
        maxTokens: 4096
      },
      {
        id: 'deepseek-r1-250120',
        name: 'deepseek-r1',
        group: 'doubao',
        providerId: this.provider.id,
        isCustom: false,
        contextLength: 64000,
        maxTokens: 4096
      },
      {
        id: 'deepseek-r1-distill-qwen-32b-250120',
        name: 'deepseek-r1-distill-qwen-32b',
        group: 'doubao',
        providerId: this.provider.id,
        isCustom: false,
        contextLength: 32000,
        maxTokens: 4096
      },
      {
        id: 'deepseek-r1-distill-qwen-7b-250120',
        name: 'deepseek-r1-distill-qwen-7b',
        group: 'doubao',
        providerId: this.provider.id,
        isCustom: false,
        contextLength: 32000,
        maxTokens: 4096
      },
      {
        id: 'deepseek-v3-250324',
        name: 'deepseek-v3',
        group: 'doubao',
        providerId: this.provider.id,
        isCustom: false,
        contextLength: 64000,
        maxTokens: 4096
      }
    ]
  }

  async completions(
    messages: ChatMessage[],
    modelId: string,
    temperature?: number,
    maxTokens?: number
  ): Promise<LLMResponse> {
    return this.openAICompletion(messages, modelId, temperature, maxTokens)
  }

  async summaries(
    text: string,
    modelId: string,
    temperature?: number,
    maxTokens?: number
  ): Promise<LLMResponse> {
    return this.openAICompletion(
      [
        {
          role: 'user',
          content: `请总结以下内容，使用简洁的语言，突出重点：\n${text}`
        }
      ],
      modelId,
      temperature,
      maxTokens
    )
  }

  async generateText(
    prompt: string,
    modelId: string,
    temperature?: number,
    maxTokens?: number
  ): Promise<LLMResponse> {
    return this.openAICompletion(
      [
        {
          role: 'user',
          content: prompt
        }
      ],
      modelId,
      temperature,
      maxTokens
    )
  }

  async suggestions(
    context: string,
    modelId: string,
    temperature?: number,
    maxTokens?: number
  ): Promise<string[]> {
    const response = await this.openAICompletion(
      [
        {
          role: 'user',
          content: `基于以下上下文，给出3个可能的回复建议，每个建议一行：\n${context}`
        }
      ],
      modelId,
      temperature,
      maxTokens
    )
    return response.content.split('\n').filter((line) => line.trim().length > 0)
  }

  async *streamCompletions(
    messages: ChatMessage[],
    modelId: string,
    temperature?: number,
    maxTokens?: number
  ): AsyncGenerator<LLMResponseStream> {
    yield* this.openAIStreamCompletion(messages, modelId, temperature, maxTokens)
  }

  async *streamSummaries(
    text: string,
    modelId: string,
    temperature?: number,
    maxTokens?: number
  ): AsyncGenerator<LLMResponseStream> {
    yield* this.openAIStreamCompletion(
      [
        {
          role: 'user',
          content: `请总结以下内容，使用简洁的语言，突出重点：\n${text}`
        }
      ],
      modelId,
      temperature,
      maxTokens
    )
  }

  async *streamGenerateText(
    prompt: string,
    modelId: string,
    temperature?: number,
    maxTokens?: number
  ): AsyncGenerator<LLMResponseStream> {
    yield* this.openAIStreamCompletion(
      [
        {
          role: 'user',
          content: prompt
        }
      ],
      modelId,
      temperature,
      maxTokens
    )
  }
}

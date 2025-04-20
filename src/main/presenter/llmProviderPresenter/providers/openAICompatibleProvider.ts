import {
  LLM_PROVIDER,
  LLMResponse,
  MODEL_META,
  MCPToolDefinition,
  LLMCoreStreamEvent,
  ModelConfig
} from '@shared/presenter'
import { BaseLLMProvider, ChatMessage } from '../baseProvider'
import OpenAI from 'openai'
import {
  ChatCompletionContentPartText,
  ChatCompletionMessage,
  ChatCompletionMessageParam
} from 'openai/resources'
import { ConfigPresenter } from '../../configPresenter'
import { proxyConfig } from '../../proxyConfig'
import { HttpsProxyAgent } from 'https-proxy-agent'
import { presenter } from '@/presenter'
import { eventBus } from '@/eventbus'
import { NOTIFICATION_EVENTS } from '@/events'
import { jsonrepair } from 'jsonrepair'

const OPENAI_REASONING_MODELS = ['o3-mini', 'o3-preview', 'o1-mini', 'o1-pro', 'o1-preview', 'o1']

export class OpenAICompatibleProvider extends BaseLLMProvider {
  protected openai!: OpenAI
  private isNoModelsApi: boolean = false
  // 添加不支持 OpenAI 标准接口的供应商黑名单
  private static readonly NO_MODELS_API_LIST: string[] = []

  constructor(provider: LLM_PROVIDER, configPresenter: ConfigPresenter) {
    super(provider, configPresenter)
    const proxyUrl = proxyConfig.getProxyUrl()
    this.openai = new OpenAI({
      apiKey: this.provider.apiKey,
      baseURL: this.provider.baseUrl,
      httpAgent: proxyUrl ? new HttpsProxyAgent(proxyUrl) : undefined,
      defaultHeaders: {
        ...this.defaultHeaders
      }
    })
    if (OpenAICompatibleProvider.NO_MODELS_API_LIST.includes(this.provider.id.toLowerCase())) {
      this.isNoModelsApi = true
    }
    this.init()
  }

  public onProxyResolved(): void {
    const proxyUrl = proxyConfig.getProxyUrl()
    this.openai = new OpenAI({
      apiKey: this.provider.apiKey,
      baseURL: this.provider.baseUrl,
      httpAgent: proxyUrl ? new HttpsProxyAgent(proxyUrl) : undefined
    })
  }

  // 实现BaseLLMProvider中的抽象方法fetchProviderModels
  protected async fetchProviderModels(options?: { timeout: number }): Promise<MODEL_META[]> {
    // 检查供应商是否在黑名单中
    if (this.isNoModelsApi) {
      console.log(`Provider ${this.provider.name} does not support OpenAI models API`)
      return this.models
    }
    return this.fetchOpenAIModels(options)
  }

  protected async fetchOpenAIModels(options?: { timeout: number }): Promise<MODEL_META[]> {
    const response = await this.openai.models.list(options)
    return response.data.map((model) => ({
      id: model.id,
      name: model.id,
      group: 'default',
      providerId: this.provider.id,
      isCustom: false,
      contextLength: 4096,
      maxTokens: 2048
    }))
  }

  // 辅助方法：格式化消息
  protected formatMessages(messages: ChatMessage[]): ChatMessage[] {
    return messages
  }

  // OpenAI完成方法
  protected async openAICompletion(
    messages: ChatMessage[],
    modelId?: string,
    temperature?: number,
    maxTokens?: number
  ): Promise<LLMResponse> {
    if (!this.isInitialized) {
      throw new Error('Provider not initialized')
    }

    if (!modelId) {
      throw new Error('Model ID is required')
    }
    const requestParams: OpenAI.Chat.ChatCompletionCreateParams = {
      messages: messages as ChatCompletionMessageParam[],
      model: modelId,
      stream: false,
      temperature: temperature,
      max_tokens: maxTokens
    }
    OPENAI_REASONING_MODELS.forEach((noTempId) => {
      if (modelId.startsWith(noTempId)) {
        delete requestParams.temperature
      }
    })
    const completion = await this.openai.chat.completions.create(requestParams)

    const message = completion.choices[0].message as ChatCompletionMessage & {
      reasoning_content?: string
    }
    const resultResp: LLMResponse = {
      content: ''
    }

    // 处理原生 reasoning_content
    if (message.reasoning_content) {
      resultResp.reasoning_content = message.reasoning_content
      resultResp.content = message.content || ''
      return resultResp
    }

    // 处理 <think> 标签
    if (message.content) {
      const content = message.content.trimStart()
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
          resultResp.content = message.content
        }
      } else {
        // 没有 think 标签，所有内容作为普通内容
        resultResp.content = message.content
      }
    }

    return resultResp
  }

  // [NEW] Core stream method implementation
  async *coreStream(
    messages: ChatMessage[],
    modelId: string,
    modelConfig: ModelConfig,
    temperature: number,
    maxTokens: number,
    mcpTools: MCPToolDefinition[]
  ): AsyncGenerator<LLMCoreStreamEvent> {
    if (!this.isInitialized) throw new Error('Provider not initialized')
    if (!modelId) throw new Error('Model ID is required')

    const tools = mcpTools || []
    const supportsFunctionCall = modelConfig?.functionCall || false
    let processedMessages = [...messages] as ChatCompletionMessageParam[]
    if (tools.length > 0 && !supportsFunctionCall) {
      processedMessages = this.prepareFunctionCallPrompt(processedMessages, tools)
    }
    const apiTools =
      tools.length > 0 && supportsFunctionCall
        ? await presenter.mcpPresenter.mcpToolsToOpenAITools(tools, this.provider.id)
        : undefined
    const requestParams: OpenAI.Chat.ChatCompletionCreateParams = {
      messages: processedMessages,
      model: modelId,
      stream: true,
      temperature,
      max_tokens: maxTokens
    }
    OPENAI_REASONING_MODELS.forEach((noTempId) => {
      if (modelId.startsWith(noTempId)) delete requestParams.temperature
    })
    if (apiTools && apiTools.length > 0 && supportsFunctionCall) requestParams.tools = apiTools

    const stream = await this.openai.chat.completions.create(requestParams)

    // --- State Variables ---
    let mainBuffer = '' // Single buffer for all text/tag content
    let isInThinkTag = false
    let isInFunctionCallTag = false // For non-native calls
    let functionCallBuffer = '' // 用于函数调用标签的缓冲区

    const tagStartMarker = '<function_call>'
    const tagEndMarker = '</function_call>'
    const thinkStartMarker = '<think>'
    const thinkEndMarker = '</think>'

    const nativeToolCalls: Record<string, { name: string; arguments: string }> = {}
    let stopReason: LLMCoreStreamEvent['stop_reason'] = 'complete'
    let toolUseDetected = false

    // --- Stream Processing Loop ---
    for await (const chunk of stream) {
      const choice = chunk.choices[0]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const delta = choice?.delta as any
      const currentContent = delta?.content || ''

      // 1. Handle Non-Content Events First
      if (chunk.usage) yield { type: 'usage', usage: chunk.usage }
      if (delta?.reasoning_content || delta?.reasoning) {
        yield { type: 'reasoning', reasoning_content: delta.reasoning_content || delta.reasoning }
        continue
      }
      if (supportsFunctionCall && delta?.tool_calls?.length > 0) {
        toolUseDetected = true
        for (const toolCallDelta of delta.tool_calls) {
          const id = toolCallDelta.id
          if (id && !nativeToolCalls[id]) {
            nativeToolCalls[id] = { name: '', arguments: '' }
            if (toolCallDelta.function?.name) {
              nativeToolCalls[id].name = toolCallDelta.function.name
              yield {
                type: 'tool_call_start',
                tool_call_id: id,
                tool_call_name: toolCallDelta.function.name
              }
            }
          }
          if (
            id &&
            nativeToolCalls[id] &&
            toolCallDelta.function?.name &&
            !nativeToolCalls[id].name
          ) {
            nativeToolCalls[id].name = toolCallDelta.function.name
            yield {
              type: 'tool_call_start',
              tool_call_id: id,
              tool_call_name: toolCallDelta.function.name
            }
          }
          if (id && nativeToolCalls[id] && toolCallDelta.function?.arguments) {
            const argumentChunk = toolCallDelta.function.arguments
            nativeToolCalls[id].arguments += argumentChunk
            yield {
              type: 'tool_call_chunk',
              tool_call_id: id,
              tool_call_arguments_chunk: argumentChunk
            }
          }
        }
        continue
      }
      if (choice?.finish_reason) {
        const reasonFromAPI = choice.finish_reason
        console.log('Finish Reason from API:', reasonFromAPI)
        if (toolUseDetected) {
          stopReason = 'tool_use' /* finalize native calls if needed */
        } else if (reasonFromAPI === 'stop') stopReason = 'complete'
        else if (reasonFromAPI === 'length') stopReason = 'max_tokens'
        else if (reasonFromAPI === 'tool_calls') {
          console.warn("API finish 'tool_calls', but toolUseDetected false.")
          stopReason = 'tool_use' /* finalize native calls */
        } else {
          console.warn(`Unhandled finish reason: ${reasonFromAPI}`)
          stopReason = 'error'
        }
        console.log('Final Stop Reason Set:', stopReason)
        break
      }
      if (!currentContent) continue

      // 2. 处理不支持function call的模型
      if (!supportsFunctionCall && tools.length > 0) {
        // 解析function call标签
        const tagResult = this.processFunctionCallTagInContent(
          currentContent,
          isInFunctionCallTag,
          functionCallBuffer
        )

        // 更新状态
        isInFunctionCallTag = tagResult.isInFunctionCallTag
        functionCallBuffer = tagResult.functionCallBuffer

        // 如果有完整的function call
        if (tagResult.completeFunctionCall) {
          const handleResult = this.handleCompletedFunctionCall(
            tagResult.completeFunctionCall,
            'non-native'
          )

          if (handleResult.modified) {
            toolUseDetected = true
            for (const parsedCall of handleResult.toolCalls) {
              yield {
                type: 'tool_call_start',
                tool_call_id: parsedCall.id,
                tool_call_name: parsedCall.function.name
              }
              yield {
                type: 'tool_call_chunk',
                tool_call_id: parsedCall.id,
                tool_call_arguments_chunk: parsedCall.function.arguments
              }
              yield {
                type: 'tool_call_end',
                tool_call_id: parsedCall.id,
                tool_call_arguments_complete: parsedCall.function.arguments
              }
            }
          }
        }

        // 如果有普通内容需要输出
        if (tagResult.pendingContent) {
          mainBuffer += tagResult.pendingContent
        }

        // 如果在函数调用标签内，继续等待更多内容
        if (isInFunctionCallTag) {
          continue
        }
      } else {
        // 3. 默认情况，直接添加到主缓冲区
        mainBuffer += currentContent
      }

      // 4. Process Buffer Iteratively for Tags and Text
      let bufferChanged = true
      while (bufferChanged) {
        bufferChanged = false // Assume no changes in this pass

        if (isInFunctionCallTag) {
          // --- Currently INSIDE a function call tag ---
          const endTagIndex = mainBuffer.indexOf(tagEndMarker)
          if (endTagIndex !== -1) {
            // Found the end!
            const callContent = mainBuffer.substring(0, endTagIndex)
            const remainingAfterTag = mainBuffer.substring(endTagIndex + tagEndMarker.length)

            console.log('>>> Function call completed. Content:', callContent)
            toolUseDetected = true
            console.log('>>> Set toolUseDetected = true')

            const fullTagForParsing = `${tagStartMarker}${callContent}${tagEndMarker}`
            const parsedCalls = this.parseFunctionCalls(
              fullTagForParsing,
              `non-native-${this.provider.id}`
            )
            for (const parsedCall of parsedCalls) {
              yield {
                type: 'tool_call_start',
                tool_call_id: parsedCall.id,
                tool_call_name: parsedCall.function.name
              }
              yield {
                type: 'tool_call_chunk',
                tool_call_id: parsedCall.id,
                tool_call_arguments_chunk: parsedCall.function.arguments
              }
              yield {
                type: 'tool_call_end',
                tool_call_id: parsedCall.id,
                tool_call_arguments_complete: parsedCall.function.arguments
              }
            }

            isInFunctionCallTag = false // Exit tag state
            mainBuffer = remainingAfterTag // Update buffer with remaining content
            bufferChanged = true // Buffer was modified, loop again
          } else {
            // End tag not found yet, buffer contains only partial tag content.
            // Do nothing, wait for more chunks. Loop will naturally end.
          }
        } else if (isInThinkTag) {
          // --- Currently INSIDE a think tag ---
          const thinkEndIndex = mainBuffer.indexOf(thinkEndMarker)
          if (thinkEndIndex !== -1) {
            // Found the end!
            const reasoningContent = mainBuffer.substring(0, thinkEndIndex)
            const remainingAfterTag = mainBuffer.substring(thinkEndIndex + thinkEndMarker.length)

            if (reasoningContent) {
              yield { type: 'reasoning', reasoning_content: reasoningContent }
            }
            isInThinkTag = false // Exit tag state
            mainBuffer = remainingAfterTag // Update buffer
            bufferChanged = true // Loop again
          } else {
            // End tag not found yet.
            // Do nothing, wait for more chunks.
          }
        } else {
          // --- Currently OUTSIDE any known tag ---
          // Find the *first* occurrence of any start tag
          const funcStartIndex =
            !supportsFunctionCall && tools.length > 0 ? mainBuffer.indexOf(tagStartMarker) : -1
          const thinkStartIndex = mainBuffer.indexOf(thinkStartMarker)

          let firstTagIndex = -1
          let isFuncTag = false
          let isThinkTag = false

          if (
            funcStartIndex !== -1 &&
            (thinkStartIndex === -1 || funcStartIndex < thinkStartIndex)
          ) {
            firstTagIndex = funcStartIndex
            isFuncTag = true
          } else if (thinkStartIndex !== -1) {
            firstTagIndex = thinkStartIndex
            isThinkTag = true
          }

          if (firstTagIndex !== -1) {
            // Found a start tag
            const textBefore = mainBuffer.substring(0, firstTagIndex)
            if (textBefore) {
              yield { type: 'text', content: textBefore } // Yield text before the tag
            }

            if (isFuncTag) {
              isInFunctionCallTag = true
              mainBuffer = mainBuffer.substring(firstTagIndex + tagStartMarker.length) // Keep content after start tag
            } else if (isThinkTag) {
              isInThinkTag = true
              const { cleanedPosition } = this.cleanTag(mainBuffer, thinkStartMarker) // Use cleanTag to handle potential whitespace
              mainBuffer = mainBuffer.substring(cleanedPosition) // Keep content after clean start tag
            }
            bufferChanged = true // State changed, loop again
          } else {
            // No start tags found in the current buffer. Yield the entire buffer as text.
            if (mainBuffer) {
              yield { type: 'text', content: mainBuffer }
              mainBuffer = '' // Clear buffer after yielding
              // bufferChanged remains false, loop will end.
            }
          }
        } // End of state check (inFunc, inThink, outside)
      } // End while(bufferChanged)
    } // End for await...of stream

    // --- Finalization ---
    // Yield any remaining buffer content (could be partial tags or text)
    if (mainBuffer) {
      console.warn('Finalizing with non-empty buffer:', mainBuffer)
      if (isInFunctionCallTag) {
        console.warn('Buffer likely contains partial function call content.')
        yield { type: 'text', content: mainBuffer } // Yield as text
      } else if (isInThinkTag) {
        yield { type: 'reasoning', reasoning_content: mainBuffer } // Yield remaining reasoning
      } else {
        yield { type: 'text', content: mainBuffer } // Yield remaining text
      }
    }

    // Handle unterminated function call buffer
    if (functionCallBuffer) {
      console.warn('Finalizing with non-empty function call buffer:', functionCallBuffer)
      yield { type: 'text', content: functionCallBuffer }
    }

    // Log state warnings
    if (isInFunctionCallTag)
      console.warn('Stream ended while still inside <function_call> tag state.')
    if (isInThinkTag) console.warn('Stream ended while still inside <think> tag state.')

    yield { type: 'stop', stop_reason: stopReason }
  }

  // ... [prepareFunctionCallPrompt remains unchanged] ...
  private prepareFunctionCallPrompt(
    messages: ChatCompletionMessageParam[],
    mcpTools: MCPToolDefinition[]
  ): ChatCompletionMessageParam[] {
    // 创建消息副本而不是直接修改原始消息
    const result = messages.map((message) => ({ ...message }))

    const functionCallPrompt = this.getFunctionCallWrapPrompt(mcpTools)
    const userMessage = result.findLast((message) => message.role === 'user')

    if (userMessage?.role === 'user') {
      if (Array.isArray(userMessage.content)) {
        // 创建content数组的深拷贝
        userMessage.content = [...userMessage.content]
        const firstTextIndex = userMessage.content.findIndex((content) => content.type === 'text')
        if (firstTextIndex !== -1) {
          // 创建文本内容的副本
          const textContent = {
            ...userMessage.content[firstTextIndex]
          } as ChatCompletionContentPartText
          textContent.text = `${functionCallPrompt}\n\n${(userMessage.content[firstTextIndex] as ChatCompletionContentPartText).text}`
          userMessage.content[firstTextIndex] = textContent
        }
      } else {
        userMessage.content = `${functionCallPrompt}\n\n${userMessage.content}`
      }
    }
    return result
  }

  // Updated parseFunctionCalls signature and implementation
  protected parseFunctionCalls(
    response: string,
    // Pass a prefix for creating fallback IDs
    fallbackIdPrefix: string = 'tool-call'
  ): Array<{ id: string; type: string; function: { name: string; arguments: string } }> {
    try {
      // 使用非贪婪模式匹配function_call标签对，能够处理多行内容
      const functionCallMatches = response.match(/<function_call>([\s\S]*?)<\/function_call>/gs)
      if (!functionCallMatches) {
        return []
      }
      const toolCalls = functionCallMatches
        .map((match, index) => {
          // Add index for unique fallback ID generation
          const content = match.replace(/<\/?function_call>/g, '').trim() // Fixed regex escaping
          try {
            let parsedCall
            try {
              // Attempt standard JSON parse first
              parsedCall = JSON.parse(content)
            } catch (initialParseError) {
              console.warn('Standard JSON parse failed, attempting jsonrepair for:', content)
              try {
                // Fallback to jsonrepair for robustness
                parsedCall = JSON.parse(jsonrepair(content))
              } catch (repairError) {
                console.error(
                  'Failed to parse function call content even with jsonrepair:',
                  repairError,
                  content
                )
                return null // Skip this malformed call
              }
            }

            // Extract name and arguments, handling various potential structures
            let functionName, functionArgs
            if (parsedCall.function_call && typeof parsedCall.function_call === 'object') {
              functionName = parsedCall.function_call.name
              functionArgs = parsedCall.function_call.arguments
            } else if (parsedCall.name && parsedCall.arguments !== undefined) {
              functionName = parsedCall.name
              functionArgs = parsedCall.arguments
            } else if (
              parsedCall.function &&
              typeof parsedCall.function === 'object' &&
              parsedCall.function.name
            ) {
              functionName = parsedCall.function.name
              functionArgs = parsedCall.function.arguments
            } else {
              // Attempt to find the function call structure if nested under a single key
              // (e.g., Groq Llama3 tool use format)
              const keys = Object.keys(parsedCall)
              if (keys.length === 1) {
                const potentialToolCall = parsedCall[keys[0]]
                if (potentialToolCall && typeof potentialToolCall === 'object') {
                  if (potentialToolCall.name && potentialToolCall.arguments !== undefined) {
                    functionName = potentialToolCall.name
                    functionArgs = potentialToolCall.arguments
                  } else if (
                    potentialToolCall.function &&
                    typeof potentialToolCall.function === 'object' &&
                    potentialToolCall.function.name
                  ) {
                    // Handle nested function object like { "tool_name": { function: { name: "...", args: "..." } } }
                    functionName = potentialToolCall.function.name
                    functionArgs = potentialToolCall.function.arguments
                  }
                }
              }

              // If still not found, log an error
              if (!functionName) {
                console.error('Could not determine function name from parsed call:', parsedCall)
                return null
              }
            }

            // Ensure arguments are stringified if they are not already
            if (typeof functionArgs !== 'string') {
              try {
                functionArgs = JSON.stringify(functionArgs)
              } catch (stringifyError) {
                console.error(
                  'Failed to stringify function arguments:',
                  stringifyError,
                  functionArgs
                )
                // Decide how to handle: return null, or use a placeholder? Using placeholder for now.
                functionArgs = '{"error": "failed to stringify arguments"}' // Corrected unnecessary escapes
              }
            }

            // Generate a unique ID if not provided in the parsed content
            const id = parsedCall.id || functionName || `${fallbackIdPrefix}-${index}-${Date.now()}`

            return {
              id: String(id), // Ensure ID is string
              type: 'function', // Standardize type
              function: {
                name: String(functionName), // Ensure name is string
                arguments: functionArgs // Already ensured string
              }
            }
          } catch (processingError) {
            // Catch errors during the extraction/validation logic
            console.error('Error processing parsed function call JSON:', processingError, content)
            return null // Skip this call on error
          }
        })
        .filter(
          (
            call
          ): call is { id: string; type: string; function: { name: string; arguments: string } } => // Type guard ensures correct structure
            call !== null &&
            typeof call.id === 'string' &&
            typeof call.function === 'object' &&
            call.function !== null &&
            typeof call.function.name === 'string' &&
            typeof call.function.arguments === 'string'
        )

      return toolCalls
    } catch (error) {
      console.error('Unexpected error during parseFunctionCalls execution:', error)
      return [] // Return empty array on unexpected errors
    }
  }

  // ... [cleanTag remains unchanged] ...
  private cleanTag(text: string, tag: string): { cleanedPosition: number; found: boolean } {
    const tagIndex = text.indexOf(tag)
    if (tagIndex === -1) return { cleanedPosition: 0, found: false }
    let endPosition = tagIndex + tag.length
    while (endPosition < text.length && /\s/.test(text[endPosition])) {
      endPosition++
    }
    return { cleanedPosition: endPosition, found: true }
  }

  // ... [check, summaryTitles, completions, summaries, generateText, suggestions remain unchanged] ...
  public async check(): Promise<{ isOk: boolean; errorMsg: string | null }> {
    try {
      if (!this.isNoModelsApi) {
        // Use a reasonable timeout
        const models = await this.fetchOpenAIModels({ timeout: 5000 }) // Increased timeout slightly
        this.models = models // Store fetched models
      }
      // Potentially add a simple API call test here if needed, e.g., list models even for no-API list to check key/endpoint
      return { isOk: true, errorMsg: null }
    } catch (error: unknown) {
      // Use unknown for type safety
      let errorMessage = 'An unknown error occurred during provider check.'
      if (error instanceof Error) {
        errorMessage = error.message
      } else if (typeof error === 'string') {
        errorMessage = error
      }
      // Optionally log the full error object for debugging
      console.error('OpenAICompatibleProvider check failed:', error)

      eventBus.emit(NOTIFICATION_EVENTS.SHOW_ERROR, {
        title: 'API Check Failed', // More specific title
        message: errorMessage,
        id: `openai-check-error-${Date.now()}`,
        type: 'error'
      })
      return { isOk: false, errorMsg: errorMessage }
    }
  }
  public async summaryTitles(messages: ChatMessage[], modelId: string): Promise<string> {
    const systemPrompt = `You need to summarize the user's conversation into a title of no more than 10 words, with the title language matching the user's primary language, without using punctuation or other special symbols`
    const fullMessage: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: messages.map((m) => `${m.role}: ${m.content}`).join('\n') }
    ]
    const response = await this.openAICompletion(fullMessage, modelId, 0.5)
    return response.content.replace(/["']/g, '').trim()
  }
  async completions(
    messages: ChatMessage[],
    modelId: string,
    temperature?: number,
    maxTokens?: number
  ): Promise<LLMResponse> {
    // Simple completion, no specific system prompt needed unless required by base class or future design
    return this.openAICompletion(this.formatMessages(messages), modelId, temperature, maxTokens)
  }
  async summaries(
    text: string,
    modelId: string,
    temperature?: number,
    maxTokens?: number
  ): Promise<LLMResponse> {
    const systemPrompt = `Summarize the following text concisely:`
    // Create messages based on the input text
    const requestMessages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: text } // Use the input text directly
    ]
    return this.openAICompletion(requestMessages, modelId, temperature, maxTokens)
  }
  async generateText(
    prompt: string,
    modelId: string,
    temperature?: number,
    maxTokens?: number
  ): Promise<LLMResponse> {
    // Use the prompt directly as the user message content
    const requestMessages: ChatMessage[] = [{ role: 'user', content: prompt }]
    // Note: formatMessages might not be needed here if it's just a single prompt string,
    // but keeping it for consistency in case formatMessages adds system prompts or other logic.
    return this.openAICompletion(
      this.formatMessages(requestMessages),
      modelId,
      temperature,
      maxTokens
    )
  }
  async suggestions(
    messages: ChatMessage[],
    modelId: string,
    temperature?: number,
    maxTokens?: number
  ): Promise<string[]> {
    const systemPrompt = `Based on the last user message in the conversation history, provide 3 brief, relevant follow-up suggestions or questions. Output ONLY the suggestions, each on a new line. Do not include numbering, bullet points, or introductory text like "Here are some suggestions:".`
    const lastUserMessage = messages.filter((m) => m.role === 'user').pop() // Get the most recent user message

    if (!lastUserMessage) {
      console.warn('suggestions called without user messages.')
      return [] // Return empty array if no user message found
    }

    // Provide some context if possible, e.g., last few messages
    const contextMessages = messages.slice(-5) // Last 5 messages as context

    const requestMessages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      // Include context leading up to the last user message
      ...this.formatMessages(contextMessages)
    ]

    try {
      const response = await this.openAICompletion(
        requestMessages,
        modelId,
        temperature ?? 0.7,
        maxTokens ?? 60
      ) // Adjusted temp/tokens
      // Split, trim, and filter results robustly
      return response.content
        .split('\n')
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && !s.match(/^[0-9.\-*\s]*/)) // Fixed regex range
    } catch (error) {
      console.error('Failed to get suggestions:', error)
      return [] // Return empty on error
    }
  }

  private processFunctionCallTagInContent(
    content: string,
    isInFunctionCallTag: boolean,
    functionCallBuffer: string
  ): {
    isInFunctionCallTag: boolean
    functionCallBuffer: string
    completeFunctionCall: string | null
    pendingContent: string // 需要作为普通内容发出的缓存
  } {
    const result = {
      isInFunctionCallTag,
      functionCallBuffer,
      completeFunctionCall: null as string | null,
      pendingContent: '' // 非function_call标签的内容
    }

    // 检查结束标签，如果已经在标签内
    if (isInFunctionCallTag) {
      // 已经在标签内，继续累积内容
      result.functionCallBuffer += content

      // 检查结束标签 - 使用[\s\S]*?匹配多行内容
      const tagEndIndex = result.functionCallBuffer.indexOf('</function_call>')

      if (tagEndIndex !== -1) {
        // 找到完整的function call
        const fullContent = result.functionCallBuffer.substring(0, tagEndIndex)
        result.completeFunctionCall = `<function_call>${fullContent}</function_call>`

        // 保存标签后的内容作为普通内容
        result.pendingContent = result.functionCallBuffer.substring(
          tagEndIndex + '</function_call>'.length
        )

        // 重置状态
        result.isInFunctionCallTag = false
        result.functionCallBuffer = ''

        return result
      }

      // 如果没有结束标签，继续等待更多内容
      return result
    }

    // 不在标签内，检查是否有开始标签
    const tagStartIndex = content.indexOf('<function_call>')

    if (tagStartIndex !== -1) {
      // 找到开始标签
      // 将标签前的内容作为普通文本
      result.pendingContent = content.substring(0, tagStartIndex)

      // 提取标签开始后的内容
      const afterTagStart = content.substring(tagStartIndex + '<function_call>'.length)

      // 检查是否在同一块内容中就包含了结束标签
      const tagEndIndex = afterTagStart.indexOf('</function_call>')

      if (tagEndIndex !== -1) {
        // 找到完整的function call
        const callContent = afterTagStart.substring(0, tagEndIndex)
        result.completeFunctionCall = `<function_call>${callContent}</function_call>`

        // 添加标签后的内容到普通文本
        result.pendingContent += afterTagStart.substring(tagEndIndex + '</function_call>'.length)

        // 不需要更新标签状态，因为完整处理了
        return result
      } else {
        // 只有开始标签，没有结束标签
        result.isInFunctionCallTag = true
        result.functionCallBuffer = afterTagStart
        return result
      }
    }

    // 检查是否包含不完整的开始标签（例如只包含"<func"）
    const lessThanIndex = content.lastIndexOf('<')
    if (lessThanIndex !== -1 && lessThanIndex <= content.length - 1) {
      // 确保有字符跟在<后面
      const afterLessThan = content.substring(lessThanIndex)
      const tagPrefix = '<function_call>'
      console.log('afterLessThan', afterLessThan, tagPrefix)
      // 检查是否是function_call标签的部分开始
      if (tagPrefix.startsWith(afterLessThan)) {
        // 将前面部分作为普通内容输出
        result.pendingContent = content.substring(0, lessThanIndex)

        // 将不完整标签保存到buffer等待下一个chunk
        result.functionCallBuffer = afterLessThan
        result.isInFunctionCallTag = true
        return result
      }
    }

    // 如果没有找到任何相关标签，整个内容作为普通文本
    result.pendingContent = content
    return result
  }

  // 处理function call完成事件
  private handleCompletedFunctionCall(
    functionCallContent: string,
    fallbackIdPrefix: string = 'non-native'
  ): {
    toolCalls: Array<{ id: string; type: string; function: { name: string; arguments: string } }>
    modified: boolean
  } {
    const result = {
      toolCalls: [] as Array<{
        id: string
        type: string
        function: { name: string; arguments: string }
      }>,
      modified: false
    }

    if (!functionCallContent) {
      return result
    }

    try {
      // 解析function calls
      const parsedCalls = this.parseFunctionCalls(
        functionCallContent,
        `${fallbackIdPrefix}-${this.provider.id}`
      )

      if (parsedCalls && parsedCalls.length > 0) {
        result.toolCalls = parsedCalls
        result.modified = true
      }

      return result
    } catch (error) {
      console.error('Error handling completed function call:', error)
      return result
    }
  }
}

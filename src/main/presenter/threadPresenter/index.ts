import {
  IThreadPresenter,
  CONVERSATION,
  CONVERSATION_SETTINGS,
  MESSAGE_ROLE,
  MESSAGE_STATUS,
  MESSAGE_METADATA,
  SearchResult,
  MODEL_META,
  ISQLitePresenter,
  IConfigPresenter,
  ILlmProviderPresenter,
  MCPToolResponse
} from '../../../shared/presenter'
import { presenter } from '@/presenter'
import { MessageManager } from './messageManager'
import { eventBus } from '@/eventbus'
import {
  AssistantMessage,
  Message,
  AssistantMessageBlock,
  SearchEngineTemplate,
  UserMessage,
  MessageFile
} from '@shared/chat'
import { approximateTokenSize } from 'tokenx'
import { getModelConfig } from '../llmProviderPresenter/modelConfigs'
import { generateSearchPrompt, SearchManager } from './searchManager'
import { getFileContext } from './fileContext'
import { ContentEnricher } from './contentEnricher'
import { CONVERSATION_EVENTS, STREAM_EVENTS } from '@/events'
import { ChatMessage, ChatMessageContent } from '../llmProviderPresenter/baseProvider'
import { DEFAULT_SETTINGS } from './const'

interface GeneratingMessageState {
  message: AssistantMessage
  conversationId: string
  startTime: number
  firstTokenTime: number | null
  promptTokens: number
  reasoningStartTime: number | null
  reasoningEndTime: number | null
  lastReasoningTime: number | null
  isSearching?: boolean
  isCancelled?: boolean
  totalUsage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

export class ThreadPresenter implements IThreadPresenter {
  private activeConversationId: string | null = null
  private sqlitePresenter: ISQLitePresenter
  private messageManager: MessageManager
  private llmProviderPresenter: ILlmProviderPresenter
  private configPresenter: IConfigPresenter
  private searchManager: SearchManager
  private generatingMessages: Map<string, GeneratingMessageState> = new Map()
  public searchAssistantModel: MODEL_META | null = null
  public searchAssistantProviderId: string | null = null
  private searchingMessages: Set<string> = new Set()

  constructor(
    sqlitePresenter: ISQLitePresenter,
    llmProviderPresenter: ILlmProviderPresenter,
    configPresenter: IConfigPresenter
  ) {
    this.sqlitePresenter = sqlitePresenter
    this.messageManager = new MessageManager(sqlitePresenter)
    this.llmProviderPresenter = llmProviderPresenter
    this.searchManager = new SearchManager()
    this.configPresenter = configPresenter

    // 初始化时处理所有未完成的消息
    this.messageManager.initializeUnfinishedMessages()

    eventBus.on(STREAM_EVENTS.RESPONSE, async (msg) => {
      const {
        eventId,
        content,
        reasoning_content,
        tool_call_id,
        tool_call_name,
        tool_call_params,
        tool_call_response,
        maximum_tool_calls_reached,
        tool_call_server_name,
        tool_call_server_icons,
        tool_call_server_description,
        tool_call_response_raw,
        tool_call,
        totalUsage
      } = msg
      const state = this.generatingMessages.get(eventId)
      if (state) {
        // 记录第一个token的时间
        if (state.firstTokenTime === null && (content || reasoning_content)) {
          state.firstTokenTime = Date.now()
          await this.messageManager.updateMessageMetadata(eventId, {
            firstTokenTime: Date.now() - state.startTime
          })
        }
        if (totalUsage) {
          state.totalUsage = totalUsage
          state.promptTokens = totalUsage.prompt_tokens
        }

        // 处理工具调用达到最大次数的情况
        if (maximum_tool_calls_reached) {
          const lastBlock = state.message.content[state.message.content.length - 1]
          if (lastBlock) {
            lastBlock.status = 'success'
          }
          state.message.content.push({
            type: 'action',
            content: 'common.error.maximumToolCallsReached',
            status: 'success',
            timestamp: Date.now(),
            action_type: 'maximum_tool_calls_reached',
            tool_call: {
              id: tool_call_id,
              name: tool_call_name,
              params: tool_call_params,
              server_name: tool_call_server_name,
              server_icons: tool_call_server_icons,
              server_description: tool_call_server_description
            },
            extra: {
              needContinue: true
            }
          })
          await this.messageManager.editMessage(eventId, JSON.stringify(state.message.content))
          return
        }

        // 处理reasoning_content的时间戳
        if (reasoning_content) {
          if (state.reasoningStartTime === null) {
            state.reasoningStartTime = Date.now()
            await this.messageManager.updateMessageMetadata(eventId, {
              reasoningStartTime: Date.now() - state.startTime
            })
          }
          state.lastReasoningTime = Date.now()
        }

        const lastBlock = state.message.content[state.message.content.length - 1]

        // 检查tool_call_response_raw中是否包含搜索结果
        if (tool_call_response_raw && tool_call === 'end') {
          try {
            // 检查返回的内容中是否有deepchat-webpage类型的资源
            const hasSearchResults = tool_call_response_raw.content?.some(
              (item: { type: string; resource?: { mimeType: string } }) =>
                item?.type === 'resource' &&
                item?.resource?.mimeType === 'application/deepchat-webpage'
            )

            if (hasSearchResults) {
              // 解析搜索结果
              const searchResults = tool_call_response_raw.content
                .filter(
                  (item: {
                    type: string
                    resource?: { mimeType: string; text: string; uri?: string }
                  }) =>
                    item.type === 'resource' &&
                    item.resource?.mimeType === 'application/deepchat-webpage'
                )
                .map((item: { resource: { text: string; uri?: string } }) => {
                  try {
                    const blobContent = JSON.parse(item.resource.text) as {
                      title?: string
                      url?: string
                      content?: string
                      icon?: string
                    }
                    return {
                      title: blobContent.title || '',
                      url: blobContent.url || item.resource.uri || '',
                      content: blobContent.content || '',
                      description: blobContent.content || '',
                      icon: blobContent.icon || ''
                    }
                  } catch (e) {
                    console.error('解析搜索结果失败:', e)
                    return null
                  }
                })
                .filter(Boolean)

              if (searchResults.length > 0) {
                // 检查是否已经存在搜索块
                const existingSearchBlock =
                  state.message.content.length > 0 && state.message.content[0].type === 'search'
                    ? state.message.content[0]
                    : null

                if (existingSearchBlock) {
                  // 如果已经存在搜索块，更新其状态和总数
                  existingSearchBlock.status = 'success'
                  existingSearchBlock.timestamp = Date.now()
                  if (existingSearchBlock.extra) {
                    // 累加搜索结果数量
                    existingSearchBlock.extra.total =
                      (existingSearchBlock.extra.total || 0) + searchResults.length
                  } else {
                    existingSearchBlock.extra = {
                      total: searchResults.length
                    }
                  }
                } else {
                  // 如果不存在搜索块，创建新的并添加到内容的最前面
                  const searchBlock: AssistantMessageBlock = {
                    type: 'search',
                    content: '',
                    status: 'success',
                    timestamp: Date.now(),
                    extra: {
                      total: searchResults.length
                    }
                  }
                  state.message.content.unshift(searchBlock)
                }

                // 保存搜索结果
                for (const result of searchResults) {
                  await this.sqlitePresenter.addMessageAttachment(
                    eventId,
                    'search_result',
                    JSON.stringify(result)
                  )
                }

                await this.messageManager.editMessage(
                  eventId,
                  JSON.stringify(state.message.content)
                )
              }
            }
          } catch (error) {
            console.error('处理搜索结果时出错:', error)
          }
        }

        // 处理工具调用
        if (tool_call) {
          if (tool_call === 'start') {
            // 创建新的工具调用块
            if (lastBlock) {
              lastBlock.status = 'success'
            }

            state.message.content.push({
              type: 'tool_call',
              content: '',
              status: 'loading',
              timestamp: Date.now(),
              tool_call: {
                id: tool_call_id,
                name: tool_call_name,
                params: tool_call_params || '',
                server_name: tool_call_server_name,
                server_icons: tool_call_server_icons,
                server_description: tool_call_server_description
              }
            })
          } else if (tool_call === 'end' || tool_call === 'error') {
            // 查找对应的工具调用块
            const toolCallBlock = state.message.content.find(
              (block) =>
                block.type === 'tool_call' &&
                ((tool_call_id && block.tool_call?.id === tool_call_id) ||
                  block.tool_call?.name === tool_call_name) &&
                block.status === 'loading'
            )

            if (toolCallBlock && toolCallBlock.type === 'tool_call') {
              if (tool_call === 'error') {
                toolCallBlock.status = 'error'
                toolCallBlock.tool_call.response = tool_call_response || '执行失败'
              } else {
                toolCallBlock.status = 'success'
                if (tool_call_response) {
                  toolCallBlock.tool_call.response = tool_call_response
                }
              }
            }
          }
        }
        // 处理内容
        else if (content) {
          // 处理普通内容
          if (lastBlock && lastBlock.type === 'content') {
            lastBlock.content += content
          } else {
            if (lastBlock) {
              lastBlock.status = 'success'
            }
            state.message.content.push({
              type: 'content',
              content: content,
              status: 'loading',
              timestamp: Date.now()
            })
          }
        }

        // 处理推理内容
        if (reasoning_content) {
          if (lastBlock && lastBlock.type === 'reasoning_content') {
            lastBlock.content += reasoning_content
          } else {
            if (lastBlock) {
              lastBlock.status = 'success'
            }
            state.message.content.push({
              type: 'reasoning_content',
              content: reasoning_content,
              status: 'loading',
              timestamp: Date.now()
            })
          }
        }

        // 更新消息内容
        await this.messageManager.editMessage(eventId, JSON.stringify(state.message.content))
      }
    })
    eventBus.on(STREAM_EVENTS.END, async (msg) => {
      const { eventId } = msg
      const state = this.generatingMessages.get(eventId)
      if (state) {
        state.message.content.forEach((block) => {
          block.status = 'success'
        })

        // 计算completion tokens
        let completionTokens = 0
        console.log('state.totalUsage', state.totalUsage)
        if (state.totalUsage) {
          completionTokens = state.totalUsage.completion_tokens
        } else {
          for (const block of state.message.content) {
            if (
              block.type === 'content' ||
              block.type === 'reasoning_content' ||
              block.type === 'tool_call'
            ) {
              completionTokens += approximateTokenSize(block.content)
            }
          }
        }

        // 检查是否有内容块
        const hasContentBlock = state.message.content.some(
          (block) =>
            block.type === 'content' ||
            block.type === 'reasoning_content' ||
            block.type === 'tool_call'
        )

        // 如果没有内容块，添加错误信息
        if (!hasContentBlock) {
          state.message.content.push({
            type: 'error',
            content: 'common.error.noModelResponse',
            status: 'error',
            timestamp: Date.now()
          })
        }

        const totalTokens = state.promptTokens + completionTokens
        const generationTime = Date.now() - (state.firstTokenTime ?? state.startTime)
        const tokensPerSecond = completionTokens / (generationTime / 1000)

        // 如果有reasoning_content，记录结束时间
        const metadata: Partial<MESSAGE_METADATA> = {
          totalTokens,
          inputTokens: state.promptTokens,
          outputTokens: completionTokens,
          generationTime,
          firstTokenTime: state.firstTokenTime ? state.firstTokenTime - state.startTime : 0,
          tokensPerSecond
        }

        if (state.reasoningStartTime !== null && state.lastReasoningTime !== null) {
          metadata.reasoningStartTime = state.reasoningStartTime - state.startTime
          metadata.reasoningEndTime = state.lastReasoningTime - state.startTime
        }

        // 更新消息的usage信息
        await this.messageManager.updateMessageMetadata(eventId, metadata)

        await this.messageManager.updateMessageStatus(eventId, 'sent')
        await this.messageManager.editMessage(eventId, JSON.stringify(state.message.content))
        this.generatingMessages.delete(eventId)
      }
    })
    eventBus.on(STREAM_EVENTS.ERROR, async (msg) => {
      const { eventId, error } = msg
      const state = this.generatingMessages.get(eventId)
      if (state) {
        await this.messageManager.handleMessageError(eventId, String(error))
        this.generatingMessages.delete(eventId)
      }
    })
  }

  setSearchAssistantModel(model: MODEL_META, providerId: string) {
    this.searchAssistantModel = model
    this.searchAssistantProviderId = providerId
  }
  async getSearchEngines(): Promise<SearchEngineTemplate[]> {
    return this.searchManager.getEngines()
  }
  async getActiveSearchEngine(): Promise<SearchEngineTemplate> {
    return this.searchManager.getActiveEngine()
  }
  async setActiveSearchEngine(engineId: string): Promise<void> {
    await this.searchManager.setActiveEngine(engineId)
  }

  /**
   * 测试当前选择的搜索引擎
   * @param query 测试搜索的关键词，默认为"天气"
   * @returns 测试是否成功打开窗口
   */
  async testSearchEngine(query: string = '天气'): Promise<boolean> {
    return await this.searchManager.testSearch(query)
  }

  /**
   * 设置搜索引擎
   * @param engineId 搜索引擎ID
   * @returns 是否设置成功
   */
  async setSearchEngine(engineId: string): Promise<boolean> {
    try {
      return await this.searchManager.setActiveEngine(engineId)
    } catch (error) {
      console.error('设置搜索引擎失败:', error)
      return false
    }
  }

  async renameConversation(conversationId: string, title: string): Promise<CONVERSATION> {
    return await this.sqlitePresenter.renameConversation(conversationId, title)
  }

  async createConversation(
    title: string,
    settings: Partial<CONVERSATION_SETTINGS> = {}
  ): Promise<string> {
    console.log('createConversation', title, settings)
    const latestConversation = await this.getLatestConversation()

    if (latestConversation) {
      const { list: messages } = await this.getMessages(latestConversation.id, 1, 1)
      if (messages.length === 0) {
        await this.setActiveConversation(latestConversation.id)
        return latestConversation.id
      }
    }
    let defaultSettings = DEFAULT_SETTINGS
    if (latestConversation?.settings) {
      defaultSettings = { ...latestConversation.settings }
      defaultSettings.systemPrompt = ''
    }
    Object.keys(settings).forEach((key) => {
      if (settings[key] === undefined || settings[key] === null || settings[key] === '') {
        delete settings[key]
      }
    })
    const mergedSettings = { ...defaultSettings, ...settings }
    const defaultModelsSettings = getModelConfig(mergedSettings.modelId)
    if (defaultModelsSettings) {
      mergedSettings.maxTokens = defaultModelsSettings.maxTokens
      mergedSettings.contextLength = defaultModelsSettings.contextLength
      mergedSettings.temperature = defaultModelsSettings.temperature
    }
    if (settings.artifacts) {
      mergedSettings.artifacts = settings.artifacts
    }
    if (settings.maxTokens) {
      mergedSettings.maxTokens = settings.maxTokens
    }
    if (settings.temperature) {
      mergedSettings.temperature = settings.temperature
    }
    if (settings.contextLength) {
      mergedSettings.contextLength = settings.contextLength
    }
    if (settings.systemPrompt) {
      mergedSettings.systemPrompt = settings.systemPrompt
    }
    const conversationId = await this.sqlitePresenter.createConversation(title, mergedSettings)
    await this.setActiveConversation(conversationId)
    return conversationId
  }

  async deleteConversation(conversationId: string): Promise<void> {
    await this.sqlitePresenter.deleteConversation(conversationId)
    if (this.activeConversationId === conversationId) {
      this.activeConversationId = null
    }
  }

  async getConversation(conversationId: string): Promise<CONVERSATION> {
    return await this.sqlitePresenter.getConversation(conversationId)
  }

  async updateConversationTitle(conversationId: string, title: string): Promise<void> {
    await this.sqlitePresenter.updateConversation(conversationId, { title })
  }

  async updateConversationSettings(
    conversationId: string,
    settings: Partial<CONVERSATION_SETTINGS>
  ): Promise<void> {
    const conversation = await this.getConversation(conversationId)
    const mergedSettings = { ...conversation.settings }
    for (const key in settings) {
      if (settings[key] !== undefined) {
        mergedSettings[key] = settings[key]
      }
    }
    console.log('updateConversationSettings', mergedSettings)
    // 检查是否有 modelId 的变化
    if (settings.modelId && settings.modelId !== conversation.settings.modelId) {
      // 获取模型配置
      const modelConfig = getModelConfig(mergedSettings.modelId)
      console.log('check model default config', modelConfig)
      if (modelConfig) {
        // 如果当前设置小于推荐值，则使用推荐值
        mergedSettings.maxTokens = modelConfig.maxTokens
        mergedSettings.contextLength = modelConfig.contextLength
      }
    }

    await this.sqlitePresenter.updateConversation(conversationId, { settings: mergedSettings })
  }

  async getConversationList(
    page: number,
    pageSize: number
  ): Promise<{ total: number; list: CONVERSATION[] }> {
    return await this.sqlitePresenter.getConversationList(page, pageSize)
  }

  async setActiveConversation(conversationId: string): Promise<void> {
    const conversation = await this.getConversation(conversationId)
    if (conversation) {
      this.activeConversationId = conversationId
      eventBus.emit(CONVERSATION_EVENTS.ACTIVATED, { conversationId })
    } else {
      throw new Error(`Conversation ${conversationId} not found`)
    }
  }

  async getActiveConversation(): Promise<CONVERSATION | null> {
    if (!this.activeConversationId) {
      return null
    }
    return this.getConversation(this.activeConversationId)
  }

  async getMessages(
    conversationId: string,
    page: number,
    pageSize: number
  ): Promise<{ total: number; list: Message[] }> {
    return await this.messageManager.getMessageThread(conversationId, page, pageSize)
  }

  async getContextMessages(conversationId: string): Promise<Message[]> {
    const conversation = await this.getConversation(conversationId)
    // 计算需要获取的消息数量（假设每条消息平均300字）
    let messageCount = Math.ceil(conversation.settings.contextLength / 300)
    if (messageCount < 2) {
      messageCount = 2
    }
    const messages = await this.messageManager.getContextMessages(conversationId, messageCount)

    // 确保消息列表以用户消息开始
    while (messages.length > 0 && messages[0].role !== 'user') {
      messages.shift()
    }

    return messages
  }

  async clearContext(conversationId: string): Promise<void> {
    await this.sqlitePresenter.runTransaction(async () => {
      const conversation = await this.getConversation(conversationId)
      if (conversation) {
        await this.sqlitePresenter.deleteAllMessages()
      }
    })
  }
  /**
   *
   * @param conversationId
   * @param content
   * @param role
   * @returns 如果是user的消息，返回ai生成的message，否则返回空
   */
  async sendMessage(
    conversationId: string,
    content: string,
    role: MESSAGE_ROLE
  ): Promise<AssistantMessage | null> {
    const conversation = await this.getConversation(conversationId)
    const { providerId, modelId } = conversation.settings
    console.log('sendMessage', conversation)
    const message = await this.messageManager.sendMessage(
      conversationId,
      content,
      role,
      '',
      false,
      {
        totalTokens: 0,
        generationTime: 0,
        firstTokenTime: 0,
        tokensPerSecond: 0,
        inputTokens: 0,
        outputTokens: 0,
        model: modelId,
        provider: providerId
      }
    )
    if (role === 'user') {
      const assistantMessage = await this.generateAIResponse(conversationId, message.id)
      this.generatingMessages.set(assistantMessage.id, {
        message: assistantMessage,
        conversationId,
        startTime: Date.now(),
        firstTokenTime: null,
        promptTokens: 0,
        reasoningStartTime: null,
        reasoningEndTime: null,
        lastReasoningTime: null
      })

      // 检查是否是新会话的第一条消息
      const { list: messages } = await this.getMessages(conversationId, 1, 2)
      if (messages.length === 1) {
        // 更新会话的 is_new 标志位
        await this.sqlitePresenter.updateConversation(conversationId, {
          is_new: 0,
          updatedAt: Date.now()
        })
      } else {
        await this.sqlitePresenter.updateConversation(conversationId, {
          updatedAt: Date.now()
        })
      }

      return assistantMessage
    }

    return null
  }

  private async generateAIResponse(conversationId: string, userMessageId: string) {
    try {
      const triggerMessage = await this.messageManager.getMessage(userMessageId)
      if (!triggerMessage) {
        throw new Error('找不到触发消息')
      }

      await this.messageManager.updateMessageStatus(userMessageId, 'sent')

      const conversation = await this.getConversation(conversationId)
      const { providerId, modelId } = conversation.settings
      const assistantMessage = (await this.messageManager.sendMessage(
        conversationId,
        JSON.stringify([]),
        'assistant',
        userMessageId,
        false,
        {
          totalTokens: 0,
          generationTime: 0,
          firstTokenTime: 0,
          tokensPerSecond: 0,
          inputTokens: 0,
          outputTokens: 0,
          model: modelId,
          provider: providerId
        }
      )) as AssistantMessage

      this.generatingMessages.set(assistantMessage.id, {
        message: assistantMessage,
        conversationId,
        startTime: Date.now(),
        firstTokenTime: null,
        promptTokens: 0,
        reasoningStartTime: null,
        reasoningEndTime: null,
        lastReasoningTime: null
      })

      return assistantMessage
    } catch (error) {
      await this.messageManager.updateMessageStatus(userMessageId, 'error')
      console.error('生成 AI 响应失败:', error)
      throw error
    }
  }

  async getMessage(messageId: string): Promise<Message> {
    return await this.messageManager.getMessage(messageId)
  }

  /**
   * 获取指定消息之前的历史消息
   * @param messageId 消息ID
   * @param limit 限制返回的消息数量
   * @returns 历史消息列表，按时间正序排列
   */
  private async getMessageHistory(messageId: string, limit: number = 100): Promise<Message[]> {
    const message = await this.messageManager.getMessage(messageId)
    if (!message) {
      throw new Error('找不到指定的消息')
    }

    const { list: messages } = await this.messageManager.getMessageThread(
      message.conversationId,
      1,
      limit * 2
    )

    // 找到目标消息在列表中的位置
    const targetIndex = messages.findIndex((msg) => msg.id === messageId)
    if (targetIndex === -1) {
      return [message]
    }

    // 返回目标消息之前的消息（包括目标消息）
    return messages.slice(Math.max(0, targetIndex - limit + 1), targetIndex + 1)
  }

  private async rewriteUserSearchQuery(
    query: string,
    contextMessages: string,
    conversationId: string,
    searchEngine: string
  ): Promise<string> {
    const rewritePrompt = `
    你是一个搜索优化专家。基于以下内容，生成一个优化的搜索查询：

    当前时间：${new Date().toISOString()}
    搜索引擎：${searchEngine}

    请遵循以下规则重写搜索查询：
    1. 根据用户的问题和上下文，重写应该进行搜索的关键词
    2. 如果需要使用时间，则根据当前时间给出需要查询的具体时间日期信息
    3. 编程相关查询：
        - 加上编程语言或框架名称
        - 指定错误代码或具体版本号
    4. 保持查询简洁，通常不超过3个关键词, 最多不要超过5个关键词，参考当前搜索引擎的查询习惯书写关键字
    5. 默认保留用户的问题的语言，如果用户的问题是中文，则返回中文，如果用户的问题是英文，则返回英文，其他语言也一样
    6. 如果用户的问题是关于某个具体的问题，则直接返回用户的问题，不要进行任何重写
    7. 如果是你不了解的搜索引擎, 则直接返回用户的问题

    直接返回优化后的搜索词，不要有任何额外说明。
    如下是之前对话的上下文：
    <context_messages>
    ${contextMessages}
    </context_messages>
    如下是用户的问题：
    <user_question>
    ${query}
    </user_question>
    `
    const conversation = await this.getConversation(conversationId)
    if (!conversation) {
      return query
    }
    console.log('rewriteUserSearchQuery', query, contextMessages, conversation.id)
    const { providerId, modelId } = conversation.settings
    try {
      const rewrittenQuery = await this.llmProviderPresenter.generateCompletion(
        this.searchAssistantProviderId || providerId,
        [
          {
            role: 'user',
            content: rewritePrompt
          }
        ],
        this.searchAssistantModel?.id || modelId
      )
      return rewrittenQuery.trim() || query
    } catch (error) {
      console.error('重写搜索查询失败:', error)
      return query
    }
  }

  /**
   * 检查消息是否已被取消
   * @param messageId 消息ID
   * @returns 是否已被取消
   */
  private isMessageCancelled(messageId: string): boolean {
    const state = this.generatingMessages.get(messageId)
    return !state || state.isCancelled === true
  }

  /**
   * 如果消息已被取消，则抛出错误
   * @param messageId 消息ID
   */
  private throwIfCancelled(messageId: string): void {
    if (this.isMessageCancelled(messageId)) {
      throw new Error('common.error.userCanceledGeneration')
    }
  }

  private async startStreamSearch(
    conversationId: string,
    messageId: string,
    query: string
  ): Promise<SearchResult[]> {
    const state = this.generatingMessages.get(messageId)
    if (!state) {
      throw new Error('找不到生成状态')
    }

    // 检查是否已被取消
    this.throwIfCancelled(messageId)

    // 添加搜索加载状态
    const searchBlock: AssistantMessageBlock = {
      type: 'search',
      content: '',
      status: 'loading',
      timestamp: Date.now(),
      extra: {
        total: 0
      }
    }
    state.message.content.unshift(searchBlock)
    await this.messageManager.editMessage(messageId, JSON.stringify(state.message.content))
    // 标记消息为搜索状态
    state.isSearching = true
    this.searchingMessages.add(messageId)
    try {
      // 获取历史消息用于上下文
      const contextMessages = await this.getContextMessages(conversationId)
      // 检查是否已被取消
      this.throwIfCancelled(messageId)

      const formattedContext = contextMessages
        .map((msg) => {
          if (msg.role === 'user') {
            return `user: ${msg.content.text}${getFileContext(msg.content.files)}`
          } else if (msg.role === 'assistant') {
            let finanContent = 'assistant: '
            msg.content.forEach((block) => {
              if (block.type === 'content') {
                finanContent += block.content + '\n'
              }
              if (block.type === 'search') {
                finanContent += `search-result: ${JSON.stringify(block.extra)}`
              }
              if (block.type === 'tool_call') {
                finanContent += `tool_call: ${JSON.stringify(block.tool_call)}`
              }
            })
            return finanContent
          } else {
            return JSON.stringify(msg.content)
          }
        })
        .join('\n')
      // 检查是否已被取消
      this.throwIfCancelled(messageId)

      searchBlock.status = 'optimizing'
      await this.messageManager.editMessage(messageId, JSON.stringify(state.message.content))
      console.log('optimizing')
      // 重写搜索查询
      const optimizedQuery = await this.rewriteUserSearchQuery(
        query,
        formattedContext,
        conversationId,
        this.searchManager.getActiveEngine().name
      ).catch((err) => {
        console.error('重写搜索查询失败:', err)
        return query
      })
      // 检查是否已被取消
      this.throwIfCancelled(messageId)

      // 更新搜索状态为阅读中
      searchBlock.status = 'reading'
      await this.messageManager.editMessage(messageId, JSON.stringify(state.message.content))

      // 开始搜索
      const results = await this.searchManager.search(conversationId, optimizedQuery)

      // 检查是否已被取消
      this.throwIfCancelled(messageId)

      searchBlock.status = 'loading'
      searchBlock.extra = {
        total: results.length
      }
      await this.messageManager.editMessage(messageId, JSON.stringify(state.message.content))

      // 保存搜索结果
      for (const result of results) {
        // 检查是否已被取消
        this.throwIfCancelled(messageId)

        await this.sqlitePresenter.addMessageAttachment(
          messageId,
          'search_result',
          JSON.stringify({
            title: result.title,
            url: result.url,
            content: result.content || '',
            description: result.description || '',
            icon: result.icon || ''
          })
        )
      }

      // 检查是否已被取消
      this.throwIfCancelled(messageId)

      // 更新搜索状态为成功
      searchBlock.status = 'success'
      await this.messageManager.editMessage(messageId, JSON.stringify(state.message.content))

      // 标记消息搜索完成
      state.isSearching = false
      this.searchingMessages.delete(messageId)

      return results
    } catch (error) {
      // 标记消息搜索完成
      state.isSearching = false
      this.searchingMessages.delete(messageId)

      // 更新搜索状态为错误
      searchBlock.status = 'error'
      searchBlock.content = String(error)
      await this.messageManager.editMessage(messageId, JSON.stringify(state.message.content))

      if (String(error).includes('userCanceledGeneration')) {
        // 如果是取消操作导致的错误，确保搜索窗口关闭
        this.searchManager.stopSearch(state.conversationId)
      }

      return []
    }
  }

  private async getLastUserMessage(conversationId: string): Promise<Message | null> {
    return await this.messageManager.getLastUserMessage(conversationId)
  }

  // 从数据库获取搜索结果
  async getSearchResults(messageId: string): Promise<SearchResult[]> {
    const results = await this.sqlitePresenter.getMessageAttachments(messageId, 'search_result')
    return results.map((result) => JSON.parse(result.content) as SearchResult) ?? []
  }

  async startStreamCompletion(conversationId: string, queryMsgId?: string) {
    const state = this.findGeneratingState(conversationId)
    if (!state) {
      console.warn('未找到状态，conversationId:', conversationId)
      return
    }

    try {
      // 设置消息未取消
      state.isCancelled = false

      // 1. 获取上下文信息
      const { conversation, userMessage, contextMessages } = await this.prepareConversationContext(
        conversationId,
        queryMsgId
      )

      const { providerId, modelId, temperature, maxTokens } = conversation.settings
      const modelConfig = getModelConfig(modelId)
      const { vision } = modelConfig || {}
      // 检查是否已被取消
      this.throwIfCancelled(state.message.id)

      // 2. 处理用户消息内容
      const { userContent, urlResults, imageFiles } =
        await this.processUserMessageContent(userMessage)

      // 检查是否已被取消
      this.throwIfCancelled(state.message.id)

      // 3. 处理搜索（如果需要）
      let searchResults: SearchResult[] | null = null
      if (userMessage.content.search) {
        try {
          searchResults = await this.startStreamSearch(
            conversationId,
            state.message.id,
            userContent
          )
          // 检查是否已被取消
          this.throwIfCancelled(state.message.id)
        } catch (error) {
          // 如果是用户取消导致的错误，不继续后续步骤
          if (String(error).includes('userCanceledGeneration')) {
            return
          }
          // 其他错误继续处理（搜索失败不应影响生成）
          console.error('搜索过程中出错:', error)
        }
      }

      // 检查是否已被取消
      this.throwIfCancelled(state.message.id)

      // 4. 准备提示内容
      const { finalContent, promptTokens } = this.preparePromptContent(
        conversation,
        userContent,
        contextMessages,
        searchResults,
        urlResults,
        userMessage,
        vision ? imageFiles : []
      )

      // 检查是否已被取消
      this.throwIfCancelled(state.message.id)

      // 5. 更新生成状态
      await this.updateGenerationState(state, promptTokens)

      // 检查是否已被取消
      this.throwIfCancelled(state.message.id)

      // 6. 启动流式生成

      await this.llmProviderPresenter.startStreamCompletion(
        providerId,
        finalContent,
        modelId,
        state.message.id,
        temperature,
        maxTokens
      )
    } catch (error) {
      // 检查是否是取消错误
      if (String(error).includes('userCanceledGeneration')) {
        console.log('消息生成已被用户取消')
        return
      }

      console.error('流式生成过程中出错:', error)
      await this.messageManager.handleMessageError(state.message.id, String(error))
      throw error
    }
  }
  async continueStreamCompletion(conversationId: string, queryMsgId: string) {
    const state = this.findGeneratingState(conversationId)
    if (!state) {
      console.warn('未找到状态，conversationId:', conversationId)
      return
    }

    try {
      // 设置消息未取消
      state.isCancelled = false

      // 1. 获取需要继续的消息
      const queryMessage = await this.messageManager.getMessage(queryMsgId)
      if (!queryMessage) {
        throw new Error('找不到指定的消息')
      }

      // 2. 解析最后一个 action block
      const content: AssistantMessageBlock[] = queryMessage.content
      const lastActionBlock = content.filter((block) => block.type === 'action').pop()

      if (!lastActionBlock || lastActionBlock.type !== 'action') {
        throw new Error('找不到最后的 action block')
      }

      // 3. 检查是否是 maximum_tool_calls_reached
      let toolCallResponse: { content: string; rawData: MCPToolResponse } | null = null
      const toolCall = lastActionBlock.tool_call

      if (lastActionBlock.action_type === 'maximum_tool_calls_reached' && toolCall) {
        // 设置 needContinue 为 0（false）
        if (lastActionBlock.extra) {
          lastActionBlock.extra = {
            ...lastActionBlock.extra,
            needContinue: false
          }
        }
        await this.messageManager.editMessage(queryMsgId, JSON.stringify(content))

        // 4. 检查工具调用参数
        if (!toolCall.id || !toolCall.name || !toolCall.params) {
          throw new Error('工具调用参数不完整')
        }

        // 5. 调用工具获取结果
        toolCallResponse = await presenter.mcpPresenter.callTool({
          id: toolCall.id,
          type: 'function',
          function: {
            name: toolCall.name,
            arguments: toolCall.params
          },
          server: {
            name: toolCall.server_name || '',
            icons: toolCall.server_icons || '',
            description: toolCall.server_description || ''
          }
        })
      }

      // 检查是否已被取消
      this.throwIfCancelled(state.message.id)

      // 6. 获取上下文信息
      const { conversation, contextMessages, userMessage } = await this.prepareConversationContext(
        conversationId,
        state.message.id
      )

      // 检查是否已被取消
      this.throwIfCancelled(state.message.id)

      // 7. 准备提示内容
      const { finalContent, promptTokens } = this.preparePromptContent(
        conversation,
        'continue',
        contextMessages,
        null, // 不进行搜索
        [], // 没有 URL 结果
        userMessage,
        [] // 没有图片文件
      )

      // 8. 更新生成状态
      await this.updateGenerationState(state, promptTokens)

      // 9. 如果有工具调用结果，发送工具调用结果事件
      if (toolCallResponse && toolCall) {
        // console.log('toolCallResponse', toolCallResponse)
        eventBus.emit(STREAM_EVENTS.RESPONSE, {
          eventId: state.message.id,
          content: '',
          tool_call: 'start',
          tool_call_id: toolCall.id,
          tool_call_name: toolCall.name,
          tool_call_params: toolCall.params,
          tool_call_response: toolCallResponse.content,
          tool_call_server_name: toolCall.server_name,
          tool_call_server_icons: toolCall.server_icons,
          tool_call_server_description: toolCall.server_description
        })

        eventBus.emit(STREAM_EVENTS.RESPONSE, {
          eventId: state.message.id,
          content: '',
          tool_call: 'end',
          tool_call_id: toolCall.id,
          tool_call_response: toolCallResponse.content,
          tool_call_name: toolCall.name,
          tool_call_params: toolCall.params,
          tool_call_server_name: toolCall.server_name,
          tool_call_server_icons: toolCall.server_icons,
          tool_call_server_description: toolCall.server_description,
          tool_call_response_raw: toolCallResponse.rawData
        })
      }

      // 10. 启动流式生成
      const { providerId, modelId, temperature, maxTokens } = conversation.settings
      await this.llmProviderPresenter.startStreamCompletion(
        providerId,
        finalContent,
        modelId,
        state.message.id,
        temperature,
        maxTokens
      )
    } catch (error) {
      // 检查是否是取消错误
      if (String(error).includes('userCanceledGeneration')) {
        console.log('消息生成已被用户取消')
        return
      }

      console.error('继续生成过程中出错:', error)
      await this.messageManager.handleMessageError(state.message.id, String(error))
      throw error
    }
  }

  // 查找特定会话的生成状态
  private findGeneratingState(conversationId: string): GeneratingMessageState | null {
    return (
      Array.from(this.generatingMessages.values()).find(
        (state) => state.conversationId === conversationId
      ) || null
    )
  }

  // 准备会话上下文
  private async prepareConversationContext(
    conversationId: string,
    queryMsgId?: string
  ): Promise<{
    conversation: CONVERSATION
    userMessage: Message
    contextMessages: Message[]
  }> {
    const conversation = await this.getConversation(conversationId)
    let contextMessages: Message[] = []
    let userMessage: Message | null = null
    if (queryMsgId) {
      // 处理指定消息ID的情况
      const queryMessage = await this.getMessage(queryMsgId)
      if (!queryMessage || !queryMessage.parentId) {
        throw new Error('找不到指定的消息')
      }
      userMessage = await this.getMessage(queryMessage.parentId)
      if (!userMessage) {
        throw new Error('找不到触发消息')
      }
      contextMessages = await this.getMessageHistory(
        userMessage.id,
        conversation.settings.contextLength
      )
    } else {
      // 获取最新的用户消息
      userMessage = await this.getLastUserMessage(conversationId)
      if (!userMessage) {
        throw new Error('找不到用户消息')
      }
      contextMessages = await this.getContextMessages(conversationId)
    }
    // 任何情况都使用最新配置
    const webSearchEnabled = this.configPresenter.getSetting('input_webSearch')
    const thinkEnabled = this.configPresenter.getSetting('input_deepThinking')
    userMessage.content.search = webSearchEnabled
    userMessage.content.think = thinkEnabled
    return { conversation, userMessage, contextMessages }
  }

  // 处理用户消息内容
  private async processUserMessageContent(userMessage: UserMessage): Promise<{
    userContent: string
    urlResults: SearchResult[]
    imageFiles: MessageFile[] // 图片文件列表
  }> {
    // 处理文本内容
    const userContent = `
      ${userMessage.content.text}
      ${getFileContext(userMessage.content.files)}
    `

    // 从用户消息中提取并丰富URL内容
    const urlResults = await ContentEnricher.extractAndEnrichUrls(userMessage.content.text)

    // 提取图片文件

    const imageFiles =
      userMessage.content.files?.filter((file) => {
        // 根据文件类型、MIME类型或扩展名过滤图片文件
        const isImage =
          file.mimeType.startsWith('data:image') ||
          /\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i.test(file.name || '')
        return isImage
      }) || []

    return { userContent, urlResults, imageFiles }
  }

  // 准备提示内容
  private preparePromptContent(
    conversation: CONVERSATION,
    userContent: string,
    contextMessages: Message[],
    searchResults: SearchResult[] | null,
    urlResults: SearchResult[],
    userMessage: Message,
    imageFiles: MessageFile[]
  ): {
    finalContent: ChatMessage[]
    promptTokens: number
  } {
    const { systemPrompt, contextLength, artifacts } = conversation.settings

    const searchPrompt = searchResults ? generateSearchPrompt(userContent, searchResults) : ''
    const enrichedUserMessage =
      urlResults.length > 0
        ? '\n\n' + ContentEnricher.enrichUserMessageWithUrlContent(userContent, urlResults)
        : ''

    // 计算token数量
    const searchPromptTokens = searchPrompt ? approximateTokenSize(searchPrompt ?? '') : 0
    const systemPromptTokens = systemPrompt ? approximateTokenSize(systemPrompt ?? '') : 0
    const userMessageTokens = approximateTokenSize(userContent + enrichedUserMessage)

    // 计算剩余可用的上下文长度
    const reservedTokens = searchPromptTokens + systemPromptTokens + userMessageTokens
    const remainingContextLength = contextLength - reservedTokens

    // 选择合适的上下文消息
    const selectedContextMessages = this.selectContextMessages(
      contextMessages,
      userMessage,
      remainingContextLength
    )

    // 格式化消息
    const formattedMessages = this.formatMessagesForCompletion(
      selectedContextMessages,
      systemPrompt,
      artifacts,
      searchPrompt,
      userContent,
      enrichedUserMessage,
      imageFiles
    )

    // 合并连续的相同角色消息
    const mergedMessages = this.mergeConsecutiveMessages(formattedMessages)

    // 计算prompt tokens
    let promptTokens = 0
    for (const msg of mergedMessages) {
      if (typeof msg.content === 'string') {
        promptTokens += approximateTokenSize(msg.content)
      } else {
        promptTokens +=
          approximateTokenSize(msg.content.map((item) => item.text).join('')) +
          imageFiles.reduce((acc, file) => acc + file.token, 0)
      }
    }

    return { finalContent: mergedMessages, promptTokens }
  }

  // 选择上下文消息
  private selectContextMessages(
    contextMessages: Message[],
    userMessage: Message,
    remainingContextLength: number
  ): Message[] {
    if (remainingContextLength <= 0) {
      return []
    }

    const messages = contextMessages.filter((msg) => msg.id !== userMessage?.id).reverse()

    let currentLength = 0
    const selectedMessages: Message[] = []

    for (const msg of messages) {
      const msgTokens = approximateTokenSize(
        msg.role === 'user'
          ? `${msg.content.text}${getFileContext(msg.content.files)}`
          : JSON.stringify(msg.content)
      )

      if (currentLength + msgTokens <= remainingContextLength) {
        selectedMessages.unshift(msg)
        currentLength += msgTokens
      } else {
        break
      }
    }

    return selectedMessages
  }

  // 格式化消息用于完成
  private formatMessagesForCompletion(
    contextMessages: Message[],
    systemPrompt: string,
    artifacts: number,
    searchPrompt: string,
    userContent: string,
    enrichedUserMessage: string,
    imageFiles: MessageFile[]
  ): ChatMessage[] {
    const formattedMessages: ChatMessage[] = []

    // 添加系统提示
    if (systemPrompt) {
      // formattedMessages.push(...this.addSystemPrompt(formattedMessages, systemPrompt, artifacts))
      formattedMessages.push({
        role: 'system',
        content: systemPrompt
      })
      // console.log('-------------> system prompt \n', systemPrompt, artifacts, formattedMessages)
    }

    // 添加上下文消息
    formattedMessages.push(...this.addContextMessages(formattedMessages, contextMessages))

    // 添加当前用户消息
    let finalContent = searchPrompt || userContent

    if (enrichedUserMessage) {
      finalContent += enrichedUserMessage
    }

    if (artifacts === 1) {
      // formattedMessages.push({
      //   role: 'user',
      //   content: ARTIFACTS_PROMPT
      // })
      console.log('artifacts目前由mcp提供，此处为兼容性保留')
    }

    if (imageFiles.length > 0) {
      formattedMessages.push(this.addImageFiles(finalContent, imageFiles))
    } else {
      formattedMessages.push({
        role: 'user',
        content: finalContent.trim()
      })
    }

    return formattedMessages
  }

  private addImageFiles(finalContent: string, imageFiles: MessageFile[]): ChatMessage {
    return {
      role: 'user',
      content: [
        ...imageFiles.map((file) => ({
          type: 'image_url' as const,
          image_url: { url: file.content, detail: 'auto' as const }
        })),
        { type: 'text' as const, text: finalContent.trim() }
      ]
    }
  }

  // 添加上下文消息
  private addContextMessages(
    formattedMessages: ChatMessage[],
    contextMessages: Message[]
  ): ChatMessage[] {
    const resultMessages = [...formattedMessages]
    contextMessages.forEach((msg) => {
      const content =
        msg.role === 'user'
          ? `${msg.content.text}${getFileContext(msg.content.files)}`
          : msg.content
              .filter((block) => block.type === 'content' || block.type === 'tool_call')
              .map((block) => block.content)
              .join('\n')

      if (msg.role === 'assistant' && !content) {
        return // 如果是assistant且content为空，则不加入
      }

      resultMessages.push({
        role: msg.role as 'user' | 'assistant',
        content
      })
    })
    return resultMessages
  }

  // 合并连续的相同角色消息
  private mergeConsecutiveMessages(messages: ChatMessage[]): ChatMessage[] {
    const mergedMessages: ChatMessage[] = []

    for (let i = 0; i < messages.length; i++) {
      const currentMessage = messages[i]
      if (
        mergedMessages.length > 0 &&
        mergedMessages[mergedMessages.length - 1].role === currentMessage.role
      ) {
        mergedMessages[mergedMessages.length - 1].content = this.mergeMessageContent(
          currentMessage.content,
          mergedMessages[mergedMessages.length - 1].content
        )
      } else {
        mergedMessages.push({ ...currentMessage })
      }
    }

    return mergedMessages
  }

  private mergeMessageContent(
    currentMessageContent: string | ChatMessageContent[],
    previousMessageContent: string | ChatMessageContent[]
  ) {
    let mergedContent: ChatMessageContent[] | string
    if (Array.isArray(currentMessageContent)) {
      if (Array.isArray(previousMessageContent)) {
        mergedContent = [
          ...(previousMessageContent.filter(
            (item) => item.type !== 'text'
          ) as ChatMessageContent[]),
          {
            type: 'text',
            text: `${previousMessageContent
              .filter((item) => item.type === 'text')
              .map((item) => item.text)
              .join('\n')}\n${currentMessageContent
              .filter((item) => item.type === 'text')
              .map((item) => item.text)
              .join('\n')}`
          },
          ...(currentMessageContent.filter((item) => item.type !== 'text') as ChatMessageContent[])
        ] as ChatMessageContent[]
      } else {
        mergedContent = [
          {
            type: 'text',
            text: `${previousMessageContent}\n${currentMessageContent
              .filter((item) => item.type === 'text')
              .map((item) => item.text)
              .join('\n')}`
          },
          ...(currentMessageContent.filter((item) => item.type !== 'text') as ChatMessageContent[])
        ]
      }
    } else {
      if (Array.isArray(previousMessageContent)) {
        mergedContent = [
          ...(previousMessageContent.filter(
            (item) => item.type !== 'text'
          ) as ChatMessageContent[]),
          {
            type: 'text',
            text: `${previousMessageContent
              .filter((item) => item.type == 'text')
              .map((item) => item.text)
              .join(`\n`)}\n${currentMessageContent}`
          }
        ] as ChatMessageContent[]
      } else {
        mergedContent = `${previousMessageContent}\n${currentMessageContent}`
      }
    }
    return mergedContent
  }

  // 更新生成状态
  private async updateGenerationState(
    state: GeneratingMessageState,
    promptTokens: number
  ): Promise<void> {
    // 更新生成状态
    this.generatingMessages.set(state.message.id, {
      ...state,
      startTime: Date.now(),
      firstTokenTime: null,
      promptTokens
    })

    // 更新消息的usage信息
    await this.messageManager.updateMessageMetadata(state.message.id, {
      totalTokens: promptTokens,
      generationTime: 0,
      firstTokenTime: 0,
      tokensPerSecond: 0
    })
  }

  async editMessage(messageId: string, content: string): Promise<Message> {
    return await this.messageManager.editMessage(messageId, content)
  }

  async deleteMessage(messageId: string): Promise<void> {
    await this.messageManager.deleteMessage(messageId)
  }

  async retryMessage(messageId: string): Promise<AssistantMessage> {
    const message = await this.messageManager.getMessage(messageId)
    if (message.role !== 'assistant') {
      throw new Error('只能重试助手消息')
    }

    const userMessage = await this.messageManager.getMessage(message.parentId || '')
    if (!userMessage) {
      throw new Error('找不到对应的用户消息')
    }
    const conversation = await this.getConversation(message.conversationId)
    const { providerId, modelId } = conversation.settings
    const assistantMessage = await this.messageManager.retryMessage(messageId, {
      totalTokens: 0,
      generationTime: 0,
      firstTokenTime: 0,
      tokensPerSecond: 0,
      inputTokens: 0,
      outputTokens: 0,
      model: modelId,
      provider: providerId
    })

    // 初始化生成状态
    this.generatingMessages.set(assistantMessage.id, {
      message: assistantMessage,
      conversationId: message.conversationId,
      startTime: Date.now(),
      firstTokenTime: null,
      promptTokens: 0,
      reasoningStartTime: null,
      reasoningEndTime: null,
      lastReasoningTime: null
    })

    return assistantMessage
  }

  async getMessageVariants(messageId: string): Promise<Message[]> {
    return await this.messageManager.getMessageVariants(messageId)
  }

  async updateMessageStatus(messageId: string, status: MESSAGE_STATUS): Promise<void> {
    await this.messageManager.updateMessageStatus(messageId, status)
  }

  async updateMessageMetadata(
    messageId: string,
    metadata: Partial<MESSAGE_METADATA>
  ): Promise<void> {
    await this.messageManager.updateMessageMetadata(messageId, metadata)
  }

  async markMessageAsContextEdge(messageId: string, isEdge: boolean): Promise<void> {
    await this.messageManager.markMessageAsContextEdge(messageId, isEdge)
  }

  async getActiveConversationId(): Promise<string | null> {
    return this.activeConversationId
  }

  private async getLatestConversation(): Promise<CONVERSATION | null> {
    const result = await this.getConversationList(1, 1)
    return result.list[0] || null
  }

  getGeneratingMessageState(messageId: string): GeneratingMessageState | null {
    return this.generatingMessages.get(messageId) || null
  }

  getConversationGeneratingMessages(conversationId: string): AssistantMessage[] {
    return Array.from(this.generatingMessages.values())
      .filter((state) => state.conversationId === conversationId)
      .map((state) => state.message)
  }

  async stopMessageGeneration(messageId: string): Promise<void> {
    const state = this.generatingMessages.get(messageId)
    if (state) {
      // 设置统一的取消标志
      state.isCancelled = true

      // 标记消息不再处于搜索状态
      if (state.isSearching) {
        this.searchingMessages.delete(messageId)

        // 停止搜索窗口
        await this.searchManager.stopSearch(state.conversationId)
      }

      // 添加用户取消的消息块
      state.message.content.forEach((block) => {
        if (
          block.status === 'loading' ||
          block.status === 'reading' ||
          block.status === 'optimizing'
        ) {
          block.status = 'success'
        }
      })
      state.message.content.push({
        type: 'error',
        content: 'common.error.userCanceledGeneration',
        status: 'cancel',
        timestamp: Date.now()
      })

      // 更新消息状态和内容
      await this.messageManager.updateMessageStatus(messageId, 'error')
      await this.messageManager.editMessage(messageId, JSON.stringify(state.message.content))

      // 停止流式生成
      await this.llmProviderPresenter.stopStream(messageId)

      // 清理生成状态
      this.generatingMessages.delete(messageId)
    }
  }

  async stopConversationGeneration(conversationId: string): Promise<void> {
    const messageIds = Array.from(this.generatingMessages.entries())
      .filter(([, state]) => state.conversationId === conversationId)
      .map(([messageId]) => messageId)

    await Promise.all(messageIds.map((messageId) => this.stopMessageGeneration(messageId)))
  }

  async summaryTitles(providerId?: string, modelId?: string): Promise<string> {
    const conversation = await this.getActiveConversation()
    if (!conversation) {
      throw new Error('找不到当前对话')
    }
    let summaryProviderId = providerId
    if (!modelId || !providerId) {
      modelId = this.searchAssistantModel?.id
      summaryProviderId = this.searchAssistantProviderId || conversation.settings.providerId
    }

    const messages = await this.getContextMessages(conversation.id)
    const messagesWithLength = messages
      .map((msg) => {
        if (msg.role === 'user') {
          return {
            message: msg,
            length: `${msg.content.text}${getFileContext(msg.content.files)}`.length,
            formattedMessage: {
              role: 'user' as const,
              content: `${msg.content.text}${getFileContext(msg.content.files)}`
            }
          }
        } else {
          const content = msg.content
            .filter((block) => block.type === 'content')
            .map((block) => block.content)
            .join('\n')
          return {
            message: msg,
            length: content.length,
            formattedMessage: {
              role: 'assistant' as const,
              content: content
            }
          }
        }
      })
      .filter((item) => item.formattedMessage.content.length > 0)
    const title = await this.llmProviderPresenter.summaryTitles(
      messagesWithLength.map((item) => item.formattedMessage),
      summaryProviderId || conversation.settings.providerId,
      modelId || conversation.settings.modelId
    )
    console.log('-------------> title \n', title)
    let cleanedTitle = title.replace(/<think>.*?<\/think>/g, '').trim()
    cleanedTitle = cleanedTitle.replace(/^<think>/, '').trim()
    console.log('-------------> cleanedTitle \n', cleanedTitle)
    return cleanedTitle
  }
  async clearActiveThread(): Promise<void> {
    this.activeConversationId = null
    eventBus.emit(CONVERSATION_EVENTS.DEACTIVATED)
  }

  async clearAllMessages(conversationId: string): Promise<void> {
    await this.messageManager.clearAllMessages(conversationId)
    // 如果是当前活动会话，需要更新生成状态
    if (conversationId === this.activeConversationId) {
      // 停止所有正在生成的消息
      await this.stopConversationGeneration(conversationId)
    }
  }

  async getMessageExtraInfo(messageId: string, type: string): Promise<Record<string, unknown>[]> {
    const attachments = await this.sqlitePresenter.getMessageAttachments(messageId, type)
    return attachments.map((attachment) => JSON.parse(attachment.content))
  }

  async getMainMessageByParentId(
    conversationId: string,
    parentId: string
  ): Promise<Message | null> {
    const message = await this.messageManager.getMainMessageByParentId(conversationId, parentId)
    if (!message) {
      return null
    }
    return message
  }

  destroy() {
    this.searchManager.destroy()
  }
}

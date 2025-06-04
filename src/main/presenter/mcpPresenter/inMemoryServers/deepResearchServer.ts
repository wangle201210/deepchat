// Most of the code is referenced from https://github.com/pinkpixel-dev/deep-research-mcp
// replacing the search engine with Bocha and re-implementing the page content extraction logic
// Redesigned with reflection-based iterative research pattern inspired by LangGraph Reflexion
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { Transport } from '@modelcontextprotocol/sdk/shared/transport'
import axios from 'axios'
import { presenter } from '@/presenter'
import { nanoid } from 'nanoid'

// Schema definitions for iterative deep research tools
const StartDeepResearchArgsSchema = z.object({
  question: z.string().describe('The research question or topic to start deep research for.')
})

const SingleWebSearchArgsSchema = z.object({
  session_id: z.string().describe('Research session ID from start_deep_research.'),
  query: z.string().describe('Single search query to execute.'),
  max_results: z
    .number()
    .min(5)
    .max(15)
    .default(10)
    .describe('Maximum results for this search query (5-15).')
})

const ReflectResultsArgsSchema = z.object({
  session_id: z.string().describe('Research session ID from start_deep_research.'),
  iteration: z.number().describe('Current iteration number for this reflection.')
})

const GenerateFinalAnswerArgsSchema = z.object({
  session_id: z.string().describe('Research session ID from start_deep_research.'),
  documentation_prompt: z.string().optional().describe('Custom documentation prompt.')
})

// 默认文档生成提示
const DEFAULT_DOCUMENTATION_PROMPT = `
For all queries, search the web extensively to acquire up to date information. Research several sources. Use all the tools provided to you to gather as much context as possible.
Adhere to these guidelines when creating documentation:
Include screenshots when appropriate

1. CONTENT QUALITY:
    Clear, concise, and factually accurate
    Structured with logical organization
    Comprehensive coverage of topics
    Technical precision and attention to detail
    Free of unnecessary commentary or humor
    DOCUMENTATION STYLE:
    Professional and objective tone
    Thorough explanations with appropriate technical depth
    Well-formatted with proper headings, lists, and code blocks
    Consistent terminology and naming conventions
    Clean, readable layout without extraneous elements
    CODE QUALITY:
    Clean, maintainable, and well-commented code
    Best practices and modern patterns
    Proper error handling and edge case considerations
    Optimal performance and efficiency
    Follows language-specific style guidelines
    TECHNICAL EXPERTISE:
    Programming languages and frameworks
    System architecture and design patterns
    Development methodologies and practices
    Security considerations and standards
    Industry-standard tools and technologies
    Documentation guidelines
    Create an extremely detailed, comprehensive markdown document about a given topic when asked.
`

// Reflection result schema
interface ReflectionResult {
  needs_more_research: boolean
  missing_information: string[]
  quality_assessment: string
  suggested_queries: string[]
  confidence_score: number // 0-1 scale
}

// Search result interface
interface SearchResult {
  title: string
  url: string
  snippet: string
  published_date?: string
}

// Query search result interface
interface QuerySearchResult {
  query: string
  results: SearchResult[]
}

// Research session data interface
interface ResearchSession {
  session_id: string
  question: string
  iteration: number
  search_results: QuerySearchResult[]
  reflections: ReflectionResult[]
  suggested_queries: string[]
  created_at: Date
  last_accessed_at: Date
  is_completed: boolean
}

// 博查API返回的数据结构
interface BochaWebSearchResponse {
  msg: string | null
  data: {
    _type: string
    queryContext: {
      originalQuery: string
    }
    webPages: {
      webSearchUrl: string
      totalEstimatedMatches: number
      value: Array<{
        id: string | null
        name: string
        url: string
        displayUrl: string
        snippet: string
        summary: string
        siteName: string
        siteIcon: string
        dateLastCrawled: string
        cachedPageUrl: string | null
        language: string | null
        isFamilyFriendly: boolean | null
        isNavigational: boolean | null
        datePublished?: string
      }>
      isFamilyFriendly: boolean | null
    }
    videos: unknown | null
  }
}

export class DeepResearchServer {
  private server: Server
  private bochaApiKey: string
  private researchSessions: Map<string, ResearchSession> = new Map()
  private readonly SESSION_TIMEOUT = 60 * 60 * 1000 // 1小时超时
  private readonly MAX_SESSIONS = 50 // 最大会话数
  private cleanupTimer: NodeJS.Timeout | null = null

  constructor(env?: Record<string, unknown>) {
    // 只检查博查API密钥
    if (!env?.BOCHA_API_KEY) {
      throw new Error('BOCHA_API_KEY is required')
    }
    this.bochaApiKey = env.BOCHA_API_KEY as string

    // 创建服务器实例
    this.server = new Server(
      {
        name: 'deepchat-inmemory/deep-research-server',
        version: '2.0.0'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    )

    // 设置请求处理器
    this.setupRequestHandlers()

    // 启动清理定时器
    this.startCleanupTimer()
  }

  // 启动服务器
  public startServer(transport: Transport): void {
    this.server.connect(transport)
  }

  // 启动清理定时器
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredSessions()
    }, 5 * 60 * 1000) // 每5分钟检查一次
  }

  // 清理过期会话
  private cleanupExpiredSessions(): void {
    const now = new Date()
    const expiredSessions: string[] = []

    for (const [sessionId, session] of this.researchSessions.entries()) {
      if (now.getTime() - session.last_accessed_at.getTime() > this.SESSION_TIMEOUT) {
        expiredSessions.push(sessionId)
      }
    }

    expiredSessions.forEach(sessionId => {
      this.researchSessions.delete(sessionId)
      console.log(`Cleaned up expired research session: ${sessionId}`)
    })

    // 如果会话数量过多，清理最旧的会话
    if (this.researchSessions.size > this.MAX_SESSIONS) {
      const sortedSessions = Array.from(this.researchSessions.entries())
        .sort(([, a], [, b]) => a.last_accessed_at.getTime() - b.last_accessed_at.getTime())

      const toRemove = sortedSessions.slice(0, this.researchSessions.size - this.MAX_SESSIONS)
      toRemove.forEach(([sessionId]) => {
        this.researchSessions.delete(sessionId)
        console.log(`Cleaned up old research session: ${sessionId}`)
      })
    }
  }

  // 获取研究会话
  private getSession(sessionId: string): ResearchSession {
    const session = this.researchSessions.get(sessionId)
    if (!session) {
      throw new Error(`Research session not found: ${sessionId}`)
    }
    // 更新最后访问时间
    session.last_accessed_at = new Date()
    return session
  }

  // 创建新的研究会话
  private createSession(question: string): ResearchSession {
    const sessionId = nanoid()
    const session: ResearchSession = {
      session_id: sessionId,
      question,
      iteration: 0,
      search_results: [],
      reflections: [],
      suggested_queries: [],
      created_at: new Date(),
      last_accessed_at: new Date(),
      is_completed: false
    }

    this.researchSessions.set(sessionId, session)
    return session
  }

  // 清理会话数据
  private cleanupSession(sessionId: string): void {
    const removed = this.researchSessions.delete(sessionId)
    if (removed) {
      console.log(`Research session cleaned up: ${sessionId}`)
    }
  }

  // 设置请求处理器
  private setupRequestHandlers(): void {
    // 设置工具列表处理器
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'start_deep_research',
            description:
              'Start a new deep research session. This creates a session and returns a session_id for subsequent operations.',
            inputSchema: zodToJsonSchema(StartDeepResearchArgsSchema)
          },
          {
            name: 'execute_single_web_search',
            description:
              'Execute a single web search with one query within a research session.',
            inputSchema: zodToJsonSchema(SingleWebSearchArgsSchema)
          },
          {
            name: 'reflect_on_results',
            description:
              'Analyze accumulated research results within a session and determine if more research is needed.',
            inputSchema: zodToJsonSchema(ReflectResultsArgsSchema)
          },
          {
            name: 'generate_final_answer',
            description:
              'Generate the final comprehensive answer based on all accumulated research in the session. This will also cleanup the session data.',
            inputSchema: zodToJsonSchema(GenerateFinalAnswerArgsSchema)
          }
        ]
      }
    })

    // 设置工具调用处理器
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const { name, arguments: args } = request.params

        switch (name) {
          case 'start_deep_research':
            return await this.handleStartDeepResearch(args)
          case 'execute_single_web_search':
            return await this.handleSingleWebSearch(args)
          case 'reflect_on_results':
            return await this.handleReflectResults(args)
          case 'generate_final_answer':
            return await this.handleGenerateFinalAnswer(args)
          default:
            throw new Error(`Unknown tool: ${name}`)
        }
      } catch (error) {
        console.error('Error calling tool:', error)
        const errorMessage =
          error instanceof Error
            ? error.message
            : typeof error === 'string'
              ? error
              : 'An unknown error occurred'

        return {
          content: [{ type: 'text', text: `Error: ${errorMessage}` }],
          isError: true
        }
      }
    })
  }

  // 处理开始深度研究请求
  private async handleStartDeepResearch(args: unknown) {
    const parsed = StartDeepResearchArgsSchema.safeParse(args)
    if (!parsed.success) {
      throw new Error(`Invalid arguments for start_deep_research: ${parsed.error}`)
    }

    const { question } = parsed.data

    // 创建新的研究会话
    const session = this.createSession(question)

    // 生成初始搜索查询
    const initialQueries = this.generateSearchQueries(question, 1)
    session.suggested_queries = initialQueries
    session.iteration = 1

    const response = {
      session_id: session.session_id,
      question: session.question,
      research_iteration: session.iteration,
      suggested_queries: initialQueries,
      next_steps: `Research session created with ID: ${session.session_id}. Generated ${initialQueries.length} initial search queries. Execute each query separately using execute_single_web_search tool.`,
      session_info: {
        created_at: session.created_at.toISOString(),
        memory_usage: `Storing session data in memory for efficient access`
      }
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response, null, 2)
        }
      ]
    }
  }

  // 处理单个网络搜索请求
  private async handleSingleWebSearch(args: unknown) {
    const parsed = SingleWebSearchArgsSchema.safeParse(args)
    if (!parsed.success) {
      throw new Error(`Invalid arguments for execute_single_web_search: ${parsed.error}`)
    }

    const { session_id, query, max_results } = parsed.data

    // 获取会话
    const session = this.getSession(session_id)

    try {
      const searchResult = await this.performSingleBochaSearch(query, max_results)

      // 将搜索结果存储到会话中
      session.search_results.push(searchResult)

      const response = {
        session_id: session.session_id,
        query: query,
        results_count: searchResult.results.length,
        total_searches_in_session: session.search_results.length,
        next_steps: `Search results stored in memory for session ${session.session_id}. You can execute more searches or proceed to reflect_on_results to analyze the accumulated data.`,
        memory_info: {
          total_results_accumulated: session.search_results.reduce((sum, sr) => sum + sr.results.length, 0)
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(response, null, 2)
          }
        ]
      }
    } catch (error) {
      const axiosError = error as { message?: string }
      console.error('Single web search error:', axiosError.message)
      throw new Error(`Single web search failed: ${axiosError.message}`)
    }
  }

  // 处理结果反思请求
  private async handleReflectResults(args: unknown) {
    const parsed = ReflectResultsArgsSchema.safeParse(args)
    if (!parsed.success) {
      throw new Error(`Invalid arguments for reflect_on_results: ${parsed.error}`)
    }

    const { session_id, iteration } = parsed.data

    // 获取会话
    const session = this.getSession(session_id)

    // 从内存中获取搜索结果进行分析
    const allSearchResults = session.search_results
    const searchResultsText = allSearchResults
      .map(sr => `Query: ${sr.query}\nResults: ${sr.results.map(r => `${r.title}: ${r.snippet}`).join('\n')}`)
      .join('\n\n')

    // 分析搜索结果质量和完整性
    const reflection = this.analyzeSearchResults(session.question, searchResultsText, iteration)

    // 存储反思结果
    session.reflections.push(reflection)
    session.iteration = iteration

    // 如果需要更多研究，生成新的查询建议
    if (reflection.needs_more_research) {
      const newQueries = this.generateSearchQueries(session.question, iteration + 1)
      session.suggested_queries = newQueries
    }

    const statusMessage = reflection.needs_more_research
      ? `Research iteration ${iteration} reflection complete for session ${session.session_id}. Analysis indicates more research needed.\n\nMissing information:\n${reflection.missing_information.map((info, i) => `${i + 1}. ${info}`).join('\n')}\n\nConfidence: ${(reflection.confidence_score * 100).toFixed(1)}%\n\nSuggested next queries: ${session.suggested_queries.join(', ')}\n\nNext: Execute additional searches with suggested queries.`
      : `Research iteration ${iteration} reflection complete for session ${session.session_id}. Analysis indicates sufficient information gathered.\n\nQuality assessment: ${reflection.quality_assessment}\n\nConfidence: ${(reflection.confidence_score * 100).toFixed(1)}%\n\nNext: Generate final comprehensive answer using generate_final_answer.`

    return {
      content: [
        {
          type: 'text',
          text: statusMessage
        }
      ]
    }
  }

  // 处理最终答案生成请求
  private async handleGenerateFinalAnswer(args: unknown) {
    const parsed = GenerateFinalAnswerArgsSchema.safeParse(args)
    if (!parsed.success) {
      throw new Error(`Invalid arguments for generate_final_answer: ${parsed.error}`)
    }

    const { session_id, documentation_prompt } = parsed.data

    // 获取会话
    const session = this.getSession(session_id)

    // 从内存中构建完整的研究数据
    const researchData = {
      original_question: session.question,
      total_iterations: session.iteration,
      total_searches: session.search_results.length,
      total_results: session.search_results.reduce((sum, sr) => sum + sr.results.length, 0),
      search_results: session.search_results,
      reflections: session.reflections,
      final_confidence: session.reflections.length > 0
        ? session.reflections[session.reflections.length - 1].confidence_score
        : 0.5
    }

    // 确定文档生成提示
    const locale = presenter.configPresenter.getLanguage?.() || 'zh-CN'
    const finalDocumentationPrompt =
      documentation_prompt ||
      `${DEFAULT_DOCUMENTATION_PROMPT}
User's current system language is ${locale}, please respond in the system language unless specified otherwise.`

    const finalResult = {
      session_id: session.session_id,
      original_question: session.question,
      research_summary: `Comprehensive research completed across ${session.iteration} iterations with ${researchData.total_searches} searches yielding ${researchData.total_results} total results.`,
      final_confidence_score: `${(researchData.final_confidence * 100).toFixed(1)}%`,
      documentation_instructions: finalDocumentationPrompt,
      research_metadata: {
        session_created: session.created_at.toISOString(),
        session_duration: `${Math.round((new Date().getTime() - session.created_at.getTime()) / 1000 / 60)} minutes`,
        total_sources: researchData.total_results,
        iterations_completed: session.iteration,
        research_completed: true
      },
      cleanup_status: 'Session data will be cleaned up after this response'
    }

    // 标记会话为已完成，准备清理
    session.is_completed = true

    // 延迟清理，给响应时间返回
    setTimeout(() => {
      this.cleanupSession(session_id)
    }, 1000)

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(finalResult, null, 2)
        }
      ]
    }
  }

  // 生成搜索查询
  private generateSearchQueries(
    question: string,
    iteration: number = 1
  ): string[] {
    const baseQueries = [
      question,
      `${question} latest research`,
      `${question} expert analysis`,
      `${question} best practices`
    ]

    if (iteration === 1) {
      return baseQueries.slice(0, 3)
    }

    // 基于之前的结果生成更具体的查询
    const refinedQueries = [
      `${question} detailed explanation`,
      `${question} case studies examples`,
      `${question} implementation guide`,
      `${question} challenges solutions`,
      `${question} advanced techniques`,
      `${question} expert opinions`
    ]

    // 基于迭代次数返回不同数量的查询
    const queryCount = Math.min(3, Math.max(1, 5 - iteration))
    return refinedQueries.slice(0, queryCount)
  }

  // 执行单个博查搜索
  private async performSingleBochaSearch(
    query: string,
    maxResults: number
  ): Promise<QuerySearchResult> {
    try {
      const response = await axios.post(
        'https://api.bochaai.com/v1/web-search',
        {
          query,
          summary: true,
          freshness: 'noLimit',
          count: maxResults
        },
        {
          headers: {
            Authorization: `Bearer ${this.bochaApiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      )

      const searchResponse = response.data as BochaWebSearchResponse
      const results = searchResponse.data?.webPages?.value || []

      return {
        query,
        results: results.map(
          (item): SearchResult => ({
            title: item.name,
            url: item.url,
            snippet: item.summary,
            published_date: item.datePublished
          })
        )
      }
    } catch (error) {
      console.error(`Search failed for query "${query}":`, error)
      return { query, results: [] }
    }
  }

  // 分析搜索结果
  private analyzeSearchResults(
    question: string,
    searchResults: string,
    iteration: number
  ): ReflectionResult {
    // 简化的分析逻辑 - 在实际应用中可以使用LLM进行更sophisticated的分析
    const resultsLength = searchResults.length
    const hasKeywords = searchResults.toLowerCase().includes(question.toLowerCase())

    // 基于迭代次数和结果质量评估
    let confidenceScore = 0.5 // 基础分数
    let needsMoreResearch = true
    let missingInfo: string[] = []

    if (resultsLength > 1000 && hasKeywords) {
      confidenceScore += 0.3
    }

    if (iteration >= 3) {
      confidenceScore += 0.2
      needsMoreResearch = false // 最多3次迭代
    }

    if (confidenceScore >= 0.8) {
      needsMoreResearch = false
    } else {
      missingInfo = [
        'More detailed technical information needed',
        'Additional expert perspectives required',
        'Recent developments and updates needed'
      ]
    }

    return {
      needs_more_research: needsMoreResearch,
      missing_information: missingInfo,
      quality_assessment: `Research quality assessment for iteration ${iteration}. Confidence level: ${(confidenceScore * 100).toFixed(1)}%`,
      suggested_queries: needsMoreResearch
        ? [`${question} advanced techniques`, `${question} expert opinions`]
        : [],
      confidence_score: Math.min(confidenceScore, 1.0)
    }
  }

  // 销毁时清理资源
  public destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }

    // 清理所有会话
    this.researchSessions.clear()
    console.log('DeepResearchServer destroyed and all sessions cleaned up')
  }

  // 获取会话统计信息（用于调试和监控）
  public getSessionStats(): {
    total_sessions: number
    active_sessions: number
    completed_sessions: number
    oldest_session_age_minutes: number
  } {
    const now = new Date()
    let activeCount = 0
    let completedCount = 0
    let oldestAge = 0

    for (const session of this.researchSessions.values()) {
      if (session.is_completed) {
        completedCount++
      } else {
        activeCount++
      }

      const ageMinutes = Math.round((now.getTime() - session.created_at.getTime()) / 1000 / 60)
      if (ageMinutes > oldestAge) {
        oldestAge = ageMinutes
      }
    }

    return {
      total_sessions: this.researchSessions.size,
      active_sessions: activeCount,
      completed_sessions: completedCount,
      oldest_session_age_minutes: oldestAge
    }
  }
}

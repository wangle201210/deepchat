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

// Default documentation generation prompt
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

// Bocha API response data structure
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
  private readonly SESSION_TIMEOUT = 60 * 60 * 1000 // 1 hour timeout
  private readonly MAX_SESSIONS = 50 // Maximum number of sessions
  private cleanupTimer: NodeJS.Timeout | null = null

  constructor(env?: Record<string, unknown>) {
    // Only check Bocha API key
    if (!env?.BOCHA_API_KEY) {
      throw new Error('BOCHA_API_KEY is required')
    }
    this.bochaApiKey = env.BOCHA_API_KEY as string

    // Create server instance
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

    // Set request handlers
    this.setupRequestHandlers()

    // Start cleanup timer
    this.startCleanupTimer()
  }

  // Start server
  public startServer(transport: Transport): void {
    this.server.connect(transport)
  }

  // Start cleanup timer
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredSessions()
    }, 5 * 60 * 1000) // Check every 5 minutes
  }

  // Clean up expired sessions
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

    // If session count is too high, clean up the oldest session
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

  // Get research session
  private getSession(sessionId: string): ResearchSession {
    const session = this.researchSessions.get(sessionId)
    if (!session) {
      throw new Error(`Research session not found: ${sessionId}`)
    }
    // Update last accessed time
    session.last_accessed_at = new Date()
    return session
  }

  // Create new research session
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

  // Clean up session data
  private cleanupSession(sessionId: string): void {
    const removed = this.researchSessions.delete(sessionId)
    if (removed) {
      console.log(`Research session cleaned up: ${sessionId}`)
    }
  }

  // Set request handlers
  private setupRequestHandlers(): void {
    // Set tools list handler
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

    // Set tool call handler
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

  // Handle start deep research request
  private async handleStartDeepResearch(args: unknown) {
    const parsed = StartDeepResearchArgsSchema.safeParse(args)
    if (!parsed.success) {
      throw new Error(`Invalid arguments for start_deep_research: ${parsed.error}`)
    }

    const { question } = parsed.data

    // Create new research session
    const session = this.createSession(question)

    // Generate initial search queries
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

  // Handle single web search request
  private async handleSingleWebSearch(args: unknown) {
    const parsed = SingleWebSearchArgsSchema.safeParse(args)
    if (!parsed.success) {
      throw new Error(`Invalid arguments for execute_single_web_search: ${parsed.error}`)
    }

    const { session_id, query, max_results } = parsed.data

    // Get session
    const session = this.getSession(session_id)

    try {
      const searchResult = await this.performSingleBochaSearch(query, max_results)

      // Store search results in session
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

  // Handle result reflection request
  private async handleReflectResults(args: unknown) {
    const parsed = ReflectResultsArgsSchema.safeParse(args)
    if (!parsed.success) {
      throw new Error(`Invalid arguments for reflect_on_results: ${parsed.error}`)
    }

    const { session_id, iteration } = parsed.data

    // Get session
    const session = this.getSession(session_id)

    // Analyze search results from memory
    const allSearchResults = session.search_results
    const searchResultsText = allSearchResults
      .map(sr => `Query: ${sr.query}\nResults: ${sr.results.map(r => `${r.title}: ${r.snippet}`).join('\n')}`)
      .join('\n\n')

    // Analyze search results quality and completeness
    const reflection = this.analyzeSearchResults(session.question, searchResultsText, iteration)

    // Store reflection results
    session.reflections.push(reflection)
    session.iteration = iteration

    // If more research is needed, generate new query suggestions
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

  // Handle final answer generation request
  private async handleGenerateFinalAnswer(args: unknown) {
    const parsed = GenerateFinalAnswerArgsSchema.safeParse(args)
    if (!parsed.success) {
      throw new Error(`Invalid arguments for generate_final_answer: ${parsed.error}`)
    }

    const { session_id, documentation_prompt } = parsed.data

    // Get session
    const session = this.getSession(session_id)

    // Build complete research data from memory
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

    // Determine document generation prompt
    const locale = presenter.configPresenter.getLanguage?.() || 'zh-CN'
    const finalDocumentationPrompt =
      documentation_prompt ||
      `${DEFAULT_DOCUMENTATION_PROMPT}
User's current system language is ${locale}, please respond in the system language unless specified otherwise.`

    // Build complete research content for model summary
    const completeResearchContent = {
      research_question: session.question,
      research_metadata: {
        session_id: session.session_id,
        session_created: session.created_at.toISOString(),
        session_duration: `${Math.round((new Date().getTime() - session.created_at.getTime()) / 1000 / 60)} minutes`,
        total_iterations: session.iteration,
        total_searches: researchData.total_searches,
        total_sources: researchData.total_results,
        final_confidence_score: `${(researchData.final_confidence * 100).toFixed(1)}%`
      },

      // Complete search results data
      detailed_search_results: session.search_results.map((searchResult, index) => ({
        search_number: index + 1,
        query: searchResult.query,
        results_count: searchResult.results.length,
        results: searchResult.results.map((result, resultIndex) => ({
          result_number: resultIndex + 1,
          title: result.title,
          url: result.url,
          content_snippet: result.snippet,
          published_date: result.published_date || 'Unknown',
          source_domain: new URL(result.url).hostname
        }))
      })),

      // Reflection analysis history
      research_reflections: session.reflections.map((reflection, index) => ({
        iteration: index + 1,
        needs_more_research: reflection.needs_more_research,
        confidence_score: `${(reflection.confidence_score * 100).toFixed(1)}%`,
        quality_assessment: reflection.quality_assessment,
        missing_information: reflection.missing_information,
        suggested_queries: reflection.suggested_queries
      })),

      // Complete text content of all search results (for model analysis)
      consolidated_research_content: session.search_results.map(sr =>
        `=== Search Query: ${sr.query} ===\n` +
        sr.results.map((result, idx) =>
          `[Source ${idx + 1}] ${result.title}\n` +
          `URL: ${result.url}\n` +
          `Published: ${result.published_date || 'Unknown'}\n` +
          `Content Summary: ${result.snippet}\n` +
          `---`
        ).join('\n')
      ).join('\n\n'),

      // Document generation instructions
      documentation_instructions: finalDocumentationPrompt,

      // Summary instructions
      summary_instructions: `
Please generate a comprehensive and detailed research report based on the complete research data above for the user's question: "${session.question}"

The report should include:
1. Problem overview and research background
2. Key findings and main information points
3. Comparative analysis of different source perspectives
4. Specific implementation recommendations or solutions
5. Related latest developments and trends
6. References and information sources

Please ensure:
- Make full use of information from all search results
- Maintain objectivity and accuracy
- Provide specific details and examples
- Respond in the user's system language (${locale}) unless specified otherwise
- Appropriately cite specific sources and links
      `,

      cleanup_status: 'Session data will be cleaned up after this response'
    }

    // Mark session as completed, prepare for cleanup
    session.is_completed = true

    // Delay cleanup, give response time to return
    setTimeout(() => {
      this.cleanupSession(session_id)
    }, 1000)

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(completeResearchContent, null, 2)
        }
      ]
    }
  }

  // Generate search queries
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

    // Generate more specific queries based on previous results
    const refinedQueries = [
      `${question} detailed explanation`,
      `${question} case studies examples`,
      `${question} implementation guide`,
      `${question} challenges solutions`,
      `${question} advanced techniques`,
      `${question} expert opinions`
    ]

    // Return different numbers of queries based on iteration
    const queryCount = Math.min(3, Math.max(1, 5 - iteration))
    return refinedQueries.slice(0, queryCount)
  }

  // Execute single Bocha search
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

  // Analyze search results
  private analyzeSearchResults(
    question: string,
    searchResults: string,
    iteration: number
  ): ReflectionResult {
    // Simplified analysis logic - In a real application, an LLM could be used for more sophisticated analysis
    const resultsLength = searchResults.length
    const hasKeywords = searchResults.toLowerCase().includes(question.toLowerCase())

    // Based on iteration and result quality assessment
    let confidenceScore = 0.5 // Base score
    let needsMoreResearch = true
    let missingInfo: string[] = []

    if (resultsLength > 1000 && hasKeywords) {
      confidenceScore += 0.3
    }

    if (iteration >= 3) {
      confidenceScore += 0.2
      needsMoreResearch = false // Max 3 iterations
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

  // Clean up resources on destroy
  public destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }

    // Clean up all sessions
    this.researchSessions.clear()
    console.log('DeepResearchServer destroyed and all sessions cleaned up')
  }

  // Get session stats (for debugging and monitoring)
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

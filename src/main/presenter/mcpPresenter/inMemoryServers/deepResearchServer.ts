// Most of the code is referenced from https://github.com/pinkpixel-dev/deep-research-mcp
// replacing the search engine with Bocha and re-implementing the page content extraction logic
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { Transport } from '@modelcontextprotocol/sdk/shared/transport'
import axios from 'axios'
import * as cheerio from 'cheerio'
import { HttpsProxyAgent } from 'https-proxy-agent'
import { proxyConfig } from '@/presenter/proxyConfig'
import { presenter } from '@/presenter'

// Schema definitions for deep research tool
const DeepResearchArgsSchema = z.object({
  query: z.string().describe('The main research topic or question.'),
  search_depth: z
    .string()
    .optional()
    .default('advanced')
    .describe('Depth of the search ("basic" or "advanced").'),
  topic: z
    .string()
    .optional()
    .default('general')
    .describe('Category for the search ("general" or "news").'),
  days: z.number().optional().describe('For "news" topic: number of days back from current date.'),
  time_range: z
    .string()
    .optional()
    .describe('Time range for search results (e.g., "d" for day, "w" for week).'),
  max_search_results: z
    .number()
    .optional()
    .default(7)
    .describe('Max search results to retrieve (1-20).'),
  chunks_per_source: z
    .number()
    .optional()
    .default(3)
    .describe('For "advanced" search: number of content chunks from each source (1-3).'),
  include_search_images: z
    .boolean()
    .optional()
    .default(false)
    .describe('Include image URLs from search results.'),
  include_search_image_descriptions: z
    .boolean()
    .optional()
    .default(false)
    .describe('Include image descriptions from search results.'),
  include_answer: z
    .union([z.boolean(), z.enum(['basic', 'advanced'])])
    .optional()
    .default(false)
    .describe('Include an LLM-generated answer from search.'),
  include_raw_content_search: z
    .boolean()
    .optional()
    .default(false)
    .describe('Include cleaned HTML from search results.'),
  include_domains_search: z
    .array(z.string())
    .optional()
    .default([])
    .describe('List of domains to specifically include in search.'),
  exclude_domains_search: z
    .array(z.string())
    .optional()
    .default([])
    .describe('List of domains to specifically exclude from search.'),
  search_timeout: z
    .number()
    .optional()
    .default(60)
    .describe('Timeout in seconds for search requests.'),
  crawl_max_depth: z
    .number()
    .optional()
    .default(1)
    .describe('Max crawl depth from base URL (1-2).'),
  crawl_max_breadth: z
    .number()
    .optional()
    .default(10)
    .describe('Max links to follow per page level during crawl (1-10).'),
  crawl_limit: z
    .number()
    .optional()
    .default(10)
    .describe('Total links crawler will process per root URL (1-20).'),
  crawl_instructions: z
    .string()
    .optional()
    .describe('Natural language instructions for the crawler.'),
  crawl_select_paths: z
    .array(z.string())
    .optional()
    .default([])
    .describe('Regex for URLs paths to crawl.'),
  crawl_select_domains: z
    .array(z.string())
    .optional()
    .default([])
    .describe('Regex for domains/subdomains to crawl.'),
  crawl_exclude_paths: z
    .array(z.string())
    .optional()
    .default([])
    .describe('Regex for URL paths to exclude.'),
  crawl_exclude_domains: z
    .array(z.string())
    .optional()
    .default([])
    .describe('Regex for domains/subdomains to exclude.'),
  crawl_allow_external: z
    .boolean()
    .optional()
    .default(false)
    .describe('Allow crawler to follow links to external domains.'),
  crawl_include_images: z
    .boolean()
    .optional()
    .default(false)
    .describe('Extract image URLs from crawled pages.'),
  crawl_categories: z
    .array(z.string())
    .optional()
    .default([])
    .describe('Filter crawl URLs by categories.'),
  crawl_extract_depth: z
    .string()
    .optional()
    .default('basic')
    .describe('Extraction depth for crawl ("basic" or "advanced").'),
  crawl_timeout: z
    .number()
    .optional()
    .default(180)
    .describe('Timeout in seconds for crawl requests.'),
  documentation_prompt: z
    .string()
    .optional()
    .describe('Custom prompt for LLM documentation generation.'),
  hardware_acceleration: z
    .boolean()
    .optional()
    .default(false)
    .describe('Try to use hardware acceleration if available.')
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

// 接口定义
interface CombinedResult {
  search_rank: number
  original_url: string
  title: string
  initial_content_snippet: string
  search_score?: number
  published_date?: string
  crawled_data: CrawledPageData[]
  crawl_errors: string[]
}

interface CrawledPageData {
  url: string
  raw_content: string | null
  images?: string[]
  links?: string[]
  depth: number
}

interface CrawlParams {
  maxDepth: number
  maxBreadth: number
  limit: number
  instructions?: string
  selectPaths: string[]
  selectDomains: string[]
  excludePaths: string[]
  excludeDomains: string[]
  allowExternal: boolean
  includeImages: boolean
  extractDepth: 'basic' | 'advanced'
  timeout: number
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

// 自定义网页爬虫类
class WebCrawler {
  private visitedUrls = new Set<string>()
  private crawledCount = 0
  private readonly userAgent =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

  constructor(private params: CrawlParams) {}

  async crawl(startUrl: string): Promise<CrawledPageData[]> {
    this.visitedUrls.clear()
    this.crawledCount = 0

    const results: CrawledPageData[] = []
    const urlQueue: Array<{ url: string; depth: number }> = [{ url: startUrl, depth: 0 }]

    while (urlQueue.length > 0 && this.crawledCount < this.params.limit) {
      const batch = urlQueue.splice(0, Math.min(this.params.maxBreadth, urlQueue.length))

      // 并发处理当前批次的URL
      const batchPromises = batch.map(({ url, depth }) =>
        this.crawlSinglePage(url, depth).catch((error) => {
          console.error(`Failed to crawl ${url}:`, error.message)
          return null
        })
      )

      const batchResults = await Promise.all(batchPromises)

      for (const result of batchResults) {
        if (result) {
          results.push(result)
          this.crawledCount++

          // 如果还没达到最大深度，提取新的链接加入队列
          if (result.depth < this.params.maxDepth && this.crawledCount < this.params.limit) {
            const newUrls = this.extractValidLinks(result.links || [], result.depth + 1)
            urlQueue.push(...newUrls.slice(0, this.params.maxBreadth))
          }
        }
      }
    }

    return results
  }

  private async crawlSinglePage(url: string, depth: number): Promise<CrawledPageData | null> {
    if (this.visitedUrls.has(url) || this.crawledCount >= this.params.limit) {
      return null
    }

    this.visitedUrls.add(url)

    try {
      const proxyUrl = proxyConfig.getProxyUrl()
      const response = await axios.get(url, {
        timeout: 10000, // 10秒超时
        headers: {
          'User-Agent': this.userAgent
        },
        httpAgent: proxyUrl ? new HttpsProxyAgent(proxyUrl) : undefined,
        httpsAgent: proxyUrl ? new HttpsProxyAgent(proxyUrl) : undefined,
        maxRedirects: 5
      })

      const $ = cheerio.load(response.data)

      // 移除不需要的元素
      $('script, style, nav, header, footer, iframe, .ad, #ad, .advertisement').remove()

      // 提取主要内容
      const rawContent = this.extractMainContent($)

      // 提取图片（如果需要）
      const images: string[] = []
      if (this.params.includeImages) {
        $('img').each((_, element) => {
          const src = $(element).attr('src')
          if (src) {
            const absoluteUrl = this.resolveUrl(src, url)
            if (absoluteUrl) images.push(absoluteUrl)
          }
        })
      }

      // 提取链接
      const links: string[] = []
      $('a[href]').each((_, element) => {
        const href = $(element).attr('href')
        if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
          const absoluteUrl = this.resolveUrl(href, url)
          if (absoluteUrl && this.isValidUrl(absoluteUrl)) {
            links.push(absoluteUrl)
          }
        }
      })

      return {
        url,
        raw_content: rawContent,
        images: images.slice(0, 20), // 限制图片数量
        links: [...new Set(links)].slice(0, 50), // 去重并限制链接数量
        depth
      }
    } catch (error: unknown) {
      const err = error as Error
      console.error(`Failed to crawl page ${url}:`, err.message)
      return null
    }
  }

  private extractMainContent($: cheerio.CheerioAPI): string {
    // 尝试多种策略提取主要内容
    const strategies = [
      // 1. 尝试语义化标签
      () => {
        const article = $('article').first()
        if (article.length) return article.text()
        return null
      },
      // 2. 尝试main标签
      () => {
        const main = $('main').first()
        if (main.length) return main.text()
        return null
      },
      // 3. 尝试常见的内容类名
      () => {
        const selectors = [
          '.content',
          '#content',
          '.post-content',
          '.article-content',
          '.entry-content',
          '.container'
        ]
        for (const selector of selectors) {
          const element = $(selector).first()
          if (element.length && element.text().trim().length > 200) {
            return element.text()
          }
        }
        return null
      },
      // 4. 使用body作为最后手段
      () => {
        return $('body').text()
      }
    ]

    for (const strategy of strategies) {
      const content = strategy()
      if (content && content.trim().length > 50) {
        return this.cleanText(content)
      }
    }

    return ''
  }

  private cleanText(text: string): string {
    return text
      .replace(/[\r\n]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 5000) // 限制内容长度
  }

  private resolveUrl(href: string, baseUrl: string): string | null {
    try {
      if (href.startsWith('http')) {
        return href
      }
      return new URL(href, baseUrl).toString()
    } catch {
      return null
    }
  }

  private isValidUrl(url: string): boolean {
    try {
      const urlObj = new URL(url)

      // 基本URL格式检查
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return false
      }

      // 检查域名过滤
      if (!this.params.allowExternal) {
        // 如果不允许外部链接，需要检查域名限制
        if (this.params.selectDomains.length > 0) {
          const matchesDomain = this.params.selectDomains.some((pattern) => {
            try {
              return new RegExp(pattern).test(urlObj.hostname)
            } catch {
              return urlObj.hostname.includes(pattern)
            }
          })
          if (!matchesDomain) return false
        }
      }

      // 检查排除域名
      if (this.params.excludeDomains.length > 0) {
        const isExcluded = this.params.excludeDomains.some((pattern) => {
          try {
            return new RegExp(pattern).test(urlObj.hostname)
          } catch {
            return urlObj.hostname.includes(pattern)
          }
        })
        if (isExcluded) return false
      }

      // 检查路径过滤
      if (this.params.selectPaths.length > 0) {
        const matchesPath = this.params.selectPaths.some((pattern) => {
          try {
            return new RegExp(pattern).test(urlObj.pathname)
          } catch {
            return urlObj.pathname.includes(pattern)
          }
        })
        if (!matchesPath) return false
      }

      // 检查排除路径
      if (this.params.excludePaths.length > 0) {
        const isExcluded = this.params.excludePaths.some((pattern) => {
          try {
            return new RegExp(pattern).test(urlObj.pathname)
          } catch {
            return urlObj.pathname.includes(pattern)
          }
        })
        if (isExcluded) return false
      }

      // 排除常见的非内容文件
      const excludeExtensions = [
        '.pdf',
        '.jpg',
        '.jpeg',
        '.png',
        '.gif',
        '.zip',
        '.rar',
        '.exe',
        '.dmg'
      ]
      if (excludeExtensions.some((ext) => urlObj.pathname.toLowerCase().endsWith(ext))) {
        return false
      }

      return true
    } catch {
      return false
    }
  }

  private extractValidLinks(links: string[], depth: number): Array<{ url: string; depth: number }> {
    return links
      .filter((link) => !this.visitedUrls.has(link) && this.isValidUrl(link))
      .slice(0, this.params.maxBreadth)
      .map((url) => ({ url, depth }))
  }
}

export class DeepResearchServer {
  private server: Server
  private bochaApiKey: string

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
        version: '1.0.0'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    )

    // 设置请求处理器
    this.setupRequestHandlers()
  }

  // 启动服务器
  public startServer(transport: Transport): void {
    this.server.connect(transport)
  }

  // 设置请求处理器
  private setupRequestHandlers(): void {
    // 设置工具列表处理器
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'deep_research_tool',
            description:
              'Performs extensive web research using Bocha Search and advanced web crawling. Returns aggregated JSON data including the query, search summary, detailed research findings, and documentation instructions.',
            inputSchema: zodToJsonSchema(DeepResearchArgsSchema)
          }
        ]
      }
    })

    // 设置工具调用处理器
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const { name, arguments: args } = request.params

        if (name !== 'deep_research_tool') {
          throw new Error(`Unknown tool: ${name}`)
        }

        const parsed = DeepResearchArgsSchema.safeParse(args)
        if (!parsed.success) {
          throw new Error(`Invalid research parameters: ${parsed.error}`)
        }

        const researchArgs = parsed.data

        // 确定文档生成提示
        const locale = presenter.configPresenter.getLanguage?.() || 'zh-CN'
        const finalDocumentationPrompt = `${DEFAULT_DOCUMENTATION_PROMPT}\nUser's current system language is ${locale}, please respond in the system language unless specified otherwise.`

        try {
          console.log('Starting deep research using Bocha Search')
          const results = await this.performDeepResearch(researchArgs)

          const outputText = JSON.stringify(
            {
              documentation_instructions: finalDocumentationPrompt,
              original_query: researchArgs.query,
              search_summary: results.summary,
              research_data: results.results
            },
            null,
            2
          )

          return {
            content: [{ type: 'text', text: outputText }]
          }
        } catch (error: unknown) {
          const researchError = error as {
            response?: { data?: { error?: string } }
            message?: string
          }
          const errorMessage =
            researchError.response?.data?.error ||
            researchError.message ||
            'An unexpected error occurred'
          console.error('[DeepResearchTool Error]', errorMessage)

          const errorOutput = JSON.stringify(
            {
              documentation_instructions: finalDocumentationPrompt,
              error: errorMessage,
              original_query: researchArgs.query
            },
            null,
            2
          )

          return {
            content: [{ type: 'text', text: errorOutput }],
            isError: true
          }
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

  // 执行深度研究
  private async performDeepResearch(args: z.infer<typeof DeepResearchArgsSchema>): Promise<{
    results: CombinedResult[]
    summary: string | null
  }> {
    try {
      // 第一步：使用博查搜索获取初始结果
      const searchResults = await this.performBochaSearch(args)

      if (searchResults.results.length === 0) {
        return searchResults
      }

      // 第二步：对搜索结果进行深度爬取
      const crawlParams: CrawlParams = {
        maxDepth: Math.min(3, args.crawl_max_depth || 1), // 最多3层深度
        maxBreadth: Math.min(15, args.crawl_max_breadth || 10),
        limit: Math.min(50, args.crawl_limit || 20), // 增加爬取限制
        instructions: args.crawl_instructions,
        selectPaths: args.crawl_select_paths || [],
        selectDomains: args.crawl_select_domains || [],
        excludePaths: args.crawl_exclude_paths || [],
        excludeDomains: args.crawl_exclude_domains || [],
        allowExternal: args.crawl_allow_external || false,
        includeImages: args.crawl_include_images || false,
        extractDepth: (args.crawl_extract_depth as 'basic' | 'advanced') || 'basic',
        timeout: args.crawl_timeout || 180
      }

      console.log(`Starting deep crawl for ${searchResults.results.length} search results...`)

      const enhancedResults: CombinedResult[] = []

      // 并发爬取搜索结果
      const crawlPromises = searchResults.results.map(async (result) => {
        try {
          const crawler = new WebCrawler(crawlParams)
          const crawledData = await crawler.crawl(result.original_url)

          return {
            ...result,
            crawled_data: crawledData.length > 0 ? crawledData : result.crawled_data,
            crawl_errors:
              crawledData.length === 0
                ? [`Failed to crawl ${result.original_url}: No content extracted`]
                : []
          }
        } catch (error: unknown) {
          const err = error as Error
          console.error(`Crawl error for ${result.original_url}:`, err.message)
          return {
            ...result,
            crawl_errors: [`Failed to crawl ${result.original_url}: ${err.message}`]
          }
        }
      })

      const crawlResults = await Promise.all(crawlPromises)
      enhancedResults.push(...crawlResults)

      const totalCrawledPages = enhancedResults.reduce(
        (sum, result) => sum + result.crawled_data.length,
        0
      )
      const enhancedSummary = `${searchResults.summary} Deep crawling obtained ${totalCrawledPages} page contents.`

      console.log(
        `Deep research completed: ${enhancedResults.length} search results, ${totalCrawledPages} crawled pages`
      )

      return {
        results: enhancedResults,
        summary: enhancedSummary
      }
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { error?: string } }; message?: string }
      console.error('Deep research error:', axiosError.message)
      throw new Error(`Deep research failed: ${axiosError.message}`)
    }
  }

  // 使用博查API进行搜索
  private async performBochaSearch(args: z.infer<typeof DeepResearchArgsSchema>): Promise<{
    results: CombinedResult[]
    summary: string | null
  }> {
    try {
      // 调用博查Web搜索API
      const response = await axios.post(
        'https://api.bochaai.com/v1/web-search',
        {
          query: args.query,
          summary: true,
          freshness: 'noLimit',
          count: args.max_search_results || 7
        },
        {
          headers: {
            Authorization: `Bearer ${this.bochaApiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: (args.search_timeout || 60) * 1000
        }
      )

      const searchResponse = response.data as BochaWebSearchResponse

      if (
        !searchResponse.data?.webPages?.value ||
        searchResponse.data.webPages.value.length === 0
      ) {
        return {
          results: [],
          summary: `No results found for query: "${args.query}".`
        }
      }

      // 将博查搜索结果转换为统一格式
      const combinedResults: CombinedResult[] = searchResponse.data.webPages.value.map(
        (item, index) => ({
          search_rank: index + 1,
          original_url: item.url,
          title: item.name,
          initial_content_snippet: item.summary,
          search_score: undefined, // 博查API不提供分数
          published_date: item.datePublished,
          crawled_data: [
            {
              url: item.url,
              raw_content: item.summary,
              images: [],
              links: [],
              depth: 0
            }
          ],
          crawl_errors: []
        })
      )

      return {
        results: combinedResults,
        summary: `Found ${combinedResults.length} results using Bocha Search for "${args.query}"`
      }
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { error?: string } }; message?: string }
      console.error('Bocha search error:', axiosError.message)
      throw new Error(`Bocha API request failed: ${axiosError.message}`)
    }
  }
}

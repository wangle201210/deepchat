import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ToolSchema
} from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { Transport } from '@modelcontextprotocol/sdk/shared/transport'
import axios from 'axios'

// Schema definitions
const BochaWebSearchArgsSchema = z.object({
  query: z.string().describe('Search query (max 400 chars, 50 words)'),
  count: z.number().optional().default(10).describe('Number of results (1-50, default 10)'),
  page: z.number().optional().default(1).describe('Page number (default 1)')
})

const ToolInputSchema = ToolSchema.shape.inputSchema
type ToolInput = z.infer<typeof ToolInputSchema>

// 定义Bocha API返回的数据结构
interface BochaSearchResponse {
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
        siteName: string
        siteIcon: string
        dateLastCrawled: string
        cachedPageUrl: string | null
        language: string | null
        isFamilyFriendly: boolean | null
        isNavigational: boolean | null
      }>
      isFamilyFriendly: boolean | null
    }
    videos: unknown | null
  }
}

export class BochaSearchServer {
  private server: Server
  private apiKey: string

  constructor(env?: Record<string, string>) {
    if (!env?.apiKey) {
      throw new Error('需要提供Bocha API Key')
    }
    this.apiKey = env.apiKey

    // 创建服务器实例
    this.server = new Server(
      {
        name: 'deepchat-inmemory/bocha-search-server',
        version: '0.1.0'
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
            name: 'bocha_web_search',
            description:
              'Performs a web search using the Bocha AI Search API, ideal for general queries, news, articles, and online content.。' +
              'Use this for broad information gathering, recent events, or when you need diverse web sources.' +
              'Supports pagination, content filtering, and freshness controls. ' +
              'Maximum 50 results per request, with page for pagination.',
            inputSchema: zodToJsonSchema(BochaWebSearchArgsSchema) as ToolInput
          }
        ]
      }
    })

    // 设置工具调用处理器
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const { name, arguments: args } = request.params

        switch (name) {
          case 'bocha_web_search': {
            const parsed = BochaWebSearchArgsSchema.safeParse(args)
            if (!parsed.success) {
              throw new Error(`无效的搜索参数: ${parsed.error}`)
            }

            const { query, count } = parsed.data

            // 调用Bocha API
            const response = await axios.post(
              'https://api.bochaai.com/v1/web-search',
              {
                query,
                summary: true,
                freshness: 'noLimit',
                count
              },
              {
                headers: {
                  Authorization: `Bearer ${this.apiKey}`,
                  'Content-Type': 'application/json'
                }
              }
            )

            // 处理响应数据
            const searchResponse = response.data as BochaSearchResponse

            if (!searchResponse.data?.webPages?.value) {
              return {
                content: [
                  {
                    type: 'text',
                    text: '搜索未返回任何结果。'
                  }
                ]
              }
            }

            // 将结果转换为MCP资源格式
            const results = searchResponse.data.webPages.value.map((item, index) => {
              // 构建blob内容
              const blobContent = {
                title: item.name,
                url: item.url,
                rank: index + 1,
                content: item.snippet,
                icon: item.siteIcon
              }

              return {
                type: 'resource',
                resource: {
                  uri: item.url,
                  mimeType: 'application/deepchat-webpage',
                  text: JSON.stringify(blobContent)
                }
              }
            })

            // 添加搜索摘要
            const summary = {
              type: 'text',
              text: `为您找到关于"${query}"的${results.length}个结果`
            }

            return {
              content: [summary, ...results]
            }
          }

          default:
            throw new Error(`未知工具: ${name}`)
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        return {
          content: [{ type: 'text', text: `错误: ${errorMessage}` }],
          isError: true
        }
      }
    })
  }
}

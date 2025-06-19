import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { Transport } from '@modelcontextprotocol/sdk/shared/transport'
import { MCPTextContent } from '@shared/presenter'

// Schema definitions
const BuiltinKnowledgeSearchArgsSchema = z.object({
  query: z.string().describe('搜索查询内容 (必填)'),
  topK: z.number().optional().default(5).describe('返回结果数量 (默认5条)')
})

export class BuiltinKnowledgeServer {
  private server: Server
  private configs: Array<{
    description: string
    enabled: boolean
  }> = []

  constructor(env?: {
    configs: {
      description: string
      enabled: boolean
    }[]
  }) {
    if (!env) {
      throw new Error('需要提供Builtin知识库配置')
    }
    const envs = env.configs
    if (!Array.isArray(envs) || envs.length === 0) {
      throw new Error('需要提供至少一个Builtin知识库配置')
    }
    for (const env of envs) {
      if (!env.description) {
        throw new Error('需要提供对这个知识库的描述，以方便ai决定是否检索此知识库')
      }
      this.configs.push({
        description: env.description,
        enabled: env.enabled
      })
    }
    this.server = new Server(
      {
        name: 'deepchat-inmemory/builtin-knowledge-server',
        version: '0.1.0'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    )
    this.setupRequestHandlers()
  }

  public startServer(transport: Transport): void {
    this.server.connect(transport)
  }

  private setupRequestHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = this.configs
        .filter((conf) => conf.enabled)
        .map((config, index) => {
          const suffix = this.configs.length > 1 ? `_${index + 1}` : ''
          return {
            name: `builtin_knowledge_search${suffix}`,
            description: config.description,
            inputSchema: zodToJsonSchema(BuiltinKnowledgeSearchArgsSchema)
          }
        })
      return { tools }
    })
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: parameters } = request.params
      if (name.startsWith('builtin_knowledge_search')) {
        try {
          const enabledConfigs = this.configs.filter((config) => config.enabled)
          let configIndex = 0
          const match = name.match(/_([0-9]+)$/)
          if (match) {
            configIndex = parseInt(match[1], 10) - 1
          }
          if (configIndex < 0 || configIndex >= enabledConfigs.length) {
            throw new Error(`无效的知识库索引: ${configIndex}`)
          }
          // 搜索逻辑留空
          return await this.performBuiltinKnowledgeSearch(parameters, configIndex)
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `搜索失败: ${error instanceof Error ? error.message : String(error)}`
              }
            ]
          }
        }
      }
      return {
        content: [
          {
            type: 'text',
            text: `未知工具: ${name}`
          }
        ]
      }
    })
  }

  private async performBuiltinKnowledgeSearch(
    parameters: Record<string, unknown> | undefined,
    configIndex: number = 0
  ): Promise<{ content: MCPTextContent[] }> {
    console.log(parameters, configIndex)
    // 搜索逻辑留空
    return {
      content: [
        {
          type: 'text',
          text: '（内置知识库搜索逻辑未实现）'
        }
      ]
    }
  }
}

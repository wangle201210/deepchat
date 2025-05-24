import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import {
  ListPromptsRequestSchema,
  GetPromptRequestSchema
} from '@modelcontextprotocol/sdk/types.js'
import { Transport } from '@modelcontextprotocol/sdk/shared/transport'
import { presenter } from '@/presenter'

interface PromptDefinition {
  name: string
  description: string
  arguments: Array<{
    name: string
    description: string
    required: boolean
  }>
}

export class CustomPromptsServer {
  private server: Server

  constructor() {
    // 创建服务器实例
    this.server = new Server(
      {
        name: 'deepchat-inmemory/custom-prompts-server',
        version: '0.1.0'
      },
      {
        capabilities: {
          prompts: {}
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

  // 获取提示词列表
  private async getPromptsList(): Promise<PromptDefinition[]> {
    try {
      const prompts = await presenter.configPresenter.getCustomPrompts()

      if (!prompts || prompts.length === 0) {
        return []
      }

      return prompts.map((prompt) => ({
        name: prompt.name,
        description: prompt.description,
        arguments: prompt.parameters
          ? prompt.parameters.map((param) => ({
              name: param.name,
              description: param.description,
              required: !!param.required
            }))
          : []
      }))
    } catch (error) {
      return []
    }
  }

  // 获取提示词内容
  private async getPromptContent(name: string, content: string, args?: Record<string, string>) {
    const prompts = await presenter.configPresenter.getCustomPrompts()
    if (!prompts || prompts.length === 0) throw new Error('No prompts found')

    const prompt = prompts.find((p) => p.name === name)
    if (!prompt) throw new Error('Prompt not found')

    let promptContent = prompt.content

    // 替换参数占位符
    if (args && prompt.parameters) {
      // 遍历所有参数，并替换内容中的{{参数名}}
      for (const param of prompt.parameters) {
        const value = args[param.name] || ''
        promptContent = promptContent.replace(new RegExp(`{{${param.name}}}`, 'g'), value)
      }
    }

    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `${promptContent}\n\n${content}`
          }
        }
      ]
    }
  }

  // 设置请求处理器
  private setupRequestHandlers(): void {
    // 设置提示词列表处理器
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => {
      const prompts = await this.getPromptsList()
      return { prompts }
    })

    // 设置提示词获取处理器
    this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      try {
        const { name, arguments: args } = request.params
        const response = await this.getPromptContent(name, '', args as Record<string, string>)
        return {
          messages: response.messages,
          _meta: {}
        }
      } catch (error) {
        console.error('获取提示词内容失败:', error)
        return {
          messages: [
            {
              role: 'system',
              content: {
                type: 'text',
                text: `Error: ${error instanceof Error ? error.message : String(error)}`
              }
            }
          ],
          _meta: {}
        }
      }
    })
  }
}

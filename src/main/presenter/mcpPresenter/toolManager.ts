import { eventBus } from '@/eventbus'
import { MCP_EVENTS } from '@/events'
import {
  MCPToolCall,
  MCPToolDefinition,
  MCPToolResponse,
  MCPContentItem,
  MCPTextContent,
  IConfigPresenter
} from '@shared/presenter'
import { ServerManager } from './serverManager'
import { McpClient } from './mcpClient'
import { jsonrepair } from 'jsonrepair'

export class ToolManager {
  private configPresenter: IConfigPresenter
  private serverManager: ServerManager

  constructor(configPresenter: IConfigPresenter, serverManager: ServerManager) {
    this.configPresenter = configPresenter
    this.serverManager = serverManager
  }

  public async getRunningClients(): Promise<McpClient[]> {
    return this.serverManager.getRunningClients()
  }

  // 获取所有工具定义
  public async getAllToolDefinitions(): Promise<MCPToolDefinition[]> {
    // 获取运行中的默认客户端
    const clients = await this.serverManager.getRunningClients()

    if (!clients) {
      console.error('未找到正在运行的MCP客户端')
      return []
    }

    try {
      // 转换为MCPToolDefinition格式
      const results: MCPToolDefinition[] = []
      // 获取工具列表
      for (const client of clients) {
        const clientTools = await client.listTools()
        if (clientTools) {
          for (const tool of clientTools) {
            const properties = tool.inputSchema.properties || {}
            const toolProperties = { ...properties }
            for (const key in toolProperties) {
              if (!toolProperties[key].description) {
                toolProperties[key].description = 'Params of ' + key
              }
            }
            results.push({
              type: 'function',
              function: {
                name: tool.name,
                description: tool.description,
                parameters: {
                  type: 'object',
                  properties: toolProperties,
                  required: Array.isArray(tool.inputSchema.required)
                    ? tool.inputSchema.required
                    : []
                }
              },
              server: {
                name: client.serverName,
                icons: client.serverConfig.icons as string,
                description: client.serverConfig.descriptions as string
              }
            })
          }
        }
      }
      return results
    } catch (error) {
      console.error('获取工具定义失败:', error)
      return []
    }
  }

  // 检查工具调用权限
  private checkToolPermission(toolName: string, autoApprove: string[]): boolean {
    // 如果有 'all' 权限，则允许所有操作
    if (autoApprove.includes('all')) {
      return true
    }
    if (toolName.includes('read') || toolName.includes('list') || toolName.includes('get')) {
      return autoApprove.includes('read')
    }
    if (
      toolName.includes('write') ||
      toolName.includes('create') ||
      toolName.includes('update') ||
      toolName.includes('delete')
    ) {
      return autoApprove.includes('write')
    }
    return true
  }

  async callTool(toolCall: MCPToolCall): Promise<MCPToolResponse> {
    try {
      // 解析工具调用参数
      const { name, arguments: argsString } = toolCall.function

      // 记录工具调用的详细输入信息
      console.info('[MCP] ToolManager arg', {
        toolName: name,
        rawArguments: argsString
      })

      let args: Record<string, unknown> | null = null
      try {
        args = JSON.parse(argsString)
      } catch (error: unknown) {
        console.warn(
          'Error parsing tool call arguments:',
          error instanceof Error ? error.message : String(error)
        )
        args = null
      }
      if (args == null) {
        try {
          args = JSON.parse(jsonrepair(argsString))
        } catch (e: unknown) {
          console.error('Error parsing tool call arguments:', e)
          args = {}
        }
      }

      // 获取正在运行的客户端
      const clients = await this.serverManager.getRunningClients()

      if (!clients || clients.length === 0) {
        return {
          toolCallId: toolCall.id,
          content: `Error: MCP服务未运行，请先启动服务`
        }
      }

      // 查找包含该工具的客户端
      let targetClient: McpClient | null = null
      let toolServerName: string | null = null

      for (const client of clients) {
        const clientTools = await client.listTools()
        if (clientTools) {
          for (const tool of clientTools) {
            if (tool.name === name) {
              targetClient = client
              toolServerName = client.serverName
              break
            }
          }
        }
        if (targetClient) break
      }

      if (!targetClient || !toolServerName) {
        return {
          toolCallId: toolCall.id,
          content: `Error: 未找到工具 ${name}`
        }
      }

      // 获取服务器配置
      const servers = await this.configPresenter.getMcpServers()
      const serverConfig = servers[toolServerName]
      const autoApprove = serverConfig?.autoApprove || []
      console.log('autoApprove', autoApprove, toolServerName)
      // 检查权限
      const hasPermission = this.checkToolPermission(name, autoApprove)

      // 如果没有权限，则拒绝操作
      if (!hasPermission) {
        return {
          toolCallId: toolCall.id,
          content: `Error: Operation not permitted. The '${name}' operation requires appropriate permissions.`
        }
      }

      // 调用 MCP 工具
      const result = await targetClient.callTool(name, args || {})

      // 格式化返回的内容
      let formattedContent: string | MCPContentItem[] = ''

      // 检查返回内容类型并进行适当处理
      if (typeof result.content === 'string') {
        formattedContent = result.content
      } else if (Array.isArray(result.content)) {
        // 转换内容项到MCPContentItem类型
        formattedContent = result.content.map((item) => {
          if (typeof item === 'string') {
            return { type: 'text', text: item } as MCPTextContent
          }

          // 已经是正确格式的内容项
          if (item.type === 'text' || item.type === 'image' || item.type === 'resource') {
            return item as MCPContentItem
          }

          // 处理其他格式，转为文本类型
          if (item.type && item.text) {
            return { type: 'text', text: item.text } as MCPTextContent
          }

          // 无法识别的格式，转为JSON字符串
          return { type: 'text', text: JSON.stringify(item) } as MCPTextContent
        })
      } else if (result.content) {
        // 处理非数组非字符串的内容，转为字符串
        formattedContent = JSON.stringify(result.content)
      }

      // 返回工具调用结果
      const response: MCPToolResponse = {
        toolCallId: toolCall.id,
        content: formattedContent,
        isError: result.isError
      }

      // 记录工具调用的详细输出信息
      console.info('[MCP] ToolManager resp', {
        toolName: name,
        isError: result.isError,
        content: formattedContent
      })

      // 触发工具调用结果事件
      eventBus.emit(MCP_EVENTS.TOOL_CALL_RESULT, response)

      return response
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error('Tool call error:', error)
      return {
        toolCallId: toolCall.id,
        content: `Error: ${errorMessage}`
      }
    }
  }
}

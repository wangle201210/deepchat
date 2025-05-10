import {
  IMCPPresenter,
  MCPServerConfig,
  MCPToolDefinition,
  MCPToolCall,
  McpClient,
  MCPToolResponse,
  Prompt,
  ResourceListEntry,
  Resource,
  PromptListEntry
} from '@shared/presenter'
import { ServerManager } from './serverManager'
import { ToolManager } from './toolManager'
import { eventBus } from '@/eventbus'
import { MCP_EVENTS, NOTIFICATION_EVENTS } from '@/events'
import { IConfigPresenter } from '@shared/presenter'
import { getErrorMessageLabels } from '@shared/i18n'

// 定义MCP工具接口
interface MCPTool {
  id: string
  name: string
  type: string
  description: string
  serverName: string
  inputSchema: {
    properties: Record<string, Record<string, unknown>>
    required: string[]
    [key: string]: unknown
  }
}

// 定义各家LLM的工具类型接口
interface OpenAIToolCall {
  function: {
    name: string
    arguments: string
  }
}

interface AnthropicToolUse {
  name: string
  input: Record<string, unknown>
}

interface GeminiFunctionCall {
  name: string
  args: Record<string, unknown>
}

// 定义工具转换接口
interface OpenAITool {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: {
      type: string
      properties: Record<string, Record<string, unknown>>
      required: string[]
    }
  }
}

interface AnthropicTool {
  name: string
  description: string
  input_schema: {
    type: string
    properties: Record<string, Record<string, unknown>>
    required: string[]
  }
}

interface GeminiTool {
  functionDeclarations: {
    name: string
    description: string
    parameters?: {
      type: string
      properties: Record<string, Record<string, unknown>>
      required: string[]
    }
  }[]
}

// 完整版的 McpPresenter 实现
export class McpPresenter implements IMCPPresenter {
  private serverManager: ServerManager
  private toolManager: ToolManager
  private configPresenter: IConfigPresenter

  constructor(configPresenter?: IConfigPresenter) {
    console.log('初始化 MCP Presenter')

    // 如果提供了configPresenter实例，则使用它，否则保持与当前方式兼容
    if (configPresenter) {
      this.configPresenter = configPresenter
    } else {
      // 这里需要处理项目环境下的循环引用问题，通过延迟初始化解决
      // McpPresenter会在Presenter初始化过程中创建，此时presenter还不可用
      // 我们在initialize方法中会设置configPresenter
      this.configPresenter = {} as IConfigPresenter
    }

    this.serverManager = new ServerManager(this.configPresenter)
    this.toolManager = new ToolManager(this.configPresenter, this.serverManager)

    // 应用启动时初始化
    this.initialize()
  }

  private async initialize() {
    try {
      // 如果没有提供configPresenter，从presenter中获取
      if (!this.configPresenter.getLanguage) {
        // 重新创建管理器
        this.serverManager = new ServerManager(this.configPresenter)
        this.toolManager = new ToolManager(this.configPresenter, this.serverManager)
      }

      // 加载配置
      const [servers, defaultServers] = await Promise.all([
        this.configPresenter.getMcpServers(),
        this.configPresenter.getMcpDefaultServers()
      ])

      // 先测试npm registry速度
      console.log('[MCP] 测试npm registry速度...')
      try {
        await this.serverManager.testNpmRegistrySpeed()
        console.log(
          `[MCP] npm registry速度测试完成，选择最佳registry: ${this.serverManager.getNpmRegistry()}`
        )
      } catch (error) {
        console.error('[MCP] npm registry速度测试失败:', error)
      }

      // 如果有默认服务器，尝试启动
      if (defaultServers.length > 0) {
        for (const serverName of defaultServers) {
          if (servers[serverName]) {
            console.log(`[MCP] 尝试启动默认服务器: ${serverName}`)

            try {
              await this.serverManager.startServer(serverName)
              console.log(`[MCP] 默认服务器 ${serverName} 启动成功`)

              // 通知渲染进程服务器已启动
              eventBus.emit(MCP_EVENTS.SERVER_STARTED, serverName)
            } catch (error) {
              console.error(`[MCP] 默认服务器 ${serverName} 启动失败:`, error)
            }
          }
        }
      }
    } catch (error) {
      console.error('[MCP] 初始化失败:', error)
    }
  }

  // 获取MCP服务器配置
  getMcpServers(): Promise<Record<string, MCPServerConfig>> {
    return this.configPresenter.getMcpServers()
  }

  // 获取所有MCP服务器
  async getMcpClients(): Promise<McpClient[]> {
    const clients = await this.toolManager.getRunningClients()
    const clientsList: McpClient[] = []
    for (const client of clients) {
      const results: MCPToolDefinition[] = []
      const tools = await client.listTools()
      for (const tool of tools) {
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
              required: Array.isArray(tool.inputSchema.required) ? tool.inputSchema.required : []
            }
          },
          server: {
            name: client.serverName,
            icons: client.serverConfig['icons'] as string,
            description: client.serverConfig['description'] as string
          }
        })
      }

      // 创建客户端基本信息对象
      const clientObj: McpClient = {
        name: client.serverName,
        icon: client.serverConfig['icons'] as string,
        isRunning: client.isServerRunning(),
        tools: results
      }

      // 检查并添加 prompts（如果支持）
      if (typeof client.listPrompts === 'function') {
        try {
          const prompts = await client.listPrompts()
          if (prompts && prompts.length > 0) {
            clientObj.prompts = prompts
          }
        } catch (error) {
          console.error(`[MCP] 获取客户端 ${client.serverName} 的提示模板失败:`, error)
        }
      }

      // 检查并添加 resources（如果支持）
      if (typeof client.listResources === 'function') {
        try {
          const resources = await client.listResources()
          if (resources && resources.length > 0) {
            clientObj.resources = resources
          }
        } catch (error) {
          console.error(`[MCP] 获取客户端 ${client.serverName} 的资源失败:`, error)
        }
      }

      clientsList.push(clientObj)
    }
    return clientsList
  }

  // 获取所有默认MCP服务器
  getMcpDefaultServers(): Promise<string[]> {
    return this.configPresenter.getMcpDefaultServers()
  }

  // 添加默认MCP服务器
  async addMcpDefaultServer(serverName: string): Promise<void> {
    await this.configPresenter.addMcpDefaultServer(serverName)
  }

  // 移除默认MCP服务器
  async removeMcpDefaultServer(serverName: string): Promise<void> {
    await this.configPresenter.removeMcpDefaultServer(serverName)
  }

  // 切换服务器的默认状态
  async toggleMcpDefaultServer(serverName: string): Promise<void> {
    await this.configPresenter.toggleMcpDefaultServer(serverName)
  }

  // 添加MCP服务器
  async addMcpServer(serverName: string, config: MCPServerConfig): Promise<boolean> {
    const existingServers = await this.getMcpServers()
    if (existingServers[serverName]) {
      console.error(`[MCP] 添加服务器失败: 服务器名称 "${serverName}" 已存在。`)
      // 获取当前语言并发送通知
      const locale = this.configPresenter.getLanguage?.() || 'zh-CN'
      const errorMessages = getErrorMessageLabels(locale)
      eventBus.emit(NOTIFICATION_EVENTS.SHOW_ERROR, {
        title: errorMessages.addMcpServerErrorTitle || '添加服务器失败',
        message:
          errorMessages.addMcpServerDuplicateMessage?.replace('{serverName}', serverName) ||
          `服务器名称 "${serverName}" 已存在。请选择一个不同的名称。`,
        id: `mcp-error-add-server-${serverName}-${Date.now()}`,
        type: 'error'
      })
      return false
    }
    await this.configPresenter.addMcpServer(serverName, config)
    return true
  }

  // 更新MCP服务器配置
  async updateMcpServer(serverName: string, config: Partial<MCPServerConfig>): Promise<void> {
    const wasRunning = this.serverManager.isServerRunning(serverName)
    await this.configPresenter.updateMcpServer(serverName, config)

    // 如果服务器之前正在运行，则重启它以应用新配置
    if (wasRunning) {
      console.log(`[MCP] 配置已更新，正在重启服务器: ${serverName}`)
      try {
        await this.stopServer(serverName) // stopServer 会发出 SERVER_STOPPED 事件
        await this.startServer(serverName) // startServer 会发出 SERVER_STARTED 事件
        console.log(`[MCP] 服务器 ${serverName} 重启成功`)
      } catch (error) {
        console.error(`[MCP] 重启服务器 ${serverName} 失败:`, error)
        // 即使重启失败，也要确保状态正确，标记为未运行
        eventBus.emit(MCP_EVENTS.SERVER_STOPPED, serverName)
      }
    }
  }

  // 移除MCP服务器
  async removeMcpServer(serverName: string): Promise<void> {
    // 如果服务器正在运行，先停止
    if (await this.isServerRunning(serverName)) {
      await this.stopServer(serverName)
    }
    await this.configPresenter.removeMcpServer(serverName)
  }

  async isServerRunning(serverName: string): Promise<boolean> {
    return Promise.resolve(this.serverManager.isServerRunning(serverName))
  }

  async startServer(serverName: string): Promise<void> {
    await this.serverManager.startServer(serverName)
    // 通知渲染进程服务器已启动
    eventBus.emit(MCP_EVENTS.SERVER_STARTED, serverName)
  }

  async stopServer(serverName: string): Promise<void> {
    await this.serverManager.stopServer(serverName)
    // 通知渲染进程服务器已停止
    eventBus.emit(MCP_EVENTS.SERVER_STOPPED, serverName)
  }

  async getAllToolDefinitions(): Promise<MCPToolDefinition[]> {
    const enabled = await this.configPresenter.getMcpEnabled()
    if (enabled) {
      return this.toolManager.getAllToolDefinitions()
    }
    return []
  }

  /**
   * 获取所有客户端的提示模板，并附加客户端信息
   * @returns 所有提示模板列表，每个提示模板附带所属客户端信息
   */
  async getAllPrompts(): Promise<Array<PromptListEntry>> {
    const enabled = await this.configPresenter.getMcpEnabled()
    if (!enabled) {
      return []
    }

    const clients = await this.toolManager.getRunningClients()
    const promptsList: Array<Prompt & { client: { name: string; icon: string } }> = []

    for (const client of clients) {
      if (typeof client.listPrompts === 'function') {
        try {
          const prompts = await client.listPrompts()
          if (prompts && prompts.length > 0) {
            // 为每个提示模板添加客户端信息
            const clientPrompts = prompts.map((prompt) => ({
              ...prompt,
              client: {
                name: client.serverName,
                icon: client.serverConfig['icons'] as string
              }
            }))
            promptsList.push(...clientPrompts)
          }
        } catch (error) {
          console.error(`[MCP] 获取客户端 ${client.serverName} 的提示模板失败:`, error)
        }
      }
    }

    return promptsList
  }

  /**
   * 获取所有客户端的资源列表，并附加客户端信息
   * @returns 所有资源列表，每个资源附带所属客户端信息
   */
  async getAllResources(): Promise<
    Array<ResourceListEntry & { client: { name: string; icon: string } }>
  > {
    const enabled = await this.configPresenter.getMcpEnabled()
    if (!enabled) {
      return []
    }

    const clients = await this.toolManager.getRunningClients()
    const resourcesList: Array<ResourceListEntry & { client: { name: string; icon: string } }> = []

    for (const client of clients) {
      if (typeof client.listResources === 'function') {
        try {
          const resources = await client.listResources()
          if (resources && resources.length > 0) {
            // 为每个资源添加客户端信息
            const clientResources = resources.map((resource) => ({
              ...resource,
              client: {
                name: client.serverName,
                icon: client.serverConfig['icons'] as string
              }
            }))
            resourcesList.push(...clientResources)
          }
        } catch (error) {
          console.error(`[MCP] 获取客户端 ${client.serverName} 的资源失败:`, error)
        }
      }
    }

    return resourcesList
  }

  async callTool(request: MCPToolCall): Promise<{ content: string; rawData: MCPToolResponse }> {
    const toolCallResult = await this.toolManager.callTool(request)

    // 格式化工具调用结果为大模型易于解析的字符串
    let formattedContent = ''

    // 判断内容类型
    if (typeof toolCallResult.content === 'string') {
      // 内容已经是字符串
      formattedContent = toolCallResult.content
    } else if (Array.isArray(toolCallResult.content)) {
      // 内容是结构化数组，需要格式化
      const contentParts: string[] = []

      // 处理每个内容项
      for (const item of toolCallResult.content) {
        if (item.type === 'text') {
          contentParts.push(item.text)
        } else if (item.type === 'image') {
          contentParts.push(`[图片: ${item.mimeType}]`)
        } else if (item.type === 'resource') {
          if ('text' in item.resource && item.resource.text) {
            contentParts.push(`[资源: ${item.resource.uri}]\n${item.resource.text}`)
          } else if ('blob' in item.resource) {
            contentParts.push(`[二进制资源: ${item.resource.uri}]`)
          } else {
            contentParts.push(`[资源: ${item.resource.uri}]`)
          }
        } else {
          // 处理其他未知类型
          contentParts.push(JSON.stringify(item))
        }
      }

      // 合并所有内容
      formattedContent = contentParts.join('\n\n')
    }

    // 添加错误标记（如果有）
    if (toolCallResult.isError) {
      formattedContent = `错误: ${formattedContent}`
    }

    return { content: formattedContent, rawData: toolCallResult }
  }

  // 将MCPToolDefinition转换为MCPTool
  private mcpToolDefinitionToMcpTool(
    toolDefinition: MCPToolDefinition,
    serverName: string
  ): MCPTool {
    const mcpTool = {
      id: toolDefinition.function.name,
      name: toolDefinition.function.name,
      type: toolDefinition.type,
      description: toolDefinition.function.description,
      serverName,
      inputSchema: {
        properties: toolDefinition.function.parameters.properties as Record<
          string,
          Record<string, unknown>
        >,
        type: toolDefinition.function.parameters.type,
        required: toolDefinition.function.parameters.required
      }
    } as MCPTool
    return mcpTool
  }

  // 工具属性过滤函数
  private filterPropertieAttributes(tool: MCPTool): Record<string, Record<string, unknown>> {
    const supportedAttributes = [
      'type',
      'nullable',
      'description',
      'properties',
      'items',
      'enum',
      'anyOf'
    ]

    const properties = tool.inputSchema.properties
    const getSubMap = (obj: Record<string, unknown>, keys: string[]): Record<string, unknown> => {
      return Object.fromEntries(Object.entries(obj).filter(([key]) => keys.includes(key)))
    }

    const result: Record<string, Record<string, unknown>> = {}
    for (const [key, val] of Object.entries(properties)) {
      result[key] = getSubMap(val, supportedAttributes)
    }

    return result
  }

  // 新增工具转换方法
  /**
   * 将MCP工具定义转换为OpenAI工具格式
   * @param mcpTools MCP工具定义数组
   * @param serverName 服务器名称
   * @returns OpenAI工具格式的工具定义
   */
  async mcpToolsToOpenAITools(
    mcpTools: MCPToolDefinition[],
    serverName: string
  ): Promise<OpenAITool[]> {
    const openaiTools: OpenAITool[] = mcpTools.map((toolDef) => {
      const tool = this.mcpToolDefinitionToMcpTool(toolDef, serverName)
      return {
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: {
            type: 'object',
            properties: this.filterPropertieAttributes(tool),
            required: tool.inputSchema.required || []
          }
        }
      }
    })
    // console.log('openaiTools', JSON.stringify(openaiTools))
    return openaiTools
  }

  /**
   * 将OpenAI工具调用转换回MCP工具调用
   * @param mcpTools MCP工具定义数组
   * @param llmTool OpenAI工具调用
   * @param serverName 服务器名称
   * @returns 匹配的MCP工具调用
   */
  async openAIToolsToMcpTool(
    llmTool: OpenAIToolCall,
    providerId: string
  ): Promise<MCPToolCall | undefined> {
    const mcpTools = await this.getAllToolDefinitions()
    const tool = mcpTools.find((tool) => tool.function.name === llmTool.function.name)
    if (!tool) {
      return undefined
    }

    // 创建MCP工具调用
    const mcpToolCall: MCPToolCall = {
      id: `${providerId}:${tool.function.name}-${Date.now()}`, // 生成唯一ID，包含服务器名称
      type: tool.type,
      function: {
        name: tool.function.name,
        arguments: llmTool.function.arguments
      },
      server: {
        name: tool.server.name,
        icons: tool.server.icons,
        description: tool.server.description
      }
    }
    // console.log('mcpToolCall', mcpToolCall, tool)

    return mcpToolCall
  }

  /**
   * 将MCP工具定义转换为Anthropic工具格式
   * @param mcpTools MCP工具定义数组
   * @param serverName 服务器名称
   * @returns Anthropic工具格式的工具定义
   */
  async mcpToolsToAnthropicTools(
    mcpTools: MCPToolDefinition[],
    serverName: string
  ): Promise<AnthropicTool[]> {
    return mcpTools.map((toolDef) => {
      const tool = this.mcpToolDefinitionToMcpTool(toolDef, serverName)
      return {
        name: tool.name,
        description: tool.description,
        input_schema: {
          type: 'object',
          properties: tool.inputSchema.properties,
          required: tool.inputSchema.required as string[]
        }
      }
    })
  }

  /**
   * 将Anthropic工具使用转换回MCP工具调用
   * @param mcpTools MCP工具定义数组
   * @param toolUse Anthropic工具使用
   * @param serverName 服务器名称
   * @returns 匹配的MCP工具调用
   */
  async anthropicToolUseToMcpTool(
    toolUse: AnthropicToolUse,
    providerId: string
  ): Promise<MCPToolCall | undefined> {
    const mcpTools = await this.getAllToolDefinitions()

    const tool = mcpTools.find((tool) => tool.function.name === toolUse.name)
    // console.log('tool', tool, toolUse)
    if (!tool) {
      return undefined
    }

    // 创建MCP工具调用
    const mcpToolCall: MCPToolCall = {
      id: `${providerId}:${tool.function.name}-${Date.now()}`, // 生成唯一ID，包含服务器名称
      type: tool.type,
      function: {
        name: tool.function.name,
        arguments: JSON.stringify(toolUse.input)
      },
      server: {
        name: tool.server.name,
        icons: tool.server.icons,
        description: tool.server.description
      }
    }

    return mcpToolCall
  }

  /**
   * 将MCP工具定义转换为Gemini工具格式
   * @param mcpTools MCP工具定义数组
   * @param serverName 服务器名称
   * @returns Gemini工具格式的工具定义
   */
  async mcpToolsToGeminiTools(
    mcpTools: MCPToolDefinition[] | undefined,
    serverName: string
  ): Promise<GeminiTool[]> {
    if (!mcpTools || mcpTools.length === 0) {
      return []
    }

    // 递归清理Schema对象，确保符合Gemini API要求
    const cleanSchema = (schema: Record<string, unknown>): Record<string, unknown> => {
      const allowedTopLevelFields = [
        'type',
        'description',
        'enum',
        'properties',
        'items',
        'nullable',
        'anyOf'
      ]

      // 创建新对象，只保留允许的字段
      const cleanedSchema: Record<string, unknown> = {}

      // 处理允许的顶级字段
      for (const field of allowedTopLevelFields) {
        if (field in schema) {
          if (field === 'properties' && typeof schema.properties === 'object') {
            // 递归处理properties中的每个属性
            const properties = schema.properties as Record<string, unknown>
            const cleanedProperties: Record<string, unknown> = {}

            for (const [propName, propValue] of Object.entries(properties)) {
              if (typeof propValue === 'object' && propValue !== null) {
                cleanedProperties[propName] = cleanSchema(propValue as Record<string, unknown>)
              } else {
                cleanedProperties[propName] = propValue
              }
            }

            cleanedSchema.properties = cleanedProperties
          } else if (field === 'items' && typeof schema.items === 'object') {
            // 递归处理items对象
            cleanedSchema.items = cleanSchema(schema.items as Record<string, unknown>)
          } else if (field === 'anyOf' && Array.isArray(schema.anyOf)) {
            // 递归处理anyOf数组中的每个选项
            cleanedSchema.anyOf = (schema.anyOf as Array<Record<string, unknown>>).map((item) =>
              cleanSchema(item)
            )
          } else {
            // 其他字段直接复制
            cleanedSchema[field] = schema[field]
          }
        }
      }

      return cleanedSchema
    }

    // 处理每个工具定义，构建符合Gemini API的函数声明
    const functionDeclarations = mcpTools.map((toolDef) => {
      // 转换为内部工具表示
      const tool = this.mcpToolDefinitionToMcpTool(toolDef, serverName)

      // 获取参数属性
      const properties = tool.inputSchema.properties
      const processedProperties: Record<string, Record<string, unknown>> = {}

      // 处理每个属性，应用清理函数
      for (const [propName, propValue] of Object.entries(properties)) {
        if (typeof propValue === 'object' && propValue !== null) {
          processedProperties[propName] = cleanSchema(propValue as Record<string, unknown>)
        }
      }

      // 准备函数声明结构
      const functionDeclaration = {
        name: tool.id,
        description: tool.description
      } as {
        name: string
        description: string
        parameters?: {
          type: string
          properties: Record<string, Record<string, unknown>>
          required: string[]
        }
      }
      if (Object.keys(processedProperties).length > 0) {
        functionDeclaration.parameters = {
          type: 'object',
          properties: processedProperties,
          required: tool.inputSchema.required || []
        }
      }

      // 记录没有参数的函数
      if (Object.keys(processedProperties).length === 0) {
        console.log(`[MCP] 函数 ${tool.id} 没有参数，提供了最小化的参数结构`)
      }

      return functionDeclaration
    })

    // 返回符合Gemini工具格式的结果
    return [
      {
        functionDeclarations
      }
    ]
  }

  /**
   * 将Gemini函数调用转换回MCP工具调用
   * @param mcpTools MCP工具定义数组
   * @param fcall Gemini函数调用
   * @param serverName 服务器名称
   * @returns 匹配的MCP工具调用
   */
  async geminiFunctionCallToMcpTool(
    fcall: GeminiFunctionCall | undefined,
    providerId: string
  ): Promise<MCPToolCall | undefined> {
    const mcpTools = await this.getAllToolDefinitions()
    if (!fcall) return undefined
    if (!mcpTools) return undefined

    const tool = mcpTools.find((tool) => tool.function.name === fcall.name)
    if (!tool) {
      return undefined
    }

    // 创建MCP工具调用
    const mcpToolCall: MCPToolCall = {
      id: `${providerId}:${tool.function.name}-${Date.now()}`, // 生成唯一ID，包含服务器名称
      type: tool.type,
      function: {
        name: tool.function.name,
        arguments: JSON.stringify(fcall.args)
      },
      server: {
        name: tool.server.name,
        icons: tool.server.icons,
        description: tool.server.description
      }
    }

    return mcpToolCall
  }

  // 获取MCP启用状态
  async getMcpEnabled(): Promise<boolean> {
    return this.configPresenter.getMcpEnabled()
  }

  // 设置MCP启用状态
  async setMcpEnabled(enabled: boolean): Promise<void> {
    await this.configPresenter?.setMcpEnabled(enabled)
  }

  async resetToDefaultServers(): Promise<void> {
    await this.configPresenter?.getMcpConfHelper().resetToDefaultServers()
  }

  /**
   * 获取指定提示模板
   * @param prompt 提示模板对象（包含客户端信息）
   * @param params 提示模板参数
   * @returns 提示模板内容
   */
  async getPrompt(prompt: PromptListEntry, args?: Record<string, unknown>): Promise<unknown> {
    const enabled = await this.configPresenter.getMcpEnabled()
    if (!enabled) {
      throw new Error('MCP功能已禁用')
    }

    // 传递客户端信息和提示模板名称给toolManager
    return this.toolManager.getPromptByClient(prompt.client.name, prompt.name, args)
  }

  /**
   * 读取指定资源
   * @param resource 资源对象（包含客户端信息）
   * @returns 资源内容
   */
  async readResource(resource: ResourceListEntry): Promise<Resource> {
    const enabled = await this.configPresenter.getMcpEnabled()
    if (!enabled) {
      throw new Error('MCP功能已禁用')
    }

    // 传递客户端信息和资源URI给toolManager
    return this.toolManager.readResourceByClient(resource.client.name, resource.uri)
  }
}

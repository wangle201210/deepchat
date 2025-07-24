import type { Message, UserMessageContent, AssistantMessageBlock } from '@shared/chat'
import type { CONVERSATION } from '@shared/presenter'

export interface ExportData {
  conversation: CONVERSATION
  messages: Message[]
  format: 'markdown' | 'html' | 'txt'
}

export interface ExportProgress {
  type: 'progress'
  current: number
  total: number
  message: string
}

export interface ExportComplete {
  type: 'complete'
  content: string
  filename: string
}

export interface ExportError {
  type: 'error'
  error: string
}

export type ExportResult = ExportProgress | ExportComplete | ExportError

// Worker 入口点
self.onmessage = function(e: MessageEvent<ExportData>) {
  const { conversation, messages, format } = e.data
  
  try {
    exportConversation(conversation, messages, format)
  } catch (error) {
    const errorResult: ExportError = {
      type: 'error',
      error: error instanceof Error ? error.message : String(error)
    }
    self.postMessage(errorResult)
  }
}

function exportConversation(conversation: CONVERSATION, messages: Message[], format: string) {
  // 发送开始信号
  const startProgress: ExportProgress = {
    type: 'progress',
    current: 0,
    total: messages.length,
    message: '开始导出...'
  }
  self.postMessage(startProgress)

  let content: string
  let filename: string

  switch (format) {
    case 'markdown':
      content = exportToMarkdown(conversation, messages)
      filename = `${sanitizeFilename(conversation.title)}.md`
      break
    case 'html':
      content = exportToHtml(conversation, messages)
      filename = `${sanitizeFilename(conversation.title)}.html`
      break
    case 'txt':
      content = exportToText(conversation, messages)
      filename = `${sanitizeFilename(conversation.title)}.txt`
      break
    default:
      throw new Error(`不支持的导出格式: ${format}`)
  }

  const completeResult: ExportComplete = {
    type: 'complete',
    content,
    filename
  }
  self.postMessage(completeResult)
}

function sanitizeFilename(filename: string): string {
  return filename.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '_')
}

function formatUserMessageContent(content: any[]): string {
  return content
    .map((block) => {
      if (block.type === 'mention') {
        if (block.category === 'resources') {
          return `@${block.content}`
        } else if (block.category === 'tools') {
          return `@${block.id}`
        } else if (block.category === 'files') {
          return `@${block.id}`
        } else if (block.category === 'prompts') {
          try {
            // 尝试解析prompt内容
            const promptData = JSON.parse(block.content)
            // 如果包含messages数组，尝试提取其中的文本内容
            if (promptData && Array.isArray(promptData.messages)) {
              const messageTexts = promptData.messages
                .map((msg: any) => {
                  if (typeof msg.content === 'string') {
                    return msg.content
                  } else if (msg.content && msg.content.type === 'text') {
                    return msg.content.text
                  } else {
                    // 对于其他类型的内容（如图片等），返回空字符串或特定标记
                    return `[${msg.content?.type || 'content'}]`
                  }
                })
                .filter(Boolean)
                .join('\n')
              return `@${block.id} <prompts>${messageTexts || block.content}</prompts>`
            }
          } catch (e) {
            // 如果解析失败，直接返回原始内容
            console.log('解析prompt内容失败:', e)
          }
          // 默认返回原内容
          return `@${block.id} <prompts>${block.content}</prompts>`
        }
        return `@${block.id}`
      } else if (block.type === 'text') {
        return block.content
      } else if (block.type === 'code') {
        return `\`\`\`${block.content}\`\`\``
      }
      return ''
    })
    .join('')
}

function exportToMarkdown(conversation: CONVERSATION, messages: Message[]): string {
  const lines: string[] = []
  
  // 标题和元信息
  lines.push(`# ${conversation.title}`)
  lines.push('')
  lines.push(`**导出时间:** ${new Date().toLocaleString()}`)
  lines.push(`**会话ID:** ${conversation.id}`)
  lines.push(`**消息数量:** ${messages.length}`)
  if (conversation.settings.modelId) {
    lines.push(`**模型:** ${conversation.settings.modelId}`)
  }
  if (conversation.settings.providerId) {
    lines.push(`**提供商:** ${conversation.settings.providerId}`)
  }
  lines.push('')
  lines.push('---')
  lines.push('')

  // 处理每条消息
  messages.forEach((message, index) => {
    // 发送进度更新
    const progress: ExportProgress = {
      type: 'progress',
      current: index + 1,
      total: messages.length,
      message: `处理第 ${index + 1}/${messages.length} 条消息...`
    }
    self.postMessage(progress)

    const messageTime = new Date(message.timestamp).toLocaleString()
    
    if (message.role === 'user') {
      lines.push(`## 👤 用户 (${messageTime})`)
      lines.push('')
      
      const userContent = message.content as UserMessageContent
      const messageText = userContent.content 
        ? formatUserMessageContent(userContent.content)
        : userContent.text
      
      lines.push(messageText)
      
      // 处理文件附件
      if (userContent.files && userContent.files.length > 0) {
        lines.push('')
        lines.push('**附件:**')
        for (const file of userContent.files) {
          lines.push(`- ${file.name} (${file.mimeType})`)
        }
      }
      
      // 处理链接
      if (userContent.links && userContent.links.length > 0) {
        lines.push('')
        lines.push('**链接:**')
        for (const link of userContent.links) {
          lines.push(`- ${link}`)
        }
      }
      
    } else if (message.role === 'assistant') {
      lines.push(`## 🤖 助手 (${messageTime})`)
      lines.push('')
      
      const assistantBlocks = message.content as AssistantMessageBlock[]
      
      for (const block of assistantBlocks) {
        switch (block.type) {
          case 'content':
            if (block.content) {
              lines.push(block.content)
              lines.push('')
            }
            break
            
          case 'reasoning_content':
            if (block.content) {
              lines.push('### 🤔 思考过程')
              lines.push('')
              lines.push('```')
              lines.push(block.content)
              lines.push('```')
              lines.push('')
            }
            break
            
          case 'tool_call':
            if (block.tool_call) {
              lines.push(`### 🔧 工具调用: ${block.tool_call.name}`)
              lines.push('')
              if (block.tool_call.params) {
                lines.push('**参数:**')
                lines.push('```json')
                try {
                  const params = JSON.parse(block.tool_call.params)
                  lines.push(JSON.stringify(params, null, 2))
                } catch {
                  lines.push(block.tool_call.params)
                }
                lines.push('```')
                lines.push('')
              }
              if (block.tool_call.response) {
                lines.push('**响应:**')
                lines.push('```')
                lines.push(block.tool_call.response)
                lines.push('```')
                lines.push('')
              }
            }
            break
            
          case 'search':
            lines.push('### 🔍 网络搜索')
            if (block.extra?.total) {
              lines.push(`找到 ${block.extra.total} 个搜索结果`)
            }
            lines.push('')
            break
            
          case 'image':
            lines.push('### 🖼️ 图片')
            lines.push('*[图片内容]*')
            lines.push('')
            break
            
          case 'error':
            if (block.content) {
              lines.push(`### ❌ 错误`)
              lines.push('')
              lines.push(`\`${block.content}\``)
              lines.push('')
            }
            break

          case 'artifact-thinking':
            if (block.content) {
              lines.push('### 💭 创作思考')
              lines.push('')
              lines.push('```')
              lines.push(block.content)
              lines.push('```')
              lines.push('')
            }
            break
        }
      }
      
      // 添加使用情况信息
      if (message.usage) {
        lines.push('**使用情况:**')
        lines.push(`- 输入 Token: ${message.usage.input_tokens}`)
        lines.push(`- 输出 Token: ${message.usage.output_tokens}`)
        lines.push(`- 总计 Token: ${message.usage.total_tokens}`)
        if (message.usage.generation_time) {
          lines.push(`- 生成时间: ${(message.usage.generation_time / 1000).toFixed(2)}秒`)
        }
        if (message.usage.tokens_per_second) {
          lines.push(`- 生成速度: ${message.usage.tokens_per_second.toFixed(2)} tokens/秒`)
        }
        lines.push('')
      }
    }
    
    lines.push('---')
    lines.push('')
  })

  return lines.join('\n')
}

function exportToHtml(conversation: CONVERSATION, messages: Message[]): string {
  const lines: string[] = []
  
  // HTML 头部
  lines.push('<!DOCTYPE html>')
  lines.push('<html lang="zh-CN">')
  lines.push('<head>')
  lines.push('  <meta charset="UTF-8">')
  lines.push('  <meta name="viewport" content="width=device-width, initial-scale=1.0">')
  lines.push(`  <title>${escapeHtml(conversation.title)}</title>`)
  lines.push('  <style>')
  lines.push('    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }')
  lines.push('    .header { border-bottom: 2px solid #e1e5e9; padding-bottom: 20px; margin-bottom: 30px; }')
  lines.push('    .message { margin-bottom: 30px; border-left: 4px solid #ddd; padding-left: 20px; }')
  lines.push('    .user-message { border-left-color: #007bff; }')
  lines.push('    .assistant-message { border-left-color: #28a745; }')
  lines.push('    .message-header { font-weight: bold; margin-bottom: 10px; color: #495057; }')
  lines.push('    .message-time { font-size: 0.9em; color: #6c757d; }')
  lines.push('    .tool-call { background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; padding: 15px; margin: 10px 0; }')
  lines.push('    .search-block { background: #e3f2fd; border: 1px solid #bbdefb; border-radius: 8px; padding: 15px; margin: 10px 0; }')
  lines.push('    .error-block { background: #ffebee; border: 1px solid #ffcdd2; border-radius: 8px; padding: 15px; margin: 10px 0; color: #c62828; }')
  lines.push('    .reasoning-block { background: #f3e5f5; border: 1px solid #e1bee7; border-radius: 8px; padding: 15px; margin: 10px 0; }')
  lines.push('    .code { background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 4px; padding: 10px; font-family: "Monaco", "Consolas", monospace; white-space: pre-wrap; overflow-x: auto; }')
  lines.push('    .usage-info { background: #e8f5e8; border: 1px solid #c3e6c3; border-radius: 8px; padding: 15px; margin: 10px 0; font-size: 0.9em; }')
  lines.push('    .attachments { background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 15px; margin: 10px 0; }')
  lines.push('  </style>')
  lines.push('</head>')
  lines.push('<body>')
  
  // 标题和元信息
  lines.push('  <div class="header">')
  lines.push(`    <h1>${escapeHtml(conversation.title)}</h1>`)
  lines.push(`    <p><strong>导出时间:</strong> ${new Date().toLocaleString()}</p>`)
  lines.push(`    <p><strong>会话ID:</strong> ${conversation.id}</p>`)
  lines.push(`    <p><strong>消息数量:</strong> ${messages.length}</p>`)
  if (conversation.settings.modelId) {
    lines.push(`    <p><strong>模型:</strong> ${escapeHtml(conversation.settings.modelId)}</p>`)
  }
  if (conversation.settings.providerId) {
    lines.push(`    <p><strong>提供商:</strong> ${escapeHtml(conversation.settings.providerId)}</p>`)
  }
  lines.push('  </div>')
  
  // 处理每条消息
  messages.forEach((message, index) => {
    // 发送进度更新
    const progress: ExportProgress = {
      type: 'progress',
      current: index + 1,
      total: messages.length,
      message: `处理第 ${index + 1}/${messages.length} 条消息...`
    }
    self.postMessage(progress)

    const messageTime = new Date(message.timestamp).toLocaleString()
    
    if (message.role === 'user') {
      lines.push(`  <div class="message user-message">`)
      lines.push(`    <div class="message-header">👤 用户 <span class="message-time">(${messageTime})</span></div>`)
      
      const userContent = message.content as UserMessageContent
      const messageText = userContent.content 
        ? formatUserMessageContent(userContent.content)
        : userContent.text
      
      lines.push(`    <div>${escapeHtml(messageText).replace(/\n/g, '<br>')}</div>`)
      
      // 处理文件附件
      if (userContent.files && userContent.files.length > 0) {
        lines.push('    <div class="attachments">')
        lines.push('      <strong>附件:</strong>')
        lines.push('      <ul>')
        for (const file of userContent.files) {
          lines.push(`        <li>${escapeHtml(file.name)} (${escapeHtml(file.mimeType)})</li>`)
        }
        lines.push('      </ul>')
        lines.push('    </div>')
      }
      
      // 处理链接
      if (userContent.links && userContent.links.length > 0) {
        lines.push('    <div class="attachments">')
        lines.push('      <strong>链接:</strong>')
        lines.push('      <ul>')
        for (const link of userContent.links) {
          lines.push(`        <li><a href="${escapeHtml(link)}" target="_blank">${escapeHtml(link)}</a></li>`)
        }
        lines.push('      </ul>')
        lines.push('    </div>')
      }
      
      lines.push('  </div>')
      
    } else if (message.role === 'assistant') {
      lines.push(`  <div class="message assistant-message">`)
      lines.push(`    <div class="message-header">🤖 助手 <span class="message-time">(${messageTime})</span></div>`)
      
      const assistantBlocks = message.content as AssistantMessageBlock[]
      
      for (const block of assistantBlocks) {
        switch (block.type) {
          case 'content':
            if (block.content) {
              lines.push(`    <div>${escapeHtml(block.content).replace(/\n/g, '<br>')}</div>`)
            }
            break
            
          case 'reasoning_content':
            if (block.content) {
              lines.push('    <div class="reasoning-block">')
              lines.push('      <strong>🤔 思考过程:</strong>')
              lines.push(`      <div class="code">${escapeHtml(block.content)}</div>`)
              lines.push('    </div>')
            }
            break
            
          case 'tool_call':
            if (block.tool_call) {
              lines.push('    <div class="tool-call">')
              lines.push(`      <strong>🔧 工具调用: ${escapeHtml(block.tool_call.name || '')}</strong>`)
              if (block.tool_call.params) {
                lines.push('      <div><strong>参数:</strong></div>')
                lines.push(`      <div class="code">${escapeHtml(block.tool_call.params)}</div>`)
              }
              if (block.tool_call.response) {
                lines.push('      <div><strong>响应:</strong></div>')
                lines.push(`      <div class="code">${escapeHtml(block.tool_call.response)}</div>`)
              }
              lines.push('    </div>')
            }
            break
            
          case 'search':
            lines.push('    <div class="search-block">')
            lines.push('      <strong>🔍 网络搜索</strong>')
            if (block.extra?.total) {
              lines.push(`      <p>找到 ${block.extra.total} 个搜索结果</p>`)
            }
            lines.push('    </div>')
            break
            
          case 'image':
            lines.push('    <div class="tool-call">')
            lines.push('      <strong>🖼️ 图片</strong>')
            lines.push('      <p><em>[图片内容]</em></p>')
            lines.push('    </div>')
            break
            
          case 'error':
            if (block.content) {
              lines.push('    <div class="error-block">')
              lines.push('      <strong>❌ 错误</strong>')
              lines.push(`      <p><code>${escapeHtml(block.content)}</code></p>`)
              lines.push('    </div>')
            }
            break

          case 'artifact-thinking':
            if (block.content) {
              lines.push('    <div class="reasoning-block">')
              lines.push('      <strong>💭 创作思考:</strong>')
              lines.push(`      <div class="code">${escapeHtml(block.content)}</div>`)
              lines.push('    </div>')
            }
            break
        }
      }
      
      // 添加使用情况信息
      if (message.usage) {
        lines.push('    <div class="usage-info">')
        lines.push('      <strong>使用情况:</strong>')
        lines.push('      <ul>')
        lines.push(`        <li>输入 Token: ${message.usage.input_tokens}</li>`)
        lines.push(`        <li>输出 Token: ${message.usage.output_tokens}</li>`)
        lines.push(`        <li>总计 Token: ${message.usage.total_tokens}</li>`)
        if (message.usage.generation_time) {
          lines.push(`        <li>生成时间: ${(message.usage.generation_time / 1000).toFixed(2)}秒</li>`)
        }
        if (message.usage.tokens_per_second) {
          lines.push(`        <li>生成速度: ${message.usage.tokens_per_second.toFixed(2)} tokens/秒</li>`)
        }
        lines.push('      </ul>')
        lines.push('    </div>')
      }
      
      lines.push('  </div>')
    }
  })

  // HTML 尾部
  lines.push('</body>')
  lines.push('</html>')

  return lines.join('\n')
}

function exportToText(conversation: CONVERSATION, messages: Message[]): string {
  const lines: string[] = []
  
  // 标题和元信息
  lines.push(`${conversation.title}`)
  lines.push(''.padEnd(conversation.title.length, '='))
  lines.push('')
  lines.push(`导出时间: ${new Date().toLocaleString()}`)
  lines.push(`会话ID: ${conversation.id}`)
  lines.push(`消息数量: ${messages.length}`)
  if (conversation.settings.modelId) {
    lines.push(`模型: ${conversation.settings.modelId}`)
  }
  if (conversation.settings.providerId) {
    lines.push(`提供商: ${conversation.settings.providerId}`)
  }
  lines.push('')
  lines.push(''.padEnd(80, '-'))
  lines.push('')

  // 处理每条消息
  messages.forEach((message, index) => {
    // 发送进度更新
    const progress: ExportProgress = {
      type: 'progress',
      current: index + 1,
      total: messages.length,
      message: `处理第 ${index + 1}/${messages.length} 条消息...`
    }
    self.postMessage(progress)

    const messageTime = new Date(message.timestamp).toLocaleString()
    
    if (message.role === 'user') {
      lines.push(`[用户] ${messageTime}`)
      lines.push('')
      
      const userContent = message.content as UserMessageContent
      const messageText = userContent.content 
        ? formatUserMessageContent(userContent.content)
        : userContent.text
      
      lines.push(messageText)
      
      // 处理文件附件
      if (userContent.files && userContent.files.length > 0) {
        lines.push('')
        lines.push('附件:')
        for (const file of userContent.files) {
          lines.push(`- ${file.name} (${file.mimeType})`)
        }
      }
      
      // 处理链接
      if (userContent.links && userContent.links.length > 0) {
        lines.push('')
        lines.push('链接:')
        for (const link of userContent.links) {
          lines.push(`- ${link}`)
        }
      }
      
    } else if (message.role === 'assistant') {
      lines.push(`[助手] ${messageTime}`)
      lines.push('')
      
      const assistantBlocks = message.content as AssistantMessageBlock[]
      
      for (const block of assistantBlocks) {
        switch (block.type) {
          case 'content':
            if (block.content) {
              lines.push(block.content)
              lines.push('')
            }
            break
            
          case 'reasoning_content':
            if (block.content) {
              lines.push('[思考过程]')
              lines.push(block.content)
              lines.push('')
            }
            break
            
          case 'tool_call':
            if (block.tool_call) {
              lines.push(`[工具调用] ${block.tool_call.name}`)
              if (block.tool_call.params) {
                lines.push('参数:')
                lines.push(block.tool_call.params)
              }
              if (block.tool_call.response) {
                lines.push('响应:')
                lines.push(block.tool_call.response)
              }
              lines.push('')
            }
            break
            
          case 'search':
            lines.push('[网络搜索]')
            if (block.extra?.total) {
              lines.push(`找到 ${block.extra.total} 个搜索结果`)
            }
            lines.push('')
            break
            
          case 'image':
            lines.push('[图片内容]')
            lines.push('')
            break
            
          case 'error':
            if (block.content) {
              lines.push(`[错误] ${block.content}`)
              lines.push('')
            }
            break

          case 'artifact-thinking':
            if (block.content) {
              lines.push('[创作思考]')
              lines.push(block.content)
              lines.push('')
            }
            break
        }
      }
      
      // 添加使用情况信息
      if (message.usage) {
        lines.push('[使用情况]')
        lines.push(`输入 Token: ${message.usage.input_tokens}`)
        lines.push(`输出 Token: ${message.usage.output_tokens}`)
        lines.push(`总计 Token: ${message.usage.total_tokens}`)
        if (message.usage.generation_time) {
          lines.push(`生成时间: ${(message.usage.generation_time / 1000).toFixed(2)}秒`)
        }
        if (message.usage.tokens_per_second) {
          lines.push(`生成速度: ${message.usage.tokens_per_second.toFixed(2)} tokens/秒`)
        }
        lines.push('')
      }
    }
    
    lines.push(''.padEnd(80, '-'))
    lines.push('')
  })

  return lines.join('\n')
}

function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}
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
  lines.push('    @media (prefers-color-scheme: dark) {')
  lines.push('      body { background: #0f0f23; color: #e4e4e7; }')
  lines.push('      .header { border-bottom-color: #27272a; }')
  lines.push('      .message { border-left-color: #3f3f46; }')
  lines.push('      .user-message { border-left-color: #3b82f6; background: #1e293b; }')
  lines.push('      .assistant-message { border-left-color: #10b981; background: #064e3b; }')
  lines.push('      .tool-call { background: #1f2937; border-color: #374151; }')
  lines.push('      .search-block { background: #1e3a8a; border-color: #1d4ed8; }')
  lines.push('      .error-block { background: #7f1d1d; border-color: #dc2626; }')
  lines.push('      .reasoning-block { background: #581c87; border-color: #7c3aed; }')
  lines.push('      .code { background: #1f2937; border-color: #374151; color: #f3f4f6; }')
  lines.push('      .attachments { background: #78350f; border-color: #d97706; }')
  lines.push('    }')
  lines.push('    body { font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; line-height: 1.7; max-width: 900px; margin: 0 auto; padding: 32px 24px; background: #ffffff; color: #1f2937; }')
  lines.push('    .header { border-bottom: 1px solid #e5e7eb; padding-bottom: 24px; margin-bottom: 32px; }')
  lines.push('    .header h1 { margin: 0 0 16px 0; font-size: 2rem; font-weight: 700; color: #111827; }')
  lines.push('    .header p { margin: 4px 0; font-size: 0.875rem; color: #6b7280; }')
  lines.push('    .message { margin-bottom: 32px; border-radius: 12px; padding: 20px; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1); }')
  lines.push('    .user-message { background: #f8fafc; border-left: 4px solid #3b82f6; }')
  lines.push('    .assistant-message { background: #f0fdf4; border-left: 4px solid #10b981; }')
  lines.push('    .message-header { font-weight: 600; margin-bottom: 12px; color: #374151; font-size: 1rem; }')
  lines.push('    .message-time { font-size: 0.75rem; color: #9ca3af; font-weight: 400; }')
  lines.push('    .tool-call { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 12px 0; }')
  lines.push('    .search-block { background: #eff6ff; border: 1px solid #dbeafe; border-radius: 8px; padding: 16px; margin: 12px 0; }')
  lines.push('    .error-block { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 12px 0; color: #dc2626; }')
  lines.push('    .reasoning-block { background: #faf5ff; border: 1px solid #e9d5ff; border-radius: 8px; padding: 16px; margin: 12px 0; }')
  lines.push('    .code { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; font-family: ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace; font-size: 0.875rem; white-space: pre-wrap; overflow-x: auto; color: #1e293b; }')
  lines.push('    .attachments { background: #fffbeb; border: 1px solid #fed7aa; border-radius: 8px; padding: 16px; margin: 12px 0; }')
  lines.push('    .attachments ul { margin: 8px 0 0 0; padding-left: 20px; }')
  lines.push('    .attachments li { margin: 4px 0; }')
  lines.push('    a { color: #2563eb; text-decoration: none; }')
  lines.push('    a:hover { text-decoration: underline; }')
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
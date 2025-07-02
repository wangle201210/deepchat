import * as fs from 'node:fs'
import path from 'node:path'

import {
  IConfigPresenter,
  IKnowledgePresenter,
  ILlmProviderPresenter,
  BuiltinKnowledgeConfig,
  MCPServerConfig
} from '@shared/presenter'
import { eventBus } from '@/eventbus'
import { MCP_EVENTS } from '@/events'
import { DuckDBPresenter } from './database/duckdbPresenter'
import { RagPresenter } from './RagPresenter'

export class KnowledgePresenter implements IKnowledgePresenter {
  /**
   * 知识库存储目录
   */
  private readonly storageDir

  private readonly configP: IConfigPresenter

  private readonly llmP: ILlmProviderPresenter

  constructor(configP: IConfigPresenter, llmP: ILlmProviderPresenter, dbDir: string) {
    console.log('[RAG] Initializing Built-in Knowledge Presenter')
    this.configP = configP
    this.llmP = llmP
    this.storageDir = path.join(dbDir, 'KnowledgeBase')

    this.initStorageDir()
    this.setupEventBus()
  }

  /**
   * 初始化知识库存储目录
   */
  private initStorageDir = (): void => {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true })
    }
  }

  private setupEventBus = (): void => {
    // 监听知识库相关事件
    eventBus.on(MCP_EVENTS.CONFIG_CHANGED, async (payload) => {
      try {
        if (
          !payload ||
          typeof payload !== 'object' ||
          !payload.mcpServers ||
          typeof payload.mcpServers !== 'object'
        ) {
          console.warn('[RAG] Invalid payload for CONFIG_CHANGED event:', payload)
          return
        }
        const mcpServers = payload.mcpServers
        const builtinConfig = mcpServers['builtinKnowledge'] as MCPServerConfig
        if (builtinConfig && builtinConfig.env && Array.isArray(builtinConfig.env.configs)) {
          const configs = builtinConfig.env.configs as BuiltinKnowledgeConfig[]
          console.log('[RAG] Received builtinKnowledge config update:', configs)

          const diffs = this.configP.diffKnowledgeConfigs(configs)
          if (diffs.added.length > 0) {
            diffs.added.forEach((config) => {
              console.log(`[RAG] New knowledge config added: ${config.id}`)
              this.create(config)
            })
          }
          if (diffs.updated.length > 0) {
          }
          if (diffs.deleted.length > 0) {
            diffs.deleted.forEach((config) => this.delete(config.id))
          }
          this.configP.setKnowledgeConfigs(configs)
          console.log('[RAG] Updated knowledge configs:', configs)
        } else {
          console.warn('[RAG] builtinKnowledge config missing or invalid:', builtinConfig)
        }
      } catch (err) {
        console.error('[RAG] Error handling CONFIG_CHANGED event:', err)
      }
    })
  }

  /**
   * 创建知识库（初始化 RAG 应用）
   */
  create = async (base: BuiltinKnowledgeConfig): Promise<void> => {
    this.getRagPresenter(base)
  }

  /**
   * 重置知识库内容
   */
  reset = async ({ base }: { base: BuiltinKnowledgeConfig }): Promise<void> => {
    const RagPresenter = await this.getRagPresenter(base)
    await RagPresenter.reset()
  }

  /**
   * 删除知识库（移除本地存储）
   */
  delete = async (id: string): Promise<void> => {
    if (this.ragPresenterCache.has(id)) {
      const rag = this.ragPresenterCache.get(id) as RagPresenter
      rag.destory()
    } else {
      const dbPath = path.join(this.storageDir, id)
      if (fs.existsSync(dbPath)) {
        fs.rmSync(dbPath, { recursive: true })
      }
    }
  }

  /**
   * 缓存 RAG 应用实例
   */
  private ragPresenterCache: Map<string, RagPresenter> = new Map()

  /**
   * 获取或创建 RAG 应用实例
   * @param params BuiltinKnowledgeConfig
   * @returns RagPresenter
   */
  private getRagPresenter = async ({
    id,
    embedding,
    dimensions
  }: BuiltinKnowledgeConfig): Promise<RagPresenter> => {
    // 缓存命中直接返回
    if (this.ragPresenterCache.has(id)) {
      return this.ragPresenterCache.get(id) as RagPresenter
    }

    // 创建代理函数，只暴露 text 参数
    const embeddingProxy = async (texts: string[]) => {
      return this.llmP.getEmbeddings(embedding.modelId, embedding.providerId, texts)
    }

    let rag: RagPresenter
    try {
      rag = new RagPresenter(
        new DuckDBPresenter(path.join(this.storageDir, id), dimensions),
        embeddingProxy
      )
    } catch (e) {
      throw new Error(`Failed to create RagPresenter: ${e}`)
    }

    this.ragPresenterCache.set(id, rag)
    return rag
  }
}

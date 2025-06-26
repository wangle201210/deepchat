import * as fs from 'node:fs'
import path from 'node:path'

import {
  IConfigPresenter,
  IKnowledgePresenter,
  ILlmProviderPresenter,
  KnowledgeBaseParams,
  MCPServerConfig
} from '@shared/presenter'
import Embeddings from './Embeddings'
import { RAGApplication, RAGApplicationBuilder } from '@llm-tools/embedjs'
import { LibSqlDb } from '@llm-tools/embedjs-libsql'
import { eventBus } from '@/eventbus'
import { MCP_EVENTS } from '@/events'

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
          const configs = builtinConfig.env.configs as KnowledgeBaseParams[]
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
  create = async (base: KnowledgeBaseParams): Promise<void> => {
    this.getRagApplication(base)
  }

  /**
   * 重置知识库内容
   */
  reset = async ({ base }: { base: KnowledgeBaseParams }): Promise<void> => {
    const ragApplication = await this.getRagApplication(base)
    await ragApplication.reset()
  }

  /**
   * 删除知识库（移除本地存储）
   */
  delete = async (id: string): Promise<void> => {
    const dbPath = path.join(this.storageDir, id)
    if (fs.existsSync(dbPath)) {
      fs.rmSync(dbPath, { recursive: true })
    }
  }

  /**
   * 获取或创建 RAG 应用实例
   * @param params KnowledgeBaseParams
   * @returns RAGApplication
   */
  private getRagApplication = async ({
    id,
    modelId,
    providerId,
    dimensions
  }: KnowledgeBaseParams): Promise<RAGApplication> => {
    let ragApplication: RAGApplication
    // 创建 Embeddings 实例
    const { apiKey, baseUrl } = this.llmP.getProviderById(providerId)
    const embeddings = new Embeddings({
      providerId,
      modelId,
      apiKey,
      dimensions,
      baseURL: baseUrl
    } as KnowledgeBaseParams)
    try {
      // 构建 RAG 应用，集成嵌入模型与向量数据库
      ragApplication = await new RAGApplicationBuilder()
        .setModel('NO_MODEL')
        .setEmbeddingModel(embeddings)
        .setVectorDatabase(new LibSqlDb({ path: path.join(this.storageDir, id) }))
        .build()
    } catch (e) {
      throw new Error(`Failed to create RAGApplication: ${e}`)
    }

    return ragApplication
  }
}

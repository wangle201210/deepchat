import fs from 'node:fs'
import path from 'node:path'

import {
  IConfigPresenter,
  IKnowledgePresenter,
  BuiltinKnowledgeConfig,
  MCPServerConfig,
  KnowledgeFileMessage
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

  constructor(configP: IConfigPresenter, dbDir: string) {
    console.log('[RAG] Initializing Built-in Knowledge Presenter')
    this.configP = configP
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
          this.configP.setKnowledgeConfigs(configs)
          // 处理新增、删除和更新的配置
          if (diffs.deleted.length > 0) {
            diffs.deleted.forEach((config) => this.delete(config.id))
          }
          if (diffs.added.length > 0) {
            diffs.added.forEach((config) => {
              console.log(`[RAG] New knowledge config added: ${config.id}`)
              this.create(config)
            })
          }
          if (diffs.updated.length > 0) {
          }
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
  create = async (config: BuiltinKnowledgeConfig): Promise<void> => {
    this.createRagPresenter(config)
  }

  /**
   * 重置知识库内容
   */
  reset = async (id: string): Promise<void> => {
    const RagPresenter = await this.getRagPresenter(id)
    await RagPresenter.reset()
  }

  /**
   * 删除知识库（移除本地存储）
   */
  delete = async (id: string): Promise<void> => {
    if (this.ragPresenterCache.has(id)) {
      const rag = this.ragPresenterCache.get(id) as RagPresenter
      await rag.destory()
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
   * 创建 RAG 应用实例
   * @param params BuiltinKnowledgeConfig
   * @returns RagPresenter
   */
  private createRagPresenter = async (config: BuiltinKnowledgeConfig): Promise<RagPresenter> => {
    let rag: RagPresenter
    const db = await this.getVectorDatabasePresenter(
      config.id,
      config.dimensions,
      config.normalized
    )
    try {
      rag = new RagPresenter(db, config)
    } catch (e) {
      throw new Error(`Failed to create RagPresenter: ${e}`)
    }

    this.ragPresenterCache.set(config.id, rag)
    return rag
  }

  /**
   * 获取 RAG 应用实例
   * @param id 知识库 ID
   */
  private getRagPresenter = async (id: string): Promise<RagPresenter> => {
    // 缓存命中直接返回
    if (this.ragPresenterCache.has(id)) {
      return this.ragPresenterCache.get(id) as RagPresenter
    }
    // 获取配置
    const configs = this.configP.getKnowledgeConfigs()
    const config = configs.find((cfg) => cfg.id === id)
    if (!config) {
      throw new Error(`Knowledge config not found for id: ${id}`)
    }
    // DuckDB 存储
    const db = await this.getVectorDatabasePresenter(id, config.dimensions, config.normalized)
    // 创建 RAG 应用实例
    const rag = new RagPresenter(db, config)
    this.ragPresenterCache.set(id, rag)
    return rag
  }

  /**
   * 获取向量数据库实例
   * @param id 知识库 ID
   * @param dimensions 向量维度
   * @returns
   */
  private getVectorDatabasePresenter = async (
    id: string,
    dimensions: number,
    normalized: boolean
  ) => {
    const dbPath = path.join(this.storageDir, id)
    if (fs.existsSync(dbPath)) {
      const db = new DuckDBPresenter(dbPath)
      await db.open()
      return db
    }
    // 如果数据库不存在，则初始化
    const db = new DuckDBPresenter(dbPath)
    await db.initialize(dimensions, {
      metric: normalized ? 'cosine' : 'ip'
    })
    return db
  }

  /**
   * 添加文件到知识库
   * @param id 知识库 ID
   * @param filePath 文件路径
   */
  async addFile(id: string, filePath: string): Promise<void> {
    const rag = await this.getRagPresenter(id)
    await rag.addFile(filePath)
  }

  async deleteFile(id: string, fileId: string): Promise<void> {
    const rag = await this.getRagPresenter(id)
    await rag.deleteFile(fileId)
  }

  async reAddFile(id: string, fileId: string): Promise<void> {
    const rag = await this.getRagPresenter(id)
    await rag.reAddFile(fileId)
  }

  async queryFile(id: string, fileId: string): Promise<KnowledgeFileMessage | null> {
    const rag = await this.getRagPresenter(id)
    return await rag.queryFile(fileId)
  }

  async listFiles(id: string): Promise<KnowledgeFileMessage[]> {
    const rag = await this.getRagPresenter(id)
    return await rag.listFiles()
  }
}

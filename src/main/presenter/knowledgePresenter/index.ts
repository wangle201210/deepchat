import fs from 'node:fs'
import path from 'node:path'

import {
  IConfigPresenter,
  IKnowledgePresenter,
  BuiltinKnowledgeConfig,
  MCPServerConfig,
  KnowledgeFileMessage,
  QueryResult,
  KnowledgeFileResult
} from '@shared/presenter'
import { eventBus } from '@/eventbus'
import { MCP_EVENTS } from '@/events'
import { DuckDBPresenter } from './database/duckdbPresenter'
import { KnowledgeStorePresenter } from './knowledgeStorePresenter'
import { KnowledgeTaskPresenter } from './knowledgeTaskPresenter'

export class KnowledgePresenter implements IKnowledgePresenter {
  /**
   * 知识库存储目录
   */
  private readonly storageDir

  private readonly configP: IConfigPresenter

  /**
   * 全局任务调度器
   */
  private readonly taskP: KnowledgeTaskPresenter

  /**
   * 缓存 RAG 应用实例
   */
  private readonly storePresenterCache: Map<string, KnowledgeStorePresenter>

  constructor(configP: IConfigPresenter, dbDir: string) {
    console.log('[RAG] Initializing Built-in Knowledge Presenter')
    this.configP = configP
    this.storageDir = path.join(dbDir, 'KnowledgeBase')
    this.taskP = new KnowledgeTaskPresenter()
    this.storePresenterCache = new Map()

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
        if (builtinConfig?.env && Array.isArray(builtinConfig.env.configs)) {
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
            diffs.updated.forEach((config) => {
              console.log(`[RAG] Knowledge config updated: ${config.id}`)
              this.update(config)
            })
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
    await this.createStorePresenter(config)
  }

  /**
   * 更新知识库配置
   */
  update = async (config: BuiltinKnowledgeConfig): Promise<void> => {
    // 存在更新，不存在忽略，创建时默认使用新配置
    if (this.storePresenterCache.has(config.id)) {
      const rag = this.storePresenterCache.get(config.id) as KnowledgeStorePresenter
      rag.updateConfig(config)
    }
  }

  /**
   * 删除知识库（移除本地存储）
   */
  delete = async (id: string): Promise<void> => {
    if (this.storePresenterCache.has(id)) {
      const rag = this.storePresenterCache.get(id) as KnowledgeStorePresenter
      await rag.destroy()
      this.storePresenterCache.delete(id)
    } else {
      const dbPath = path.join(this.storageDir, id)
      if (fs.existsSync(dbPath)) {
        fs.rmSync(dbPath, { recursive: true })
      }
    }
  }

  /**
   * 创建 RAG 应用实例
   * @param params BuiltinKnowledgeConfig
   * @returns KnowledgeStorePresenter
   */
  private createStorePresenter = async (
    config: BuiltinKnowledgeConfig
  ): Promise<KnowledgeStorePresenter> => {
    let rag: KnowledgeStorePresenter
    const db = await this.getVectorDatabasePresenter(
      config.id,
      config.dimensions,
      config.normalized
    )
    try {
      rag = new KnowledgeStorePresenter(db, config, this.taskP)
    } catch (e) {
      throw new Error(`Failed to create storePresenter: ${e}`)
    }

    this.storePresenterCache.set(config.id, rag)
    return rag
  }

  /**
   * 获取 RAG 应用实例
   * @param id 知识库 ID
   */
  private getStorePresenter = async (id: string): Promise<KnowledgeStorePresenter> => {
    // 缓存命中直接返回
    if (this.storePresenterCache.has(id)) {
      return this.storePresenterCache.get(id) as KnowledgeStorePresenter
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
    const rag = new KnowledgeStorePresenter(db, config, this.taskP)
    this.storePresenterCache.set(id, rag)
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
  ): Promise<DuckDBPresenter> => {
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

  async addFile(id: string, filePath: string): Promise<KnowledgeFileResult> {
    try {
      const rag = await this.getStorePresenter(id)
      return await rag.addFile(filePath)
    } catch (err) {
      return {
        error: `添加文件失败: ${err instanceof Error ? err.message : String(err)}`
      }
    }
  }

  async deleteFile(id: string, fileId: string): Promise<void> {
    const rag = await this.getStorePresenter(id)
    await rag.deleteFile(fileId)
  }

  async reAddFile(id: string, fileId: string): Promise<KnowledgeFileResult> {
    try {
      const rag = await this.getStorePresenter(id)
      return await rag.reAddFile(fileId)
    } catch (err) {
      return {
        error: `重新添加文件失败: ${err instanceof Error ? err.message : String(err)}`
      }
    }
  }

  async queryFile(id: string, fileId: string): Promise<KnowledgeFileMessage | null> {
    const rag = await this.getStorePresenter(id)
    return await rag.queryFile(fileId)
  }

  async listFiles(id: string): Promise<KnowledgeFileMessage[]> {
    const rag = await this.getStorePresenter(id)
    return await rag.listFiles()
  }

  async closeAll(): Promise<void> {
    this.storePresenterCache.forEach((rag) => {
      rag.close()
    })
    this.storePresenterCache.clear()
  }

  async destroy(): Promise<void> {
    this.closeAll()
  }

  async similarityQuery(id: string, key: string): Promise<QueryResult[]> {
    const rag = await this.getStorePresenter(id)
    return await rag.similarityQuery(key)
  }

  /**
   * 获取知识库任务队列状态
   */
  async getTaskQueueStatus() {
    return this.taskP.getStatus()
  }

  private async recoverUnfinishedTasks(): Promise<void> {
    console.log('[RAG] Checking unfinished tasks...')
    const configs = this.configP.getKnowledgeConfigs()

    // 收集所有有未完成任务的知识库
    const unfinishedKnowledgeBases: {
      config: BuiltinKnowledgeConfig
      files: KnowledgeFileMessage[]
    }[] = []

    for (const config of configs) {
      try {
        const db = await this.getVectorDatabasePresenter(
          config.id,
          config.dimensions,
          config.normalized
        )

        // 检查是否有processing或paused状态的文件
        const processingFiles = await db.queryFiles({
          status: 'processing'
        })
        const pausedFiles = await db.queryFiles({
          status: 'paused'
        })

        const allUnfinishedFiles = [...processingFiles, ...pausedFiles]
        if (allUnfinishedFiles.length > 0) {
          unfinishedKnowledgeBases.push({ config, files: allUnfinishedFiles })
        }
        await db.close()
      } catch (err) {
        console.error(`[RAG] Error checking unfinished tasks for knowledge base ${config.id}:`, err)
      }
    }

    if (unfinishedKnowledgeBases.length > 0) {
      // TODO 有未完成的任务
    }
  }
}

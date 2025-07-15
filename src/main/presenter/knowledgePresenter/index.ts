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
import { eventBus, SendTarget } from '@/eventbus'
import { MCP_EVENTS, RAG_EVENTS } from '@/events'
import { DuckDBPresenter } from './database/duckdbPresenter'
import { KnowledgeStorePresenter } from './knowledgeStorePresenter'

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
    this.recoverUnfinishedTasks()
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
    this.createStorePresenter(config)
  }

  /**
   * 删除知识库（移除本地存储）
   */
  delete = async (id: string): Promise<void> => {
    if (this.storePresenterCache.has(id)) {
      const rag = this.storePresenterCache.get(id) as KnowledgeStorePresenter
      await rag.destroy()
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
  private storePresenterCache: Map<string, KnowledgeStorePresenter> = new Map()

  /**
   * 创建 RAG 应用实例
   * @param params BuiltinKnowledgeConfig
   * @returns KnowledgeStorePresenter
   */
  private createStorePresenter = async (config: BuiltinKnowledgeConfig): Promise<KnowledgeStorePresenter> => {
    let rag: KnowledgeStorePresenter
    const db = await this.getVectorDatabasePresenter(
      config.id,
      config.dimensions,
      config.normalized
    )
    try {
      rag = new KnowledgeStorePresenter(db, config)
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
    const rag = new KnowledgeStorePresenter(db, config)
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

  private async handleFileTask(
    id: string,
    fileHandler: (rag: KnowledgeStorePresenter) => Promise<{ data: KnowledgeFileMessage; task: Promise<KnowledgeFileMessage> }>,
    errorMsg: string
  ): Promise<KnowledgeFileResult> {
    try {
      const rag = await this.getStorePresenter(id)
      const fileTask = await fileHandler(rag)
      fileTask.task
        .then((message) => {
          eventBus.sendToRenderer(RAG_EVENTS.FILE_UPDATED, SendTarget.ALL_WINDOWS, message)
        })
        .catch((err) => {
          // 可选：记录异步任务异常
          console.error(`${errorMsg}异步任务失败:`, err)
        })
      return {
        data: fileTask.data
      }
    } catch (err) {
      return {
        error: `${errorMsg}: ${err instanceof Error ? err.message : String(err)}`
      }
    }
  }

  async addFile(id: string, filePath: string): Promise<KnowledgeFileResult> {
    return this.handleFileTask(
      id,
      (rag) => rag.addFile(filePath),
      '添加文件失败'
    )
  }

  async deleteFile(id: string, fileId: string): Promise<void> {
    const rag = await this.getStorePresenter(id)
    await rag.deleteFile(fileId)
  }

  async reAddFile(id: string, fileId: string): Promise<KnowledgeFileResult> {
    return this.handleFileTask(
      id,
      (rag) => rag.reAddFile(fileId),
      '重新添加文件失败'
    )
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
  }

  async destroy(): Promise<void> {
    this.closeAll()
  }

  async similarityQuery(id: string, key: string): Promise<QueryResult[]> {
    const rag = await this.getStorePresenter(id)
    return await rag.similarityQuery(key)
  }

  private async recoverUnfinishedTasks(): Promise<void> {
    console.log('[RAG] Recovering unfinished tasks...')
    const configs = this.configP.getKnowledgeConfigs()
    for (const config of configs) {
      try {
        const storePresenter = await this.getStorePresenter(config.id)
        await storePresenter.recoverProcessingFiles()
      } catch (err) {
        console.error(`[RAG] Error recovering tasks for knowledge base ${config.id}:`, err)
      }
    }
  }
}

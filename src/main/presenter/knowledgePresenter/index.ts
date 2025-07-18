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
    // 从TaskScheduler中清理知识库任务
    this.taskP.clearKnowledgeBaseTasks(id)

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

  private async handleFileTask(
    id: string,
    fileHandler: (rag: KnowledgeStorePresenter) => Promise<KnowledgeFileResult>,
    errorMsg: string
  ): Promise<KnowledgeFileResult> {
    try {
      const rag = await this.getStorePresenter(id)
      const result = await fileHandler(rag)
      return result
    } catch (err) {
      return {
        error: `${errorMsg}: ${err instanceof Error ? err.message : String(err)}`
      }
    }
  }

  async addFile(id: string, filePath: string): Promise<KnowledgeFileResult> {
    return this.handleFileTask(id, (rag) => rag.addFile(filePath), '添加文件失败')
  }

  async deleteFile(id: string, fileId: string): Promise<void> {
    const rag = await this.getStorePresenter(id)
    await rag.deleteFile(fileId)
  }

  async reAddFile(id: string, fileId: string): Promise<KnowledgeFileResult> {
    return this.handleFileTask(id, (rag) => rag.reAddFile(fileId), '重新添加文件失败')
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
  async getTaskQueueStatus(id: string) {
    return this.taskP.getQueueStatus(id)
  }

  private async checkUnfinishedTasks(): Promise<void> {
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
        const unfinishedFiles = await db.queryFiles({
          status: 'processing'
        })
        const pausedFiles = await db.queryFiles({
          status: 'paused'
        })

        const allUnfinishedFiles = [...unfinishedFiles, ...pausedFiles]
        if (allUnfinishedFiles.length > 0) {
          unfinishedKnowledgeBases.push({ config, files: allUnfinishedFiles })
        }
      } catch (err) {
        console.error(`[RAG] Error checking unfinished tasks for knowledge base ${config.id}:`, err)
      }
    }

    if (unfinishedKnowledgeBases.length > 0) {
      // 有未完成的任务，显示用户选择弹窗
      await this.showRecoveryDialog(unfinishedKnowledgeBases)
    }
  }

  /**
   * 显示恢复任务的对话框
   */
  private async showRecoveryDialog(
    unfinishedKnowledgeBases: { config: BuiltinKnowledgeConfig; files: KnowledgeFileMessage[] }[]
  ): Promise<void> {
    const { dialog } = require('electron')
    const totalFiles = unfinishedKnowledgeBases.reduce((sum, kb) => sum + kb.files.length, 0)

    const result = await dialog.showMessageBox({
      type: 'question',
      title: '知识库任务恢复',
      message: `检测到 ${unfinishedKnowledgeBases.length} 个知识库中有 ${totalFiles} 个文件的处理任务被中断。`,
      detail: '您希望如何处理这些未完成的任务？',
      buttons: ['立即继续', '稍后处理', '取消任务'],
      defaultId: 0,
      cancelId: 2
    })

    switch (result.response) {
      case 0: // 立即继续
        await this.continueAllTasks(unfinishedKnowledgeBases)
        break
      case 1: // 稍后处理
        await this.pauseAllTasks(unfinishedKnowledgeBases)
        break
      case 2: // 取消任务
        await this.cancelAllTasks(unfinishedKnowledgeBases)
        break
    }
  }

  /**
   * 继续所有未完成的任务
   */
  private async continueAllTasks(
    unfinishedKnowledgeBases: { config: BuiltinKnowledgeConfig; files: KnowledgeFileMessage[] }[]
  ): Promise<void> {
    for (const { config } of unfinishedKnowledgeBases) {
      try {
        await this.getStorePresenter(config.id)
        console.log(`[RAG] Knowledge base ${config.id} ready for task recovery`)
      } catch (err) {
        console.error(`[RAG] Error preparing knowledge base ${config.id}:`, err)
      }
    }
  }

  /**
   * 暂停所有未完成的任务
   */
  private async pauseAllTasks(
    unfinishedKnowledgeBases: { config: BuiltinKnowledgeConfig; files: KnowledgeFileMessage[] }[]
  ): Promise<void> {
    for (const { config, files } of unfinishedKnowledgeBases) {
      try {
        const db = await this.getVectorDatabasePresenter(
          config.id,
          config.dimensions,
          config.normalized
        )

        for (const file of files) {
          if (file.status === 'processing') {
            file.status = 'paused'
            await db.updateFile(file)
          }
        }

        await db.close()
      } catch (err) {
        console.error(`[RAG] Error pausing tasks for knowledge base ${config.id}:`, err)
      }
    }
  }

  /**
   * 取消所有未完成的任务
   */
  private async cancelAllTasks(
    unfinishedKnowledgeBases: { config: BuiltinKnowledgeConfig; files: KnowledgeFileMessage[] }[]
  ): Promise<void> {
    for (const { config, files } of unfinishedKnowledgeBases) {
      try {
        const db = await this.getVectorDatabasePresenter(
          config.id,
          config.dimensions,
          config.normalized
        )

        for (const file of files) {
          file.status = 'error'
          file.metadata.errorReason = '用户取消任务'
          await db.updateFile(file)

          // 清理相关的chunk数据
          await db.deleteChunksByFile(file.id)
        }

        await db.close()
      } catch (err) {
        console.error(`[RAG] Error canceling tasks for knowledge base ${config.id}:`, err)
      }
    }
  }
}

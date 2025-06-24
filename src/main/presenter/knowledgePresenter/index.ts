import * as fs from 'node:fs'
import path from 'node:path'

import { IConfigPresenter, IKnowledgePresenter, KnowledgeBaseParams } from '@shared/presenter'
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

  configPresenter: IConfigPresenter

  constructor(configPresenter: IConfigPresenter, dbDir: string) {
    console.log('[RAG] Initializing Built-in Knowledge Presenter')
    this.configPresenter = configPresenter
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
      const mcpServers = payload?.mcpServers || {}
      const builtinConfig = mcpServers['builtinKnowledge']
      if (builtinConfig) {
        console.log('[RAG] Received builtinKnowledge config update:', builtinConfig)
        /* // 取出 configs
        const newConfigs = builtinConfig.env?.configs || []
        // 读取旧配置（如有缓存可用缓存，否则从磁盘/数据库读取）
        const oldConfigs = (await this.configPresenter.getBuiltinKnowledgeConfigs?.()) || []

        // diff 新旧配置，自动判断新增、更新、删除
        const oldMap = new Map(oldConfigs.map((cfg) => [cfg.id, cfg]))
        const newMap = new Map(newConfigs.map((cfg) => [cfg.id, cfg]))

        // 新增和更新
        for (const cfg of newConfigs) {
          if (!oldMap.has(cfg.id)) {
            await this.create(cfg)
          } else if (JSON.stringify(cfg) !== JSON.stringify(oldMap.get(cfg.id))) {
            await this.reset({ base: cfg })
          }
        }
        // 删除
        for (const cfg of oldConfigs) {
          if (!newMap.has(cfg.id)) {
            await this.delete(cfg.id)
          }
        } */
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
    console.log(base)
  }

  /**
   * 删除知识库（移除本地存储）
   */
  delete = async (id: string): Promise<void> => {
    console.log(id)
  }

  /**
   * 获取或创建 RAG 应用实例
   * @param params KnowledgeBaseParams
   * @returns RAGApplication
   */
  private getRagApplication = async ({
    id,
    model,
    provider,
    apiKey,
    apiVersion,
    baseURL,
    dimensions
  }: KnowledgeBaseParams): Promise<RAGApplication> => {
    let ragApplication: RAGApplication
    // 创建 Embeddings 实例
    const embeddings = new Embeddings({
      model,
      provider,
      apiKey,
      apiVersion,
      baseURL,
      dimensions
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

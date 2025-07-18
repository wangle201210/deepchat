import fs from 'node:fs'

import {
  BuiltinKnowledgeConfig,
  IVectorDatabasePresenter,
  KnowledgeFileMessage,
  QueryResult,
  IKnowledgeTaskPresenter,
  KnowledgeFileResult,
  KnowledgeChunkMessage,
  InsertOptions
} from '@shared/presenter'
import { presenter } from '@/presenter'
import { nanoid } from 'nanoid'
import { RecursiveCharacterTextSplitter } from '@/lib/textsplitters'
import { sanitizeText } from '@/utils/strings'
import { getMetric, normalizeDistance } from '@/utils/vector'
import { eventBus, SendTarget } from '@/eventbus'
import { RAG_EVENTS } from '@/events'

export class KnowledgeStorePresenter {
  private readonly vectorP: IVectorDatabasePresenter
  private config: BuiltinKnowledgeConfig
  private taskP: IKnowledgeTaskPresenter

  constructor(
    vectorP: IVectorDatabasePresenter,
    config: BuiltinKnowledgeConfig,
    taskScheduler: IKnowledgeTaskPresenter
  ) {
    this.vectorP = vectorP
    this.config = config
    this.taskP = taskScheduler
  }

  /**
   * 获取vector数据库presenter
   */
  getVectorPresenter(): IVectorDatabasePresenter {
    return this.vectorP
  }

  async updateConfig(config: BuiltinKnowledgeConfig): Promise<void> {
    this.config = config
  }

  async addFile(filePath: string, fileId?: string): Promise<KnowledgeFileResult> {
    if (fs.existsSync(filePath) === false) {
      throw new Error('文件不存在，请检查路径是否正确')
    }
    // 如果文件id为空，但filePath在数据库中已存在，说明是重复添加，跳过
    const file = await this.vectorP.queryFiles({
      path: filePath
    })
    if (!fileId && file[0]) {
      // 直接返回文件信息，前端需要过滤
      return { data: file[0] }
    }

    const mimeType = await presenter.filePresenter.getMimeType(filePath)
    const fileInfo = await presenter.filePresenter.prepareFileCompletely(
      filePath,
      mimeType,
      'origin'
    )

    // 1. 分片
    const chunker = new RecursiveCharacterTextSplitter({
      chunkSize: this.config.chunkSize,
      chunkOverlap: this.config.chunkOverlap
    })
    const chunks = await chunker.splitText(sanitizeText(fileInfo.content))

    const fileMessage = {
      id: fileId ?? nanoid(),
      name: fileInfo.name,
      path: fileInfo.path,
      mimeType,
      status: 'processing',
      uploadedAt: new Date().getTime(),
      metadata: {
        size: fileInfo.metadata.fileSize,
        totalChunks: chunks.length,
        completedChunks: 0
      }
    } as KnowledgeFileMessage

    // 先插入文件记录
    fileId ? await this.vectorP.updateFile(fileMessage) : await this.vectorP.insertFile(fileMessage)

    // 创建chunk记录
    const chunkMessages = chunks.map(
      (content, index) =>
        ({
          id: nanoid(),
          fileId: fileMessage.id,
          chunkIndex: index,
          content,
          status: 'processing'
        }) as KnowledgeChunkMessage
    )

    // 批量插入chunks到数据库
    await this.vectorP.insertChunks(chunkMessages)

    // 2. 调度分块任务到TaskManager
    for (const [index, chunk] of chunks.entries()) {
      const chunkMessage = chunkMessages[index]
      const task = {
        id: chunkMessage.id,
        payload: {
          knowledgeBaseId: this.config.id,
          fileId: fileMessage.id,
          chunkIndex: chunkMessage.chunkIndex,
          content: chunk
        },
        run: async ({ signal }) => this.processChunk(chunkMessage.id, signal),
        onSuccess: (vector: InsertOptions) =>
          this.handleChunkSuccess(chunkMessage.id, fileMessage.id, vector),
        onError: (error: Error) => this.handleChunkError(chunkMessage.id, fileMessage.id, error),
        onTerminate: () => this.handleChunkTerminate(chunkMessage.id)
      }
      this.taskP.addTask(task)
    }

    // 发送事件通知
    eventBus.sendToRenderer(RAG_EVENTS.FILE_UPDATED, SendTarget.ALL_WINDOWS, fileMessage)

    return { data: fileMessage }
  }

  private async processChunk(chunkId: string, signal: AbortSignal): Promise<InsertOptions> {
    if (signal.aborted) {
      throw new DOMException('Aborted', 'AbortError')
    }
    const chunk = await this.vectorP.queryChunk(chunkId)
    if (!chunk) {
      // chunk不存在，说明任务已被清除
      throw new DOMException('Aborted', 'AbortError')
    }

    console.log(`[RAG] Processing chunk ${chunk.chunkIndex} for file ${chunk.fileId}`)
    // 生成嵌入向量
    const vectors = await presenter.llmproviderPresenter.getEmbeddings(
      this.config.embedding.providerId,
      this.config.embedding.modelId,
      [chunk.content]
    )

    if (!vectors || vectors.length === 0) {
      throw new Error('Failed to generate embeddings')
    }

    return {
      vector: vectors[0],
      metadata: {
        content: chunk.content
      },
      fileId: chunk.fileId
    }
  }

  private async handleChunkSuccess(
    chunkId: string,
    fileId: string,
    vector: InsertOptions
  ): Promise<void> {
    try {
      // 更新chunk状态
      await this.vectorP.updateChunkStatus(chunkId, 'completed')
      // 插入向量
      await this.vectorP.insertVector(vector)
      // 检查文件状态
      await this.checkFile(fileId)
    } catch (error) {
      console.error(`[RAG] Error in handleChunkSuccess for chunk ${chunkId}:`, error)
      // Even if success handling fails, we should treat the chunk as errored.
      await this.handleChunkError(chunkId, fileId, error as Error)
    }
  }

  private async handleChunkError(chunkId: string, fileId: string, error: Error): Promise<void> {
    try {
      // 更新chunk状态
      await this.vectorP.updateChunkStatus(chunkId, 'error', error.message)
      // 检查文件状态
      await this.checkFile(fileId)
    } catch (e) {
      console.error(`[RAG] CRITICAL: Failed to handle chunk error for chunk ${chunkId}:`, e)
      // If error handling also fails, we still need to check the file status
      // to prevent the file from being stuck in a processing state.
      await this.checkFile(fileId)
    }
  }

  private async handleChunkTerminate(chunkId: string): Promise<void> {
    // 触发terminal，则不会触发success和error
    console.log(`[RAG] Chunk ${chunkId} was terminated.`)
  }

  private async checkFile(fileId: string): Promise<void> {
    // 检查文件是否所有分块都已完成
    const fileChunks = await this.vectorP.queryChunksByFile(fileId)
    const finishedCount = fileChunks.filter((c) => c.status !== 'processing').length

    // 更新文件状态
    const fileMessage = await this.vectorP.queryFile(fileId)
    if (!fileMessage) return
    fileMessage.metadata.completedChunks = finishedCount

    if (finishedCount === fileMessage.metadata.totalChunks) {
      const errorChunks = fileChunks.filter((c) => c.status === 'error').length
      if (errorChunks > 0) {
        fileMessage.status = 'error'
        fileMessage.metadata.errorReason = `${errorChunks} chunks failed to process`
      } else {
        fileMessage.status = 'completed'
        // 清理分块数据
        await this.vectorP.deleteChunksByFile(fileId)
      }
      console.log(`[RAG] File ${fileId} processing finished with status: ${fileMessage.status}`)
    }
    await this.vectorP.updateFile(fileMessage)
    eventBus.sendToRenderer(RAG_EVENTS.FILE_UPDATED, SendTarget.ALL_WINDOWS, fileMessage)
  }

  async deleteFile(fileId: string): Promise<void> {
    try {
      this.taskP.removeTasks((task) => task.payload.fileId === fileId)
      await this.vectorP.deleteVectorsByFile(fileId)
      await this.vectorP.deleteFile(fileId)
      await this.vectorP.deleteChunksByFile(fileId)
    } catch (err) {
      console.error(
        `[RAG] Failed to delete file ${fileId} in knowledge base ${this.config.id}:`,
        err
      )
      throw err
    }
  }

  async similarityQuery(key: string): Promise<QueryResult[]> {
    try {
      const embedding = await presenter.llmproviderPresenter.getEmbeddings(
        this.config.embedding.providerId,
        this.config.embedding.modelId,
        [sanitizeText(key)]
      )

      const queryResults = await this.vectorP.similarityQuery(embedding[0], {
        topK: this.config.fragmentsNumber,
        metric: getMetric(this.config.normalized)
      })
      queryResults.forEach((res) => {
        res.distance = normalizeDistance(res.distance, getMetric(this.config.normalized))
      })
      return queryResults
    } catch (err) {
      console.error(
        `[RAG] Similarity query failed in knowledge base ${this.config.id} for key "${key}":`,
        err
      )
      throw err
    }
  }

  async reAddFile(fileId: string): Promise<KnowledgeFileResult> {
    const file = await this.queryFile(fileId)
    if (file == null) {
      throw new Error('文件不存在，请重新打开知识库后再试')
    }
    await this.vectorP.deleteVectorsByFile(fileId)
    return this.addFile(file.path, fileId)
  }

  async queryFile(fileId: string): Promise<KnowledgeFileMessage | null> {
    try {
      return await this.vectorP.queryFile(fileId)
    } catch (err) {
      console.error(
        `[RAG] Failed to query file ${fileId} in knowledge base ${this.config.id}:`,
        err
      )
      throw err
    }
  }
  async listFiles(): Promise<KnowledgeFileMessage[]> {
    try {
      return await this.vectorP.listFiles()
    } catch (err) {
      console.error(`[RAG] Failed to list files in knowledge base ${this.config.id}:`, err)
      throw err
    }
  }

  async destroy(): Promise<void> {
    try {
      // 停止所有任务
      this.taskP.removeTasks((task) => task.payload.knowledgeBaseId === this.config.id)
      this.vectorP.destroy()
    } catch (err) {
      console.error(`[RAG] Error destroying knowledge base ${this.config.id}:`, err)
    }
  }

  async close(): Promise<void> {
    try {
      // 停止所有任务
      this.taskP.removeTasks((task) => task.payload.knowledgeBaseId === this.config.id)
      this.vectorP.close()
    } catch (err) {
      console.error(`[RAG] Error closing knowledge base ${this.config.id}:`, err)
    }
  }
}

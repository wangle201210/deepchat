import fs from 'node:fs'

import {
  BuiltinKnowledgeConfig,
  IVectorDatabasePresenter,
  KnowledgeFileMessage,
  QueryResult,
  IKnowledgeTaskPresenter,
  KnowledgeFileResult,
  KnowledgeChunkStatus,
  KnowledgeChunkTask,
  KnowledgeChunkMessage
} from '@shared/presenter'
import { presenter } from '@/presenter'
import { nanoid } from 'nanoid'
import { RecursiveCharacterTextSplitter } from '@/lib/textsplitters'
import { sanitizeText } from '@/utils/strings'
import { normalizeDistance } from '@/utils/vector'
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
          status: 'pending'
        }) as KnowledgeChunkMessage
    )

    // 批量插入chunks到数据库
    await this.vectorP.insertChunks(chunkMessages)

    // 2. 调度分块任务到TaskManager
    for (const [index, chunk] of chunks.entries()) {
      const chunkMessage = chunkMessages[index]
      const task: KnowledgeChunkTask = {
        id: chunkMessage.id,
        payload: {
          knowledgeBaseId: this.config.id,
          fileId: fileMessage.id,
          chunkIndex: chunkMessage.chunkIndex,
          content: chunk
        },
        run: async ({ signal }) => this.processChunk(chunkMessage.id, signal),
        onSuccess: () => this.handleChunkCompletion(chunkMessage.id, 'completed'),
        onError: (error) => this.handleChunkCompletion(chunkMessage.id, 'error', error),
        onTerminate: () => this.handleChunkCompletion(chunkMessage.id, 'paused')
      }
      this.taskP.addTask(task)
    }

    // 发送事件通知
    eventBus.sendToRenderer(RAG_EVENTS.FILE_UPDATED, SendTarget.ALL_WINDOWS, fileMessage)

    return { data: fileMessage }
  }

  private async processChunk(chunkId: string, signal: AbortSignal): Promise<void> {
    const chunk = await this.vectorP.queryChunk(chunkId)
    if (!chunk) {
      console.warn(`[KSP] Chunk ${chunkId} not found, skipping processing.`)
      return
    }

    if (signal.aborted) {
      throw new DOMException('Aborted', 'AbortError')
    }

    console.log(`[KSP] Processing chunk ${chunk.chunkIndex} for file ${chunk.fileId}`)

    // 生成嵌入向量
    const vectors = await presenter.llmproviderPresenter.getEmbeddings(
      this.config.embedding.providerId,
      this.config.embedding.modelId,
      [chunk.content]
    )

    if (signal.aborted) {
      throw new DOMException('Aborted', 'AbortError')
    }

    if (!vectors || vectors.length === 0) {
      throw new Error('Failed to generate embeddings')
    }

    // 插入向量到向量表
    await this.vectorP.insertVector({
      vector: vectors[0],
      metadata: {
        chunkId: chunk.id,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content
      },
      fileId: chunk.fileId
    })
  }

  private async handleChunkCompletion(
    chunkId: string,
    status: KnowledgeChunkStatus,
    error?: Error
  ): Promise<void> {
    console.log(`[KSP] Handling chunk completion for ${chunkId} with status: ${status}`)
    await this.vectorP.updateChunkStatus(chunkId, status, error?.message)

    const chunk = await this.vectorP.queryChunk(chunkId)
    if (!chunk) return

    // 检查文件是否所有分块都已完成
    const fileId = chunk.fileId
    const fileChunks = await this.vectorP.queryChunksByFile(fileId)
    const completedCount = fileChunks.filter((c) => c.status !== 'processing').length

    const fileMessage = await this.vectorP.queryFile(fileId)
    if (!fileMessage) return

    fileMessage.metadata.completedChunks = completedCount

    if (completedCount === fileMessage.metadata.totalChunks) {
      const errorChunks = fileChunks.filter((c) => c.status === 'error').length
      if (errorChunks > 0) {
        fileMessage.status = 'error'
        fileMessage.metadata.errorReason = `${errorChunks} chunks failed to process`
      } else {
        const pausedChunks = fileChunks.filter((c) => c.status === 'paused').length
        if (pausedChunks > 0) {
          fileMessage.status = 'paused'
        } else {
          fileMessage.status = 'completed'
        }
      }
      console.log(`[KSP] File ${fileId} processing finished with status: ${fileMessage.status}`)
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
        metric: this.config.normalized ? 'cosine' : 'ip'
      })
      queryResults.forEach((res) => {
        res.distance = normalizeDistance(res.distance, this.config.normalized ? 'cosine' : 'ip')
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
      this.taskP.removeTasks((task) => task.payload.knowledgeBaseId === this.config.id)
      this.vectorP.destroy()
    } catch (err) {
      console.error(`[RAG] Error destroying knowledge base ${this.config.id}:`, err)
    }
  }

  async close(): Promise<void> {
    try {
      this.vectorP.close()
    } catch (err) {
      console.error(`[RAG] Error closing knowledge base ${this.config.id}:`, err)
    }
  }
}

import fs from 'node:fs'

import {
  BuiltinKnowledgeConfig,
  IVectorDatabasePresenter,
  KnowledgeFileMessage,
  QueryResult,
  ChunkProcessor,
  ChunkTask,
  IKnowledgeTaskPresenter,
  ChunkProcessingTask,
  KnowledgeFileResult
} from '@shared/presenter'
import { presenter } from '@/presenter'
import { nanoid } from 'nanoid'
import { RecursiveCharacterTextSplitter } from '@/lib/textsplitters'
import { sanitizeText } from '@/utils/strings'
import { normalizeDistance } from '@/utils/vector'
import { eventBus, SendTarget } from '@/eventbus'
import { RAG_EVENTS } from '@/events'

export class KnowledgeStorePresenter implements ChunkProcessor {
  private readonly vectorP: IVectorDatabasePresenter
  private config: BuiltinKnowledgeConfig
  private taskP: IKnowledgeTaskPresenter

  constructor(vectorP: IVectorDatabasePresenter, config: BuiltinKnowledgeConfig, taskScheduler: IKnowledgeTaskPresenter) {
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

  async addFile(
    filePath: string,
    fileId?: string
  ): Promise<KnowledgeFileResult> {
    if (fs.existsSync(filePath) === false) {
      throw new Error('文件不存在，请检查路径是否正确')
    }

    const mimeType = await presenter.filePresenter.getMimeType(filePath)
    const fileInfo = await presenter.filePresenter.prepareFileCompletely(
      filePath,
      mimeType,
      'origin'
    )

    const fileMessage = {
      id: fileId ?? nanoid(),
      name: fileInfo.name,
      path: fileInfo.path,
      mimeType,
      status: 'processing',
      uploadedAt: new Date().getTime(),
      metadata: {
        size: fileInfo.metadata.fileSize
      }
    } as KnowledgeFileMessage

    // 先插入文件记录
    fileId ? await this.vectorP.updateFile(fileMessage) : await this.vectorP.insertFile(fileMessage)

    // 1. 分片
    const chunker = new RecursiveCharacterTextSplitter({
      chunkSize: this.config.chunkSize,
      chunkOverlap: this.config.chunkOverlap
    })
    const chunks = await chunker.splitText(sanitizeText(fileInfo.content))

    // 更新文件metadata
    fileMessage.metadata.totalChunks = chunks.length
    fileMessage.metadata.completedChunks = 0
    await this.vectorP.updateFile(fileMessage)

    // 创建chunk记录
    const chunkMessages = chunks.map((content, index) => ({
      id: nanoid(),
      fileId: fileMessage.id,
      chunkIndex: index,
      content,
      status: 'pending' as const
    }))

    // 批量插入chunks到数据库
    await this.vectorP.insertChunks(chunkMessages)

    // 2. 调度分块任务到TaskManager
    for (const [index, chunk] of chunks.entries()) {
      const task: ChunkProcessingTask = {
        id: chunkMessages[index].id,
        knowledgeBaseId: this.config.id,
        fileId: fileMessage.id,
        chunkContent: chunk,
        chunkIndex: index,
        processorCallback: this
      }
      
      await this.taskP.scheduleChunkTask(task)
    }

    // 发送事件通知
    eventBus.sendToRenderer(RAG_EVENTS.FILE_UPDATED, SendTarget.ALL_WINDOWS, fileMessage)

    return { data: fileMessage }
  }

  /**
   * 实现 ChunkProcessor 接口 - 处理单个分块
   */
  async processChunk(chunk: ChunkTask): Promise<void> {
    console.log(`[KnowledgeStorePresenter] Processing chunk ${chunk.chunkIndex} for file ${chunk.fileId}`)

    try {
      // 生成嵌入向量
      const vectors = await presenter.llmproviderPresenter.getEmbeddings(
        this.config.embedding.providerId,
        this.config.embedding.modelId,
        [chunk.content]
      )

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
      
      // 删除chunk记录（按设计，完成后删除）
      await this.vectorP.deleteChunk(chunk.id)
      
      console.log(`[KnowledgeStorePresenter] Chunk ${chunk.chunkIndex} processed successfully`)
    } catch (error) {
      console.error(`[KnowledgeStorePresenter] Failed to process chunk ${chunk.id}:`, error)
      
      // 更新chunk状态为error
      await this.vectorP.updateChunkStatus(chunk.id, 'error')
      throw error
    }
  }

  /**
   * 实现 ChunkProcessor 接口 - 处理文件完成
   */
  async handleFileCompletion(fileId: string): Promise<void> {
    console.log(`[KnowledgeStorePresenter] File processing completed: ${fileId}`)

    try {
      // 查询文件和所有chunks状态
      const fileMessage = await this.vectorP.queryFile(fileId)
      if (!fileMessage) return

      const allChunks = await this.vectorP.queryChunksByFile(fileId)
      const completedChunks = allChunks.filter(chunk => chunk.status !== 'pending' && chunk.status !== 'processing')
      const errorChunks = allChunks.filter(chunk => chunk.status === 'error')

      // 更新文件状态
      fileMessage.metadata.completedChunks = completedChunks.length
      
      if (errorChunks.length === 0) {
        fileMessage.status = 'completed'
      } else {
        fileMessage.status = 'error'
        fileMessage.metadata.errorReason = `${errorChunks.length} chunks failed to process`
      }

      await this.vectorP.updateFile(fileMessage)

      // 清理已完成的chunks (根据设计，完成后删除chunk记录)
      for (const chunk of completedChunks) {
        if (chunk.status !== 'error') {
          await this.vectorP.deleteChunk(chunk.id)
        }
      }

      // 发送完成事件
      eventBus.sendToRenderer(RAG_EVENTS.FILE_UPDATED, SendTarget.ALL_WINDOWS, fileMessage)
      
    } catch (error) {
      console.error(`[KnowledgeStorePresenter] Error handling file completion:`, error)
    }
  }

  /**
   * 实现 ChunkProcessor 接口 - 处理分块错误
   */
  async handleChunkError(chunkId: string, error: Error): Promise<void> {
    console.error(`[KnowledgeStorePresenter] Chunk error ${chunkId}:`, error)
    
    try {
      // 更新chunk状态为error
      await this.vectorP.updateChunkStatus(chunkId, 'error')
      
      // 可以在这里添加更多的错误处理逻辑，比如重试机制
    } catch (updateError) {
      console.error(`[KnowledgeStorePresenter] Failed to update chunk error status:`, updateError)
    }
  }

  async deleteFile(fileId: string): Promise<void> {
    try {
      await this.taskP.clearFileTasks(fileId)
      await this.vectorP.deleteVectorsByFile(fileId)
      await this.vectorP.deleteFile(fileId)
      await this.vectorP.deleteChunksByFile(fileId)
    } catch (err) {
      console.error(`[RAG] Failed to delete file ${fileId} in knowledge base ${this.config.id}:`, err)
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

  async reAddFile(
    fileId: string
  ): Promise<KnowledgeFileResult> {
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

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
    try {
      if (fs.existsSync(filePath) === false) {
        throw new Error('文件不存在，请检查路径是否正确')
      }
      // 如果文件id为空，但filePath在数据库中已存在，说明是重复添加，跳过
      const existingFile = await this.vectorP.queryFiles({
        path: filePath
      })
      if (!fileId && existingFile[0]) {
        // 直接返回文件信息，前端需要过滤
        return { data: existingFile[0] }
      }

      const mimeType = await presenter.filePresenter.getMimeType(filePath)
      const fileInfo = await presenter.filePresenter.prepareFileCompletely(
        filePath,
        mimeType,
        'origin'
      )

      // file content为空
      if (fileInfo.content === undefined || fileInfo.content.length === 0) {
        throw new Error('无法读取文件或文件内容为空，请检查文件是否损坏或格式是否受支持')
      }

      // 分片
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

      // 创建一个单一的任务来处理整个文件
      const fileProcessingTask = {
        id: fileMessage.id, // 使用文件ID作为任务ID
        payload: {
          knowledgeBaseId: this.config.id,
          fileId: fileMessage.id
        },
        run: async ({ signal }) => {
          await this.processFileTask(fileMessage, chunks, signal, fileId !== undefined)
          // 为了满足 KnowledgeChunkTask 的返回类型，返回一个虚拟值
          // 这个返回值在新的逻辑中不会被使用
          return {} as InsertOptions
        },
        // 成功、失败、终止的逻辑现在都在 processFileTask 内部处理
        onSuccess: () => {
          console.log(`[RAG] File processing task for ${fileMessage.id} completed successfully.`)
        },
        onError: (error: Error) => {
          console.error(`[RAG] File processing task for ${fileMessage.id} failed:`, error.message)
        },
        onTerminate: () => {
          console.log(`[RAG] File processing task for ${fileMessage.id} was terminated.`)
        }
      }

      this.taskP.addTask(fileProcessingTask)
      return { data: fileMessage }
    } catch (error) {
      console.error(`[RAG] Error adding file ${filePath}:`, error)
      // 向上抛出错误，以便调用者可以处理
      throw error
    }
  }

  private async processFileTask(
    fileMessage: KnowledgeFileMessage,
    chunks: string[],
    signal: AbortSignal,
    isReAdd: boolean
  ): Promise<void> {
    try {
      // 1. 插入文件和分块元数据
      isReAdd
        ? await this.vectorP.updateFile(fileMessage)
        : await this.vectorP.insertFile(fileMessage)

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
      await this.vectorP.insertChunks(chunkMessages)

      // 2. 逐个处理分块
      for (const chunkMsg of chunkMessages) {
        if (signal.aborted) {
          throw new DOMException('Aborted', 'AbortError')
        }

        try {
          // a. 生成向量
          const vectors = await presenter.llmproviderPresenter.getEmbeddings(
            this.config.embedding.providerId,
            this.config.embedding.modelId,
            [chunkMsg.content]
          )
          if (!vectors || vectors.length === 0) {
            throw new Error('Failed to generate embeddings')
          }

          // b. 插入向量
          await this.vectorP.insertVector({
            vector: vectors[0],
            metadata: { content: chunkMsg.content },
            fileId: chunkMsg.fileId
          })

          // c. 更新分块状态
          await this.vectorP.updateChunkStatus(chunkMsg.id, 'completed')

          // d. 更新文件进度并发送事件
          if (fileMessage.metadata) {
            fileMessage.metadata.completedChunks++
          }
        } catch (error) {
          // 如果单个分块失败，记录错误并继续
          console.error(
            `[RAG] Error processing chunk ${chunkMsg.chunkIndex} for file ${fileMessage.id}:`,
            error
          )
          await this.vectorP.updateChunkStatus(chunkMsg.id, 'error', (error as Error).message)
        } finally {
          // 每次分块处理后（无论成功失败）都发送更新
          eventBus.sendToRenderer(RAG_EVENTS.FILE_UPDATED, SendTarget.ALL_WINDOWS, {
            ...fileMessage
          })
        }
      }

      // 3. 所有分块处理完毕，最终确定文件状态
      await this.finalizeFileStatus(fileMessage.id)
    } catch (error) {
      console.error(`[RAG] Critical error in processFileTask for ${fileMessage.id}:`, error)
      // 如果是中止错误，则认为是正常终止
      if (error instanceof DOMException && error.name === 'AbortError') {
        fileMessage.status = 'error'
        fileMessage.metadata.errorReason = 'Task was cancelled by user.'
      } else {
        // 对于其他严重错误（如数据库连接失败），将文件标记为错误
        fileMessage.status = 'error'
        fileMessage.metadata.errorReason = (error as Error).message
      }
      await this.vectorP.updateFile(fileMessage)
      eventBus.sendToRenderer(RAG_EVENTS.FILE_UPDATED, SendTarget.ALL_WINDOWS, fileMessage)
      // 向上抛出，以便任务队列知道任务失败
      throw error
    }
  }

  private async finalizeFileStatus(fileId: string): Promise<void> {
    const fileMessage = await this.vectorP.queryFile(fileId)
    if (!fileMessage) return

    const fileChunks = await this.vectorP.queryChunksByFile(fileId)
    const errorChunksCount = fileChunks.filter((c) => c.status === 'error').length

    if (errorChunksCount > 0) {
      fileMessage.status = 'error'
      fileMessage.metadata.errorReason = `${errorChunksCount} chunks failed to process.`
    } else {
      fileMessage.status = 'completed'
      if (fileMessage.metadata) {
        fileMessage.metadata.errorReason = undefined
      }
      // 成功后清理分块元数据
      await this.vectorP.deleteChunksByFile(fileId)
    }

    console.log(`[RAG] File ${fileId} processing finished with status: ${fileMessage.status}`)
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
    } catch (error) {
      console.error(`[RAG] Error during similarity query:`, error)
      throw error
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

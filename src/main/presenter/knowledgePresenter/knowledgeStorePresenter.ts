import fs from 'node:fs'

import {
  BuiltinKnowledgeConfig,
  IVectorDatabasePresenter,
  KnowledgeFileMessage,
  QueryResult
} from '@shared/presenter'
import { presenter } from '@/presenter'
import { nanoid } from 'nanoid'
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters'
import { sanitizeText } from '@/utils/strings'

export class KnowledgeStorePresenter {
  private readonly vectorP: IVectorDatabasePresenter
  private readonly config: BuiltinKnowledgeConfig

  constructor(vectorP: IVectorDatabasePresenter, config: BuiltinKnowledgeConfig) {
    this.vectorP = vectorP
    this.config = config
  }

  async addFile(
    filePath: string,
    fileId?: string
  ): Promise<{ data: KnowledgeFileMessage; task: Promise<KnowledgeFileMessage> }> {
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
    fileId ? await this.vectorP.updateFile(fileMessage) : await this.vectorP.insertFile(fileMessage)

    const fileTask = this.fileTask(fileInfo.content, fileMessage)

    return { data: fileMessage, task: fileTask }
  }

  private async fileTask(
    content: string,
    fileMessage: KnowledgeFileMessage
  ): Promise<KnowledgeFileMessage> {
    try {
      // 1. 分片
      const chunker = new RecursiveCharacterTextSplitter({
        chunkSize: this.config.chunkSize,
        chunkOverlap: this.config.chunkOverlap
      })
      const chunks = await chunker.splitText(sanitizeText(content))

      // 2. 生成向量
      const vectors = await presenter.llmproviderPresenter.getEmbeddings(
        this.config.embedding.providerId,
        this.config.embedding.modelId,
        chunks
      )

      // 3. 插入向量
      await this.vectorP.insertVectors(
        vectors.map((vector, index) => ({
          vector,
          metadata: {
            from: fileMessage.name,
            filePath: fileMessage.path,
            content: chunks[index]
          },
          fileId: fileMessage.id
        }))
      )

      // 4. 更新状态为完成
      fileMessage.status = 'completed'
      await this.vectorP.updateFile(fileMessage)
    } catch (err) {
      // 出错时更新状态并记录原因
      fileMessage.status = 'error'
      fileMessage.metadata.reason = String(err)
      await this.vectorP.updateFile(fileMessage)
      console.error('addFile 后台处理失败:', err)
    }

    return fileMessage
  }

  async similarityQuery(key: string): Promise<QueryResult[]> {
    try {
      const embedding = await presenter.llmproviderPresenter.getEmbeddings(
        this.config.embedding.providerId,
        this.config.embedding.modelId,
        [sanitizeText(key)]
      )

      return await this.vectorP.similarityQuery(embedding[0], {
        topK: this.config.fragmentsNumber,
        metric: this.config.normalized ? 'cosine' : 'ip'
      })
    } catch (err) {
      console.error(
        `[RAG] Similarity query failed in knowledge base ${this.config.id} for key "${key}":`,
        err
      )
      throw err
    }
  }

  async deleteFile(fileId: string): Promise<void> {
    try {
      await this.vectorP.deleteVectorsByFile(fileId)
      await this.vectorP.deleteFile(fileId)
    } catch (err) {
      console.error(
        `[RAG] Failed to delete file ${fileId} in knowledge base ${this.config.id}:`,
        err
      )
      throw err
    }
  }

  async reAddFile(
    fileId: string
  ): Promise<{ data: KnowledgeFileMessage; task: Promise<KnowledgeFileMessage> }> {
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

  async recoverProcessingFiles(): Promise<void> {
    const processingFiles = await this.vectorP.queryFiles({ status: 'processing' })
    for (const file of processingFiles) {
      try {
        file.status = 'error'
        file.metadata.reason = '用户取消任务'
        await this.vectorP.updateFile(file)
      } catch (err) {
        console.error(
          `[RAG] Failed to recover processing file ${file.id} in knowledge base ${this.config.id}:`,
          err
        )
      }
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

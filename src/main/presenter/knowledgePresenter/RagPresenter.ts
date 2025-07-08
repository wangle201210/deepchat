import {
  BuiltinKnowledgeConfig,
  IVectorDatabasePresenter,
  KnowledgeFileMessage
} from '@shared/presenter'
import { presenter } from '@/presenter'
import { nanoid } from 'nanoid'
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters'
import { sanitizeText } from '@/utils/strings'

export class RagPresenter {
  private readonly vectorP: IVectorDatabasePresenter
  private readonly config: BuiltinKnowledgeConfig

  constructor(vectorP: IVectorDatabasePresenter, config: BuiltinKnowledgeConfig) {
    this.vectorP = vectorP
    this.config = config
  }

  async addFile(filePath: string): Promise<void> {
    const mimeType = await presenter.filePresenter.getMimeType(filePath)
    const fileInfo = await presenter.filePresenter.prepareFileCompletely(
      filePath,
      mimeType,
      'origin'
    )

    const fileId = nanoid()
    await this.vectorP.insertFile({
      id: fileId,
      name: fileInfo.name,
      path: fileInfo.path,
      mimeType,
      status: 'processing',
      uploadedAt: new Date().getTime(),
      metadata: {
        size: fileInfo.metadata.fileSize
      }
    })

    // 文本切分
    const chunker = new RecursiveCharacterTextSplitter({
      chunkSize: this.config.chunkSize,
      chunkOverlap: this.config.chunkOverlap
    })
    const chunks = await chunker.splitText(sanitizeText(fileInfo.content))

    const vectors = await presenter.llmproviderPresenter.getEmbeddings(
      this.config.embedding.providerId,
      this.config.embedding.modelId,
      chunks
    )

    await this.vectorP.insertVectors(
      vectors.map((vector) => {
        return {
          vector,
          metadata: {
            from: fileInfo.name,
            filePath: fileInfo.path
          },
          fileId: fileId
        }
      })
    )

    this.vectorP.updateFileStatus(fileId, 'ready')
  }
  async deleteFile(fileId: string) {
    await this.vectorP.deleteVectorsByFile(fileId)
    await this.vectorP.deleteFile(fileId)
  }
  async reAddFile(fileId: string) {
    const file = await this.queryFile(fileId)
    if (file == null) {
      throw new Error('文件不存在，请重新打开知识库后再试')
    }
  }
  async queryFile(fileId: string): Promise<KnowledgeFileMessage | null> {
    return await this.vectorP.queryFile(fileId)
  }
  async listFiles(): Promise<KnowledgeFileMessage[]> {
    return await this.vectorP.listFiles()
  }

  async reset() {}

  async destory() {
    this.vectorP.destroy()
  }
}

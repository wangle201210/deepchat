import { BuiltinKnowledgeConfig, IVectorDatabasePresenter } from '@shared/presenter'
import { presenter } from '@/presenter'
import { nanoid } from 'nanoid'

export class RagPresenter {
  private readonly vectorP: IVectorDatabasePresenter
  private readonly config: BuiltinKnowledgeConfig

  constructor(vectorP: IVectorDatabasePresenter, config: BuiltinKnowledgeConfig) {
    this.vectorP = vectorP
    this.config = config
  }

  async addFile(filePath: string): Promise<void> {
    const mimeType = await presenter.filePresenter.getMimeType(filePath)
    const fileInfo = await presenter.filePresenter.prepareFile(filePath, mimeType)

    await this.vectorP.insertFile({
      id: nanoid(),
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
    const content = fileInfo.content
    
  }
  reAddFile(fileId: string) {
    throw new Error('Method not implemented.')
  }
  deleteFile(fileId: string) {
    throw new Error('Method not implemented.')
  }
  queryFile(
    fileId: string
  ):
    | import('@shared/presenter').KnowledgeFileMessage
    | PromiseLike<import('@shared/presenter').KnowledgeFileMessage | null>
    | null {
    throw new Error('Method not implemented.')
  }
  listFiles():
    | import('@shared/presenter').KnowledgeFileMessage[]
    | PromiseLike<import('@shared/presenter').KnowledgeFileMessage[]> {
    throw new Error('Method not implemented.')
  }

  async reset() {}

  async destory() {
    this.vectorP.destroy()
  }
}

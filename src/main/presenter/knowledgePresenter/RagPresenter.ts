import { IVectorDatabasePresenter } from '@shared/presenter'
import { presenter } from '@/presenter'

export class RagPresenter {
  private readonly vectorP: IVectorDatabasePresenter
  private readonly embeddingProxy: (texts: string[]) => Promise<any>

  constructor(
    vectorP: IVectorDatabasePresenter,
    embeddingProxy: (texts: string[]) => Promise<any>
  ) {
    this.vectorP = vectorP
    this.embeddingProxy = embeddingProxy
  }

  async addFile(filePath: string): Promise<void> {
    
    const tests = ['1', '2', '3']
    const embeddings = await this.embeddingProxy(tests)
    this.vectorP.insertVectors(
      embeddings.map((embedding) => {
        return {
          vector: embedding.vector,
          metadata: embedding.metadata || {}
        }
      })
    )
  }

  async reset() {}

  async destory() {
    this.vectorP.destroy()
  }
}

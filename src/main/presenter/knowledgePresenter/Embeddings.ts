import type { BaseEmbeddings } from '@llm-tools/embedjs-interfaces'

import EmbeddingsFactory from './EmbeddingsFactory'
import { KnowledgeBaseParams } from '@shared/presenter'

export default class Embeddings {
  private sdk: BaseEmbeddings
  constructor({ modelId, providerId, apiKey, apiVersion, baseURL, dimensions }: KnowledgeBaseParams) {
    this.sdk = EmbeddingsFactory.create({
      modelId,
      providerId,
      apiKey,
      apiVersion,
      baseURL,
      dimensions
    } as KnowledgeBaseParams)
  }
  public async init(): Promise<void> {
    return this.sdk.init()
  }
  public async getDimensions(): Promise<number> {
    return this.sdk.getDimensions()
  }
  public async embedDocuments(texts: string[]): Promise<number[][]> {
    return this.sdk.embedDocuments(texts)
  }

  public async embedQuery(text: string): Promise<number[]> {
    return this.sdk.embedQuery(text)
  }
}

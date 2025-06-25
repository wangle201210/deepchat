import type { BaseEmbeddings } from '@llm-tools/embedjs-interfaces'
import { OllamaEmbeddings } from '@llm-tools/embedjs-ollama'
import { AzureOpenAiEmbeddings, OpenAiEmbeddings } from '@llm-tools/embedjs-openai'

import { KnowledgeBaseParams } from '@shared/presenter'

export default class EmbeddingsFactory {
  static create({
    modelId,
    providerId,
    apiKey,
    apiVersion,
    baseURL,
    dimensions
  }: KnowledgeBaseParams): BaseEmbeddings {
    const batchSize = 10
    if (providerId === 'ollama') {
      if (baseURL.includes('v1/')) {
        return new OllamaEmbeddings({
          model: modelId,
          baseUrl: baseURL.replace('v1/', ''),
          requestOptions: {
            // @ts-ignore expected
            'encoding-format': 'float'
          }
        })
      }
      return new OllamaEmbeddings({
        model: modelId,
        baseUrl: baseURL,
        requestOptions: {
          // @ts-ignore expected
          'encoding-format': 'float'
        }
      })
    }
    if (apiVersion !== undefined) {
      return new AzureOpenAiEmbeddings({
        azureOpenAIApiKey: apiKey,
        azureOpenAIApiVersion: apiVersion,
        azureOpenAIApiDeploymentName: modelId,
        azureOpenAIApiInstanceName: this.getInstanceName(baseURL),
        dimensions,
        batchSize
      })
    }
    return new OpenAiEmbeddings({
      model: modelId,
      apiKey,
      dimensions,
      batchSize,
      configuration: { baseURL }
    })
  }

  static getInstanceName(baseURL: string) {
    try {
      return new URL(baseURL).host.split('.')[0]
    } catch (error) {
      return ''
    }
  }
}

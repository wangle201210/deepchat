import type { BaseEmbeddings } from '@llm-tools/embedjs-interfaces'
import { OllamaEmbeddings } from '@llm-tools/embedjs-ollama'
import { AzureOpenAiEmbeddings, OpenAiEmbeddings } from '@llm-tools/embedjs-openai'

import { KnowledgeBaseParams } from '@shared/presenter'

export default class EmbeddingsFactory {
  static create({
    model,
    provider,
    apiKey,
    apiVersion,
    baseURL,
    dimensions
  }: KnowledgeBaseParams): BaseEmbeddings {
    const batchSize = 10
    if (provider === 'ollama') {
      if (baseURL.includes('v1/')) {
        return new OllamaEmbeddings({
          model: model,
          baseUrl: baseURL.replace('v1/', ''),
          requestOptions: {
            // @ts-ignore expected
            'encoding-format': 'float'
          }
        })
      }
      return new OllamaEmbeddings({
        model: model,
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
        azureOpenAIApiDeploymentName: model,
        azureOpenAIApiInstanceName: this.getInstanceName(baseURL),
        dimensions,
        batchSize
      })
    }
    return new OpenAiEmbeddings({
      model,
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

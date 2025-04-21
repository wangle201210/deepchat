import { ModelConfig } from '@shared/presenter'
import { defaultModelsSettings } from '../configPresenter/models'

export interface ProviderModelConfigs {
  [modelId: string]: ModelConfig
}

/**
 * 获取指定provider和model的推荐配置
 * @param modelId 模型ID
 * @returns ModelConfig | undefined 如果找到配置则返回，否则返回undefined
 */
export function getModelConfig(modelId: string): ModelConfig {
  // 首先查找完全匹配的配置
  for (const config of defaultModelsSettings) {
    // 将modelId转为小写以进行不区分大小写的匹配
    const lowerModelId = modelId.toLowerCase()

    // 检查是否有任何匹配条件符合
    if (config.match.some((matchStr) => lowerModelId.includes(matchStr.toLowerCase()))) {
      return {
        maxTokens: config.maxTokens,
        contextLength: config.contextLength,
        temperature: config.temperature,
        vision: config.vision,
        functionCall: config.functionCall || false,
        reasoning: config.reasoning || false
      }
    }
  }

  // 如果没有找到匹配的配置，返回默认的安全配置
  return {
    maxTokens: 4096,
    contextLength: 8192,
    temperature: 0.6,
    vision: false,
    functionCall: false,
    reasoning: false
  }
}

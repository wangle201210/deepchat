import { ModelType } from '@shared/model'
import { ModelConfig } from '@shared/presenter'
import ElectronStore from 'electron-store'
import { defaultModelsSettings } from './modelDefaultSettings'
import { getProviderSpecificModelConfig } from './providerModelSettings'

interface IModelConfig {
  id: string
  providerId: string
  config: ModelConfig
}

const SPECIAL_CONCAT_CHAR = '-_-'

export class ModelConfigHelper {
  private modelConfigStore: ElectronStore<Record<string, IModelConfig>>

  constructor() {
    this.modelConfigStore = new ElectronStore<Record<string, IModelConfig>>({
      name: 'model-config'
    })
  }

  /**
   * Get model configuration with priority: user config > provider config > default config
   * @param modelId - The model ID
   * @param providerId - Optional provider ID
   * @returns ModelConfig
   */
  getModelConfig(modelId: string, providerId?: string): ModelConfig {
    // 1. First try to get user-defined config for this specific provider + model
    if (providerId) {
      const userConfig = this.modelConfigStore.get(providerId + SPECIAL_CONCAT_CHAR + modelId)
      if (userConfig?.config) {
        return userConfig.config
      }
    }

    // 2. Try to get provider-specific default config
    if (providerId) {
      const providerConfig = getProviderSpecificModelConfig(providerId, modelId)
      if (providerConfig) {
        return providerConfig
      }
    }

    // 3. Try to get default model config by pattern matching
    const lowerModelId = modelId.toLowerCase()
    for (const config of defaultModelsSettings) {
      if (config.match.some((matchStr) => lowerModelId.includes(matchStr.toLowerCase()))) {
        return {
          maxTokens: config.maxTokens,
          contextLength: config.contextLength,
          temperature: config.temperature,
          vision: config.vision,
          functionCall: config.functionCall || false,
          reasoning: config.reasoning || false,
          type: config.type || ModelType.Chat
        }
      }
    }

    // 4. Return safe default config if nothing matches
    return {
      maxTokens: 4096,
      contextLength: 8192,
      temperature: 0.6,
      vision: false,
      functionCall: false,
      reasoning: false,
      type: ModelType.Chat
    }
  }

  /**
   * Set model configuration for a specific provider and model
   * @param modelId - The model ID
   * @param providerId - The provider ID
   * @param config - The model configuration
   */
  setModelConfig(modelId: string, providerId: string, config: ModelConfig): void {
    this.modelConfigStore.set(providerId + SPECIAL_CONCAT_CHAR + modelId, {
      id: modelId,
      providerId: providerId,
      config: config
    })
  }

  /**
   * Reset model configuration for a specific provider and model
   * @param modelId - The model ID
   * @param providerId - The provider ID
   */
  resetModelConfig(modelId: string, providerId: string): void {
    this.modelConfigStore.delete(providerId + SPECIAL_CONCAT_CHAR + modelId)
  }

  /**
   * Get all user-defined model configurations
   * @returns Record of all configurations
   */
  getAllModelConfigs(): Record<string, IModelConfig> {
    return this.modelConfigStore.store
  }

  /**
   * Get configurations for a specific provider
   * @param providerId - The provider ID
   * @returns Array of model configurations
   */
  getProviderModelConfigs(providerId: string): Array<{ modelId: string; config: ModelConfig }> {
    const allConfigs = this.getAllModelConfigs()
    const result: Array<{ modelId: string; config: ModelConfig }> = []

    Object.entries(allConfigs).forEach(([key, value]) => {
      if (key.startsWith(providerId + SPECIAL_CONCAT_CHAR)) {
        result.push({
          modelId: value.id,
          config: value.config
        })
      }
    })

    return result
  }

  /**
   * Check if a model has user-defined configuration
   * @param modelId - The model ID
   * @param providerId - The provider ID
   * @returns boolean
   */
  hasUserConfig(modelId: string, providerId: string): boolean {
    const userConfig = this.modelConfigStore.get(providerId + SPECIAL_CONCAT_CHAR + modelId)
    return !!userConfig
  }

  /**
   * Import model configurations (used for sync restore)
   * @param configs - Model configurations to import
   * @param overwrite - Whether to overwrite existing configurations
   */
  importConfigs(configs: Record<string, IModelConfig>, overwrite: boolean = false): void {
    if (overwrite) {
      // Clear existing configs
      this.modelConfigStore.clear()
    }

    // Import configs
    Object.entries(configs).forEach(([key, value]) => {
      if (overwrite || !this.modelConfigStore.has(key)) {
        this.modelConfigStore.set(key, value)
      }
    })
  }

  /**
   * Export all model configurations for backup
   * @returns Object containing all configurations
   */
  exportConfigs(): Record<string, IModelConfig> {
    return this.getAllModelConfigs()
  }

  /**
   * Clear all configurations
   */
  clearAllConfigs(): void {
    this.modelConfigStore.clear()
  }

  /**
   * Get store path for sync backup
   * @returns Store file path
   */
  getStorePath(): string {
    return this.modelConfigStore.path
  }
}
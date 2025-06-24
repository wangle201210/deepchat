import ElectronStore from 'electron-store'
import { KnowledgeBaseParams } from '@shared/presenter'

export class KnowledgeConfHelper {
  private store: ElectronStore<{ knowledgeConfigs: KnowledgeBaseParams[] }>

  constructor() {
    this.store = new ElectronStore<{ knowledgeConfigs: KnowledgeBaseParams[] }>({
      name: 'knowledge-configs',
      defaults: {
        knowledgeConfigs: []
      }
    })
  }

  // 获取所有知识库配置
  getKnowledgeConfigs(): KnowledgeBaseParams[] {
    return this.store.get('knowledgeConfigs') || []
  }

  // 设置所有知识库配置
  setKnowledgeConfigs(configs: KnowledgeBaseParams[]): void {
    this.store.set('knowledgeConfigs', configs)
  }

  /**
   * diff 新旧配置，返回 { added, updated, deleted }
   * @param oldConfigs
   * @param newConfigs
   * @returns
   */
  static diffKnowledgeConfigs(
    oldConfigs: KnowledgeBaseParams[],
    newConfigs: KnowledgeBaseParams[]
  ): {
    added: KnowledgeBaseParams[]
    deleted: KnowledgeBaseParams[]
    updated: KnowledgeBaseParams[]
  } {
    const oldMap = new Map(oldConfigs.map((cfg) => [cfg.id, cfg]))
    const newMap = new Map(newConfigs.map((cfg) => [cfg.id, cfg]))

    const added = newConfigs.filter((cfg) => !oldMap.has(cfg.id))
    const deleted = oldConfigs.filter((cfg) => !newMap.has(cfg.id))
    const updated = newConfigs.filter(
      (cfg) => oldMap.has(cfg.id) && JSON.stringify(cfg) !== JSON.stringify(oldMap.get(cfg.id))
    )

    return { added, deleted, updated }
  }
}

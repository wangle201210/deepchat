// src/shared/presenter.ts
// 实现 enum 及运行时需要的导出，避免 Vite 报错

export enum ModelType {
  Chat = 'chat',
  Embedding = 'embedding',
  Rerank = 'rerank',
  ImageGeneration = 'imageGeneration'
}

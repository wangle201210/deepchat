import { EventEmitter } from 'events'
import type {
  IKnowledgeTaskPresenter,
  ChunkProcessingTask,
  ChunkTask,
  QueueStatus,
  GlobalTaskStatus,
  ChunkProcessor
} from '@shared/presenter'

export interface FileTaskContext {
  knowledgeBaseId: string
  fileId: string
  totalChunks: number
  completedChunks: number
  errorChunks: number
  status: 'processing' | 'completed' | 'error' | 'paused'
  processor: ChunkProcessor
}

/**
 * TaskManager - 专注于全局任务调度和并发控制
 */
export class KnowledgeTaskPresenter extends EventEmitter implements IKnowledgeTaskPresenter {
  private readonly maxConcurrency: number = 3
  private readonly globalQueue: ChunkProcessingTask[] = []
  private readonly knowledgeBaseQueues: Map<string, ChunkProcessingTask[]> = new Map()
  private readonly runningTasks: Map<string, Promise<void>> = new Map()
  private readonly fileContexts: Map<string, FileTaskContext> = new Map()
  private readonly knowledgeBasePaused: Set<string> = new Set()
  private isPaused: boolean = false

  constructor() {
    super()
  }

  /**
   * 调度分块任务
   */
  async scheduleChunkTask(task: ChunkProcessingTask): Promise<void> {
    console.log(`[TaskManager] Scheduling chunk task: ${task.id} for file ${task.fileId}`)

    // 添加到知识库队列
    if (!this.knowledgeBaseQueues.has(task.knowledgeBaseId)) {
      this.knowledgeBaseQueues.set(task.knowledgeBaseId, [])
    }
    this.knowledgeBaseQueues.get(task.knowledgeBaseId)!.push(task)

    // 添加到全局队列
    this.globalQueue.push(task)

    // 触发任务处理
    this.processQueue()
  }

  /**
   * 获取知识库队列状态
   */
  getQueueStatus(knowledgeBaseId: string): QueueStatus {
    const queue = this.knowledgeBaseQueues.get(knowledgeBaseId) || []
    const runningCount = Array.from(this.runningTasks.keys()).filter((taskId) =>
      queue.some((task) => task.id === taskId)
    ).length

    return {
      queueLength: queue.length,
      runningTasks: runningCount,
      fileContexts: Array.from(this.fileContexts.values()).filter(
        (ctx) => ctx.knowledgeBaseId === knowledgeBaseId
      ).length,
      isPaused: this.knowledgeBasePaused.has(knowledgeBaseId)
    }
  }

  /**
   * 获取全局任务状态
   */
  getGlobalStatus(): GlobalTaskStatus {
    const knowledgeBaseStatuses = new Map<string, QueueStatus>()
    for (const knowledgeBaseId of this.knowledgeBaseQueues.keys()) {
      knowledgeBaseStatuses.set(knowledgeBaseId, this.getQueueStatus(knowledgeBaseId))
    }

    return {
      totalTasks: this.globalQueue.length + this.runningTasks.size,
      runningTasks: this.runningTasks.size,
      queuedTasks: this.globalQueue.length,
      knowledgeBaseStatuses
    }
  }

  /**
   * 暂停知识库任务
   */
  pauseKnowledgeBase(knowledgeBaseId: string): void {
    this.knowledgeBasePaused.add(knowledgeBaseId)
    console.log(`[TaskManager] Paused knowledge base: ${knowledgeBaseId}`)
  }

  /**
   * 恢复知识库任务
   */
  resumeKnowledgeBase(knowledgeBaseId: string): void {
    this.knowledgeBasePaused.delete(knowledgeBaseId)
    console.log(`[TaskManager] Resumed knowledge base: ${knowledgeBaseId}`)
    this.processQueue()
  }

  /**
   * 暂停所有任务
   */
  pauseAllTasks(): void {
    this.isPaused = true
    console.log('[TaskManager] Paused all tasks')
  }

  /**
   * 恢复所有任务
   */
  resumeAllTasks(): void {
    this.isPaused = false
    console.log('[TaskManager] Resumed all tasks')
    this.processQueue()
  }

  /**
   * 处理任务队列
   */
  private processQueue(): void {
    if (this.isPaused) return

    // 在并发限制内执行任务
    while (this.runningTasks.size < this.maxConcurrency && this.globalQueue.length > 0) {
      const task = this.findNextAvailableTask()
      if (task) {
        this.executeTask(task)
      } else {
        break
      }
    }
  }

  /**
   * 查找下一个可执行的任务
   */
  private findNextAvailableTask(): ChunkProcessingTask | null {
    for (let i = 0; i < this.globalQueue.length; i++) {
      const task = this.globalQueue[i]
      if (!this.knowledgeBasePaused.has(task.knowledgeBaseId)) {
        // 从队列中移除
        this.globalQueue.splice(i, 1)
        const kbQueue = this.knowledgeBaseQueues.get(task.knowledgeBaseId)
        if (kbQueue) {
          const kbIndex = kbQueue.findIndex((t) => t.id === task.id)
          if (kbIndex >= 0) {
            kbQueue.splice(kbIndex, 1)
          }
        }
        return task
      }
    }
    return null
  }

  /**
   * 执行单个任务
   */
  private async executeTask(task: ChunkProcessingTask): Promise<void> {
    const chunkTask: ChunkTask = {
      id: task.id,
      knowledgeBaseId: task.knowledgeBaseId,
      fileId: task.fileId,
      chunkIndex: task.chunkIndex,
      content: task.chunkContent,
      metadata: {},
      status: 'processing',
      createdAt: Date.now(),
      startedAt: Date.now()
    }

    const taskPromise = this.runTask(task, chunkTask)
    this.runningTasks.set(task.id, taskPromise)

    try {
      await taskPromise
    } finally {
      this.runningTasks.delete(task.id)
      // 继续处理队列
      this.processQueue()
    }
  }

  /**
   * 运行任务并处理结果
   */
  private async runTask(task: ChunkProcessingTask, chunkTask: ChunkTask): Promise<void> {
    try {
      console.log(`[TaskManager] Executing task: ${task.id}`)

      // 调用处理器处理分块
      await task.processorCallback.processChunk(chunkTask)

      chunkTask.status = 'pending' // 标记为完成
      chunkTask.completedAt = Date.now()

      // 检查文件是否完成
      await this.checkFileCompletion(task.fileId, task.processorCallback)
    } catch (error) {
      console.error(`[TaskManager] Task execution failed: ${task.id}`, error)

      chunkTask.status = 'error'
      chunkTask.error = error instanceof Error ? error.message : String(error)

      // 通知处理器处理错误
      try {
        await task.processorCallback.handleChunkError(task.id, error as Error)
      } catch (callbackError) {
        console.error(`[TaskManager] Error callback failed:`, callbackError)
      }
    }
  }

  /**
   * 检查文件是否处理完成
   */
  private async checkFileCompletion(fileId: string, processor: ChunkProcessor): Promise<void> {
    // 检查该文件的所有任务是否都已完成
    const fileTasksInQueue = this.globalQueue.filter((task) => task.fileId === fileId)
    const fileTasksRunning = Array.from(this.runningTasks.keys())
      .map((taskId) => this.globalQueue.find((task) => task.id === taskId))
      .filter((task) => task && task.fileId === fileId)

    if (fileTasksInQueue.length === 0 && fileTasksRunning.length === 0) {
      // 文件处理完成
      try {
        await processor.handleFileCompletion(fileId)
        console.log(`[TaskManager] File processing completed: ${fileId}`)
      } catch (error) {
        console.error(`[TaskManager] File completion callback failed:`, error)
      }
    }
  }

  /**
   * 清理指定知识库的所有任务
   */
  clearKnowledgeBaseTasks(knowledgeBaseId: string): void {
    // 从全局队列中移除
    for (let i = this.globalQueue.length - 1; i >= 0; i--) {
      if (this.globalQueue[i].knowledgeBaseId === knowledgeBaseId) {
        this.globalQueue.splice(i, 1)
      }
    }

    // 清理知识库队列
    this.knowledgeBaseQueues.delete(knowledgeBaseId)

    // 清理文件上下文
    const filesToRemove: string[] = []
    for (const [fileId, context] of this.fileContexts.entries()) {
      if (context.knowledgeBaseId === knowledgeBaseId) {
        filesToRemove.push(fileId)
      }
    }
    filesToRemove.forEach((fileId) => this.fileContexts.delete(fileId))

    console.log(`[TaskManager] Cleared all tasks for knowledge base: ${knowledgeBaseId}`)
  }

  /**
   * 清理指定文件的所有任务（包括队列和运行中）
   */
  clearFileTasks(fileId: string): void {
    // 从全局队列中移除
    for (let i = this.globalQueue.length - 1; i >= 0; i--) {
      if (this.globalQueue[i].fileId === fileId) {
        this.globalQueue.splice(i, 1)
      }
    }

    // 从知识库队列中移除
    for (const queue of this.knowledgeBaseQueues.values()) {
      for (let i = queue.length - 1; i >= 0; i--) {
        if (queue[i].fileId === fileId) {
          queue.splice(i, 1)
        }
      }
    }

    // 停止运行中的任务（无法直接取消Promise，只能移除引用，实际任务需在业务层判断文件是否已删除）
    for (const [taskId, taskPromise] of this.runningTasks.entries()) {
      const task = this.globalQueue.find((t) => t.id === taskId)
      if (task && task.fileId === fileId) {
        this.runningTasks.delete(taskId)
      }
    }

    // 清理文件上下文
    this.fileContexts.delete(fileId)

    console.log(`[TaskManager] Cleared all tasks for file: ${fileId}`)
  }
}

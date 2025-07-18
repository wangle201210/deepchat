import { IKnowledgeTaskPresenter, KnowledgeChunkTask, TaskQueueStatus } from '@shared/presenter'

/**
 * KnowledgeTaskManager - 专注于全局任务调度和并发控制
 */
export class KnowledgeTaskPresenter implements IKnowledgeTaskPresenter {
  private readonly maxConcurrency: number
  private queue: KnowledgeChunkTask[] = []
  private runningTasks: Map<string, KnowledgeChunkTask> = new Map()
  private controllers: Map<string, AbortController> = new Map()

  constructor(maxConcurrency = 3) {
    this.maxConcurrency = maxConcurrency
  }

  addTask(task: KnowledgeChunkTask): void {
    console.log(`[RAG TASK] Adding task: ${task.id}`)
    this.queue.push(task)
    this.controllers.set(task.id, new AbortController())
    this.processQueue()
  }

  removeTasks(filter: (task: KnowledgeChunkTask) => boolean): void {
    // 移除队列中的任务
    this.queue = this.queue.filter((task) => {
      if (filter(task)) {
        console.log(`[RAG TASK] Removing queued task: ${task.id}`)
        this.terminateTask(task.id)
        return false // 移除
      }
      return true // 保留
    })

    // 终止正在运行的任务
    for (const task of this.runningTasks.values()) {
      if (filter(task)) {
        console.log(`[RAG TASK] Terminating running task: ${task.id}`)
        this.terminateTask(task.id)
      }
    }
  }

  getStatus(): TaskQueueStatus {
    return {
      totalTasks: this.queue.length + this.runningTasks.size,
      runningTasks: this.runningTasks.size,
      queuedTasks: this.queue.length
    }
  }

  destroy(): void {
    console.log('[RAG TASK] Destroying TaskManager, all tasks will be terminated.')
    this.removeTasks(() => true) // 移除所有任务
    this.queue = []
    this.runningTasks.clear()
    this.controllers.clear()
  }

  private terminateTask(taskId: string): void {
    const controller = this.controllers.get(taskId)
    if (controller) {
      controller.abort()
      this.controllers.delete(taskId)
    }
  }

  private processQueue(): void {
    while (this.runningTasks.size < this.maxConcurrency && this.queue.length > 0) {
      const task = this.queue.shift()
      if (task) {
        this.executeTask(task)
      }
    }
  }

  private async executeTask(task: KnowledgeChunkTask): Promise<void> {
    const controller = this.controllers.get(task.id)
    if (!controller) {
      // 可能已经被移除了
      return
    }

    // 检查任务在执行前是否已被终止
    if (controller.signal.aborted) {
      console.log(`[RAG TASK] Task ${task.id} was aborted before execution.`)
      task.onTerminate?.()
      this.controllers.delete(task.id)
      return
    }

    this.runningTasks.set(task.id, task)
    console.log(`[RAG TASK] Executing task: ${task.id}. Running: ${this.runningTasks.size}`)

    try {
      const result = await (task.run({ signal: controller.signal }))
      // 再次检查，因为任务可能在 run() 内部被终止但没有抛出异常
      if (controller.signal.aborted) {
        task.onTerminate?.()
      } else {
        task.onSuccess?.(result)
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        console.log(`[RAG TASK] Task ${task.id} aborted during execution.`)
        task.onTerminate?.()
      } else {
        console.error(`[RAG TASK] Task ${task.id} failed with error:`, error)
        task.onError?.(error as Error)
      }
    } finally {
      this.runningTasks.delete(task.id)
      this.controllers.delete(task.id)
      console.log(`[RAG TASK] Task ${task.id} finished. Running: ${this.runningTasks.size}`)
      this.processQueue()
    }
  }
}

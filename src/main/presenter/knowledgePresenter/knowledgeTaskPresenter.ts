import { IKnowledgeTaskPresenter, KnowledgeChunkTask, TaskQueueStatus } from '@shared/presenter'

/**
 * KnowledgeTaskPresenter - 专注于全局任务调度和顺序执行
 *
 * ## 设计思路
 *
 * 1.  **单一处理循环**:
 *     - 使用 `isProcessing` 标志位和一个 `while` 循环来创建一个常驻的后台处理循环 (`processQueue` 方法)。
 *     - 这种模式确保了在任何时候只有一个任务在执行，从根本上避免了并发问题。
 *
 * 2.  **顺序执行**:
 *     - 任务被添加到 `queue` 中，然后由 `processQueue` 循环按顺序取出并执行。
 *     - `await task.run(...)` 会等待当前任务完全结束后，循环才会进入下一次迭代，处理下一个任务。这保证了任务的严格顺序执行。
 *
 * 3.  **终止和清理**:
 *     - `removeTasks` 方法现在可以精确地终止正在运行的任务或从队列中移除待处理的任务。
 *     - `destroy` 方法会清空队列并终止正在处理的循环，确保资源被正确释放。
 *
 * 4.  **健壮性**:
 *     - `try...catch...finally` 结构确保了即使任务执行失败，`isProcessing` 标志也会被重置，从而允许队列继续处理（或在修复问题后重新启动）。
 *     - 对 `AbortController` 的管理确保了可以取消正在运行的异步任务。
 *
 * 这种设计将任务调度从“并发”模型转变为“顺序”模型，更适合于需要严格顺序访问资源的场景（如 DuckDB 的写操作），从而提高了稳定性和可预测性。
 */
export class KnowledgeTaskPresenter implements IKnowledgeTaskPresenter {
  private queue: KnowledgeChunkTask[] = []
  private controllers: Map<string, AbortController> = new Map()
  private isProcessing = false
  private currentTask: KnowledgeChunkTask | null = null

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
    if (this.currentTask && filter(this.currentTask)) {
      console.log(`[RAG TASK] Terminating running task: ${this.currentTask.id}`)
      this.terminateTask(this.currentTask.id)
    }
  }

  getStatus(): TaskQueueStatus {
    const runningCount = this.currentTask ? 1 : 0
    return {
      totalTasks: this.queue.length + runningCount,
      runningTasks: runningCount,
      queuedTasks: this.queue.length
    }
  }

  destroy(): void {
    console.log('[RAG TASK] Destroying TaskManager, all tasks will be terminated.')
    this.removeTasks(() => true) // 移除所有任务
    this.queue = []
    this.currentTask = null
    this.controllers.clear()
  }

  private terminateTask(taskId: string): void {
    const controller = this.controllers.get(taskId)
    if (controller) {
      controller.abort()
      // Don't delete here, let the processing loop handle it
    }
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing) {
      return
    }
    this.isProcessing = true

    while (this.queue.length > 0) {
      const task = this.queue.shift()
      if (!task) {
        continue
      }

      this.currentTask = task
      const controller = this.controllers.get(task.id)

      if (!controller || controller.signal.aborted) {
        console.log(`[RAG TASK] Task ${task.id} was aborted before execution.`)
        task.onTerminate?.()
        this.controllers.delete(task.id)
        this.currentTask = null
        continue
      }

      console.log(`[RAG TASK] Executing task: ${task.id}. Queue size: ${this.queue.length}`)

      try {
        const result = await task.run({ signal: controller.signal })
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
        this.controllers.delete(task.id)
        this.currentTask = null
        console.log(`[RAG TASK] Task ${task.id} finished.`)
      }
    }

    this.isProcessing = false
  }
}

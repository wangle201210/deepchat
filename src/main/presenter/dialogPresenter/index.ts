/**
 * 通过渲染进程实现的默认窗口消息弹窗
 * 窗口在后台会自动弹出
 */
import { DialogRequest, IDialogPresenter } from '@shared/presenter'
import { eventBus, SendTarget } from '@/eventbus'
import { DIALOG_EVENTS } from '@/events'

export class DialogPresenter implements IDialogPresenter {
  private pendingResolve: ((response: string | null) => void) | null = null

  constructor() {}

  /**
   * 显示Dialog - 通过渲染进程实现
   * @param request Dialog请求参数
   * @returns Promise<DialogResponse> Dialog结果
   */
  async showDialog(request: DialogRequest): Promise<string | null> {
    return new Promise((resolve) => {
      this.pendingResolve = resolve

      // 向渲染进程发送dialog请求
      eventBus.sendToRenderer(DIALOG_EVENTS.REQUEST, SendTarget.DEFAULT_TAB, request)
    })
  }

  async handleDialogResponse(response: string | null): Promise<void> {
    if (this.pendingResolve) {
      this.pendingResolve(response)
      this.pendingResolve = null
    }
  }
}

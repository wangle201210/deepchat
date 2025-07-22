import { DialogRequest, IDialogPresenter } from '@shared/presenter'
import { eventBus, SendTarget } from '@/eventbus'
import { DIALOG_EVENTS } from '@/events'

export class DialogPresenter implements IDialogPresenter {
  private pendingDialog: {
    resolve: (response: string) => void
    reject: (error: Error) => void
  } | null = null

  constructor() {
    eventBus.on(DIALOG_EVENTS.RESPONSE, this.handleDialogResponse.bind(this))
  }

  /**
   * 显示Dialog - 通过渲染进程实现
   * @param request Dialog请求参数
   * @returns Promise<DialogResponse> Dialog结果
   */
  async showDialog(request: DialogRequest): Promise<string> {
    return new Promise((resolve, reject) => {
      // 生成唯一ID

      // 存储Promise处理器
      this.pendingDialog = {
        resolve,
        reject
      }

      // 向渲染进程发送dialog请求
      eventBus.sendToRenderer(DIALOG_EVENTS.REQUEST, SendTarget.DEFAULT_TAB, request)
    })
  }

  /**
   * 处理来自渲染进程的Dialog响应
   * @param response Dialog响应
   */
  private handleDialogResponse(response: string) {
    if (this.pendingDialog) {
      // 解析Promise
      this.pendingDialog.resolve(response)
      this.pendingDialog = null
    }
  }
}

/**
 * 通过渲染进程实现的消息弹窗
 * 弹窗显示在当前活动的标签页上，如果标签页在后台，会自动切换到前台
 * 单个活动窗口内只能有一个消息弹窗，重复调用会将之前的弹窗以null触发回调
 * @see {@link SendTarget.DEFAULT_TAB}
 */
import {
  DialogRequest,
  DialogRequestParams,
  DialogResponse,
  IDialogPresenter
} from '@shared/presenter'
import { eventBus, SendTarget } from '@/eventbus'
import { DIALOG_EVENTS } from '@/events'
import { nanoid } from 'nanoid'

export class DialogPresenter implements IDialogPresenter {
  private pendingDialogs = new Map<string, (response: string | null) => void>()

  constructor() {}

  /**
   * 显示Dialog - 通过渲染进程实现
   * @param request Dialog请求参数
   * @returns Promise<DialogResponse> Dialog结果
   */
  async showDialog(request: DialogRequestParams): Promise<string | null> {
    return new Promise((resolve, reject) => {
      try {
        const finalRequest: DialogRequest = {
          id: nanoid(8), // 最好是使用当前DEFAULT_TAB的id，便于控制单窗口内最多一个弹窗，但目前似乎缺少获取途径
          title: request.title,
          description: request.description,
          i18n: request.i18n ?? false,
          type: request.type,
          buttons: request.buttons ?? ['OK'],
          defaultId: request.defaultId ?? 0,
          timeout: request.timeout ?? 0
        }

        this.pendingDialogs.set(finalRequest.id, resolve)

        console.log('[Dialog] request sent:', finalRequest.id)
        // 向渲染进程发送dialog请求
        eventBus.sendToRenderer(DIALOG_EVENTS.REQUEST, SendTarget.DEFAULT_TAB, finalRequest)
      } catch (err) {
        reject(err)
      }
    })
  }

  /**
   * 处理对话框响应
   * @param response 对话框响应
   */
  async handleDialogResponse(response: DialogResponse): Promise<void> {
    if (this.pendingDialogs.has(response.id)) {
      console.log('[Dialog]  response received:', response)
      const resolve = this.pendingDialogs.get(response.id)
      this.pendingDialogs.delete(response.id)
      resolve?.(response.button)
    }
  }
}

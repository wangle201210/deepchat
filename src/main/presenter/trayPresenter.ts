import { Tray, Menu, app, nativeImage, NativeImage } from 'electron'
import path from 'path'
import { getContextMenuLabels } from '@shared/i18n'
import { presenter } from '.'
import { eventBus } from '@/eventbus'
import { TRAY_EVENTS } from '@/events'

export class TrayPresenter {
  private tray: Tray | null = null
  private iconPath: string

  constructor() {
    this.iconPath = path.join(app.getAppPath(), 'resources')
  }

  private createTray() {
    // 根据平台选择不同的图标
    let image: NativeImage | undefined = undefined
    if (process.platform === 'darwin') {
      image = nativeImage.createFromPath(path.join(this.iconPath, 'macTrayTemplate.png'))
      image = image.resize({ width: 24, height: 24 })
      image.setTemplateImage(true)
    } else {
      image = nativeImage.createFromPath(path.join(this.iconPath, 'win_tray.ico'))
    }
    this.tray = new Tray(image)
    this.tray.setToolTip('DeepChat')

    // 获取当前系统语言
    const locale = presenter.configPresenter.getLanguage?.() || 'zh-CN'
    const labels = getContextMenuLabels(locale)
    const contextMenu = Menu.buildFromTemplate([
      {
        label: labels.open || '打开',
        click: () => {
          eventBus.emit(TRAY_EVENTS.SHOW_WINDOW)
        }
      },
      {
        label: labels.quit || '退出',
        click: () => {
          app.quit()
        }
      }
    ])

    this.tray.setContextMenu(contextMenu)

    // 点击托盘图标时显示窗口
    this.tray.on('click', () => {
      eventBus.emit(TRAY_EVENTS.SHOW_WINDOW)
    })
  }

  public init(): void {
    this.createTray()
  }

  destroy() {
    if (this.tray) {
      this.tray.destroy()
      this.tray = null
    }
  }
}

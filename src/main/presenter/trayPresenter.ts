import { Tray, Menu, app, nativeImage, NativeImage } from 'electron'
import path from 'path'
import { WindowPresenter } from './windowPresenter'

export class TrayPresenter {
  private tray: Tray | null = null
  private windowPresenter: WindowPresenter
  private iconPath: string

  constructor(windowPresenter: WindowPresenter) {
    this.windowPresenter = windowPresenter
    this.iconPath = path.join(app.getAppPath(), 'resources')
    this.createTray()
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

    const contextMenu = Menu.buildFromTemplate([
      {
        label: '打开',
        click: () => {
          this.windowPresenter.show()
        }
      },
      {
        label: '退出',
        click: () => {
          app.quit()
        }
      }
    ])

    this.tray.setContextMenu(contextMenu)

    // 点击托盘图标时显示窗口
    this.tray.on('click', () => {
      this.windowPresenter.show()
    })
  }

  destroy() {
    if (this.tray) {
      this.tray.destroy()
      this.tray = null
    }
  }
}

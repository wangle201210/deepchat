import { IDevicePresenter, DeviceInfo, MemoryInfo, DiskInfo } from '../../../shared/presenter'
import os from 'os'
import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'
import { app, dialog } from 'electron'
const execAsync = promisify(exec)

export class DevicePresenter implements IDevicePresenter {
  static getDefaultHeaders() {
    return {
      'HTTP-Referer': 'https://deepchatai.cn',
      'X-Title': 'DeepChat'
    }
  }
  async getAppVersion(): Promise<string> {
    return app.getVersion()
  }

  async getDeviceInfo(): Promise<DeviceInfo> {
    return {
      platform: process.platform,
      arch: process.arch,
      cpuModel: os.cpus()[0].model,
      totalMemory: os.totalmem(),
      osVersion: os.release()
    }
  }

  async getCPUUsage(): Promise<number> {
    const startMeasure = os.cpus().map((cpu) => cpu.times)

    // Wait for 100ms to get a meaningful CPU usage measurement
    await new Promise((resolve) => setTimeout(resolve, 100))

    const endMeasure = os.cpus().map((cpu) => cpu.times)

    const idleDifferences = endMeasure.map((end, i) => {
      const start = startMeasure[i]
      const idle = end.idle - start.idle
      const total =
        end.user -
        start.user +
        (end.nice - start.nice) +
        (end.sys - start.sys) +
        (end.irq - start.irq) +
        idle
      return 1 - idle / total
    })

    // Return average CPU usage across all cores
    return (idleDifferences.reduce((sum, idle) => sum + idle, 0) / idleDifferences.length) * 100
  }

  async getMemoryUsage(): Promise<MemoryInfo> {
    const total = os.totalmem()
    const free = os.freemem()
    const used = total - free

    return {
      total,
      free,
      used
    }
  }

  async getDiskSpace(): Promise<DiskInfo> {
    if (process.platform === 'win32') {
      // Windows implementation
      const { stdout } = await execAsync('wmic logicaldisk get size,freespace')
      const lines = stdout.trim().split('\n').slice(1)
      let total = 0
      let free = 0

      lines.forEach((line) => {
        const [freeSpace, size] = line.trim().split(/\s+/).map(Number)
        if (!isNaN(freeSpace) && !isNaN(size)) {
          free += freeSpace
          total += size
        }
      })

      return {
        total,
        free,
        used: total - free
      }
    } else {
      // Unix-like systems implementation
      const { stdout } = await execAsync('df -k /')
      const [, line] = stdout.trim().split('\n')
      const [, total, , used, free] = line.split(/\s+/)

      return {
        total: parseInt(total) * 1024,
        free: parseInt(free) * 1024,
        used: parseInt(used) * 1024
      }
    }
  }
  async resetData(): Promise<void> {
    return new Promise((resolve, reject) => {
      const response = dialog.showMessageBoxSync({
        type: 'warning',
        buttons: ['确认', '取消'],
        defaultId: 0,
        message: '清除本地的所有数据',
        detail: '注意本操作会导致本地记录彻底删除，你确定么？'
      })
      if (response === 0) {
        try {
          const dbPath = path.join(app.getPath('userData'), 'app_db')
          const removeDirectory = (dirPath: string) => {
            if (fs.existsSync(dirPath)) {
              fs.readdirSync(dirPath).forEach((file) => {
                const currentPath = path.join(dirPath, file)
                if (fs.lstatSync(currentPath).isDirectory()) {
                  removeDirectory(currentPath)
                } else {
                  fs.unlinkSync(currentPath)
                }
              })
              fs.rmdirSync(dirPath)
            }
          }
          removeDirectory(dbPath)

          app.relaunch()
          app.exit()
          resolve()
        } catch (err) {
          console.error('softReset failed')
          reject(err)
          return
        }
      }
    })
  }

  /**
   * 选择目录
   * @returns 返回所选目录的路径，如果用户取消则返回null
   */
  async selectDirectory(): Promise<{ canceled: boolean; filePaths: string[] }> {
    return dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory']
    })
  }

  /**
   * 重启应用程序
   */
  restartApp(): Promise<void> {
    console.log('restartApp')
    app.relaunch()
    app.exit()
    return Promise.resolve()
  }
}

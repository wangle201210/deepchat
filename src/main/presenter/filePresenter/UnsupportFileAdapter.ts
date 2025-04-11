import { BaseFileAdapter } from './BaseFileAdapter'
import fs from 'fs/promises'
export class UnsupportFileAdapter extends BaseFileAdapter {
  private maxFileSize: number
  constructor(filePath: string, maxFileSize: number) {
    super(filePath)
    this.maxFileSize = maxFileSize
  }

  protected getFileDescription(): string | undefined {
    return 'Unsupported File'
  }

  public async getLLMContent(): Promise<string | undefined> {
    const stats = await fs.stat(this.filePath)
    if (stats.size > this.maxFileSize) {
      return undefined
    }
    return ``
  }

  async getContent(): Promise<string | undefined> {
    return ''
  }
}

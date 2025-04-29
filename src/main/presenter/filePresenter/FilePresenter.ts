import { app } from 'electron'
import fs from 'fs/promises'
import path from 'path'
import * as mime from 'mime-types'
import { BaseFileAdapter } from './BaseFileAdapter'
import { FileAdapterConstructor } from './FileAdapterConstructor'
import { FileOperation } from '../../../shared/presenter'
import { getMimeTypeAdapterMap } from './mime'
import { IFilePresenter } from '../../../shared/presenter'
import { MessageFile } from '@shared/chat'
import { approximateTokenSize } from 'tokenx'
import { ImageFileAdapter } from './ImageFileAdapter'
import { nanoid } from 'nanoid'

export class FilePresenter implements IFilePresenter {
  private userDataPath: string
  private maxFileSize: number = 1024 * 1024 * 30 // 30 MB
  private tempDir: string

  constructor() {
    this.userDataPath = app.getPath('userData')
    this.tempDir = path.join(this.userDataPath, 'temp')
    // Ensure temp directory exists
    fs.mkdir(this.tempDir, { recursive: true }).catch(console.error)
  }

  async readFile(relativePath: string): Promise<string> {
    const fullPath = path.join(this.userDataPath, relativePath)
    return fs.readFile(fullPath, 'utf-8')
  }

  async writeFile(operation: FileOperation): Promise<void> {
    const fullPath = path.join(this.userDataPath, operation.path)
    await fs.mkdir(path.dirname(fullPath), { recursive: true })
    await fs.writeFile(fullPath, operation.content || '', 'utf-8')
  }

  async deleteFile(relativePath: string): Promise<void> {
    const fullPath = path.join(this.userDataPath, relativePath)
    await fs.unlink(fullPath)
  }

  async createFileAdapter(filePath: string, typeInfo?: string): Promise<BaseFileAdapter> {
    const ext = path.extname(filePath).toLowerCase()

    // Special handling for .ts files that might be misidentified as video/mp2t
    if (ext === '.ts' || ext === '.tsx') {
      const adapterMap = getMimeTypeAdapterMap()
      const tsAdapter = adapterMap.get('application/typescript')
      if (tsAdapter) {
        return new tsAdapter(filePath, this.maxFileSize)
      }
    }
    let mimeType: string | null = null
    if (typeof typeInfo === 'string') {
      mimeType = typeInfo
    } else {
      mimeType = mime.lookup(filePath)
      if (!mimeType) {
        throw new Error('无法确定文件类型' + filePath)
      }
    }

    const adapterMap = getMimeTypeAdapterMap()
    const AdapterConstructor = this.findAdapterForMimeType(mimeType, adapterMap)
    if (!AdapterConstructor) {
      throw new Error('没有找到对应的文件适配器:' + mimeType)
    }

    return new AdapterConstructor(filePath, this.maxFileSize)
  }

  async prepareFile(absPath: string, typeInfo?: string): Promise<MessageFile> {
    const fullPath = path.join(absPath)
    try {
      const adapter = await this.createFileAdapter(fullPath, typeInfo)
      if (adapter) {
        await adapter.processFile()
        const content = (await adapter.getLLMContent()) ?? ''
        const result = {
          name: adapter.fileMetaData?.fileName ?? '',
          token:
            adapter.mimeType && adapter.mimeType.startsWith('image')
              ? calculateImageTokens(adapter as ImageFileAdapter)
              : adapter.mimeType && adapter.mimeType.startsWith('audio')
                ? approximateTokenSize(`音频文件路径: ${adapter.filePath}`)
                : approximateTokenSize(content || ''),
          path: adapter.filePath,
          mimeType: adapter.mimeType ?? '',
          metadata: adapter.fileMetaData ?? {
            fileName: '',
            fileSize: 0,
            fileDescription: '',
            fileCreated: new Date(),
            fileModified: new Date()
          },
          content: content || ''
        }
        return result
      } else {
        throw new Error(`无法创建文件适配器: ${fullPath}`)
      }
    } catch (error) {
      // Clean up temp file in case of error
      throw new Error(`无法读取文件: ${fullPath}`)
    }
  }

  private findAdapterForMimeType(
    mimeType: string,
    adapterMap: Map<string, FileAdapterConstructor>
  ): FileAdapterConstructor | undefined {
    // 首先尝试精确匹配，一定要先精确匹配，比如text/*默认是 Text Adapter，但是text/csv并不是
    const exactMatch = adapterMap.get(mimeType)
    if (exactMatch) {
      return exactMatch
    }

    // 尝试通配符匹配
    const type = mimeType.split('/')[0]
    const wildcardMatch = adapterMap.get(`${type}/*`)
    return wildcardMatch
  }

  async writeTemp(file: { name: string; content: string }): Promise<string> {
    const ext = path.extname(file.name)
    const tempName = `${nanoid()}${ext}`
    const tempPath = path.join(this.tempDir, tempName)
    await fs.writeFile(tempPath, file.content, 'utf-8')
    return tempPath
  }
}

function calculateImageTokens(adapter: ImageFileAdapter): number {
  // 方法1：基于图片尺寸
  const pixelBasedTokens = Math.round(
    ((adapter.imageMetadata.compressWidth ?? adapter.imageMetadata.width ?? 1) *
      (adapter.imageMetadata.compressHeight ?? adapter.imageMetadata.height ?? 1)) /
      750
  )
  return pixelBasedTokens
}

import { NativeImage, WebContentsView, nativeImage } from 'electron'
import sharp from 'sharp'

export interface ScrollCaptureOptions {
  hideElements?: string[] // CSS选择器数组，用于隐藏特定元素
  maxSegmentHeight?: number // 最大分段高度比例，默认0.8
  segmentDelay?: number // 每段截图间的延迟，默认300ms
  isDark?: boolean
  version?: string
  texts?: {
    brand?: string
    time?: string
    tip?: string
  }
}

export interface ScrollCaptureRect {
  x: number
  y: number
  width: number
  height: number
}

export interface SegmentInfo {
  x: number
  y: number
  width: number
  height: number
  scrollY: number
  segmentIndex: number
}

export class ScrollCaptureManager {
  private view: WebContentsView
  private originalScrollPosition = { top: 0, left: 0 }
  private hiddenElements: string[] = []

  constructor(view: WebContentsView) {
    this.view = view
  }

  /**
   * 执行滚动截图
   */
  async captureScrollableArea(
    rect: ScrollCaptureRect,
    options: ScrollCaptureOptions = {}
  ): Promise<Buffer[]> {
    if (this.view.webContents.isDestroyed()) {
      throw new Error('WebContents is destroyed')
    }

    try {
      console.log(`Starting scrollable capture for area:`, rect)

      // 获取页面信息
      const pageInfo = await this.getPageInfo()

      // 保存原始滚动位置
      this.originalScrollPosition = {
        top: pageInfo.scrollTop,
        left: pageInfo.scrollLeft
      }

      // 隐藏指定元素
      if (options.hideElements && options.hideElements.length > 0) {
        await this.hideElements(options.hideElements)
      }

      // 计算分段策略
      const maxSegmentHeight = Math.floor(
        pageInfo.viewportHeight * (options.maxSegmentHeight || 0.8)
      )
      const segments = this.calculateSegments(rect, maxSegmentHeight)

      console.log(`Splitting into ${segments.length} segments`)

      // 如果只有一段，直接截图
      if (segments.length === 1) {
        return await this.captureSingleSegment(segments[0], options.segmentDelay || 200)
      }

      // 逐段截图
      const segmentImages: Buffer[] = []
      for (const segment of segments) {
        console.log(
          `Capturing segment ${segment.segmentIndex + 1}/${segments.length} at scroll position ${segment.scrollY}`
        )

        const images = await this.captureSingleSegment(segment, options.segmentDelay || 300)
        segmentImages.push(...images)
      }

      return segmentImages
    } finally {
      // 清理：恢复隐藏的元素和滚动位置
      await this.cleanup()
    }
  }

  /**
   * 获取页面信息
   */
  private async getPageInfo(): Promise<{
    viewportWidth: number
    viewportHeight: number
    scrollTop: number
    scrollLeft: number
    devicePixelRatio: number
  }> {
    return await this.view.webContents.executeJavaScript(`
      (function() {
        return {
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
          scrollTop: document.documentElement.scrollTop || document.body.scrollTop,
          scrollLeft: document.documentElement.scrollLeft || document.body.scrollLeft,
          devicePixelRatio: window.devicePixelRatio || 1
        }
      })()
    `)
  }

  /**
   * 隐藏指定元素
   */
  private async hideElements(selectors: string[]): Promise<void> {
    console.log(`Hiding elements:`, selectors)

    for (const selector of selectors) {
      const elementInfo = await this.view.webContents.executeJavaScript(`
        (function() {
          const elements = document.querySelectorAll('${selector}')
          const hiddenElements = []
          elements.forEach((el, index) => {
            if (el && el.style.display !== 'none' && el.style.visibility !== 'hidden') {
              const id = 'scroll-capture-hidden-' + Date.now() + '-' + index
              el.setAttribute('data-scroll-capture-id', id)
              el.setAttribute('data-scroll-capture-original-display', el.style.display || '')
              el.style.display = 'none'
              hiddenElements.push(id)
            }
          })
          return hiddenElements
        })()
      `)
      this.hiddenElements.push(...elementInfo)
    }
  }

  /**
   * 计算分段信息
   */
  private calculateSegments(rect: ScrollCaptureRect, maxSegmentHeight: number): SegmentInfo[] {
    const segments: SegmentInfo[] = []
    let currentY = rect.y
    let segmentIndex = 0

    console.log(
      `Calculating segments for rect: y=${rect.y}, height=${rect.height}, maxSegmentHeight=${maxSegmentHeight}`
    )

    while (currentY < rect.y + rect.height) {
      const remainingHeight = rect.y + rect.height - currentY
      const segmentHeight = Math.min(maxSegmentHeight, remainingHeight)

      // 确保分段不会超出原始区域
      const actualSegmentHeight = Math.min(segmentHeight, rect.y + rect.height - currentY)

      segments.push({
        x: rect.x,
        y: 0, // 截图时总是相对于视口顶部
        width: rect.width,
        height: actualSegmentHeight,
        scrollY: currentY, // 需要滚动到的绝对位置
        segmentIndex: segmentIndex++
      })

      console.log(`Segment ${segmentIndex}: scrollY=${currentY}, height=${actualSegmentHeight}`)

      currentY += actualSegmentHeight
    }

    console.log(`Total segments calculated: ${segments.length}`)
    return segments
  }

  /**
   * 截取单个分段
   */
  private async captureSingleSegment(segment: SegmentInfo, delay: number): Promise<Buffer[]> {
    // 滚动到目标位置，保持原始的水平滚动位置
    await this.view.webContents.executeJavaScript(`
      window.scrollTo({
        top: ${segment.scrollY},
        left: ${this.originalScrollPosition.left},
        behavior: 'instant'
      })
    `)

    // 等待滚动和渲染完成
    await new Promise((resolve) => setTimeout(resolve, delay))

    // 计算截图区域：滚动后需要重新计算相对于视口的位置
    const captureRect = await this.view.webContents.executeJavaScript(`
      (function() {
        const currentScrollTop = document.documentElement.scrollTop || document.body.scrollTop;
        const targetY = ${segment.scrollY};
        const originalRectY = ${segment.scrollY}; // 这是绝对位置

        // 截图区域相对于当前视口的位置
        const relativeY = Math.max(0, originalRectY - currentScrollTop);

        return {
          x: ${segment.x},
          y: relativeY,
          width: ${segment.width},
          height: ${segment.height}
        };
      })()
    `)

    console.log(`Segment ${segment.segmentIndex + 1} capture rect:`, captureRect)

    // 截取当前段
    const segmentImage = await this.view.webContents.capturePage(captureRect)

    if (!segmentImage.isEmpty()) {
      return [segmentImage.toPNG()]
    } else {
      console.warn(`Segment ${segment.segmentIndex + 1} capture failed`)
      return []
    }
  }

  /**
   * 恢复隐藏的元素
   */
  private async restoreHiddenElements(): Promise<void> {
    if (this.hiddenElements.length === 0) return

    await this.view.webContents.executeJavaScript(`
      (function() {
        const ids = ${JSON.stringify(this.hiddenElements)}
        ids.forEach(id => {
          const element = document.querySelector('[data-scroll-capture-id="' + id + '"]')
          if (element) {
            const originalDisplay = element.getAttribute('data-scroll-capture-original-display') || ''
            element.style.display = originalDisplay
            element.removeAttribute('data-scroll-capture-id')
            element.removeAttribute('data-scroll-capture-original-display')
          }
        })
      })()
    `)

    this.hiddenElements = []
  }

  /**
   * 恢复原始滚动位置
   */
  private async restoreScrollPosition(): Promise<void> {
    await this.view.webContents.executeJavaScript(`
      window.scrollTo({
        top: ${this.originalScrollPosition.top},
        left: ${this.originalScrollPosition.left},
        behavior: 'instant'
      })
    `)
  }

  /**
   * 清理资源
   */
  private async cleanup(): Promise<void> {
    await this.restoreHiddenElements()
    await this.restoreScrollPosition()
  }
}

/**
 * 垂直拼接多个图片Buffer
 */
export async function stitchImagesVertically(imageBuffers: Buffer[]): Promise<NativeImage> {
  if (imageBuffers.length === 0) {
    throw new Error('No images to stitch')
  }

  if (imageBuffers.length === 1) {
    return nativeImage.createFromBuffer(imageBuffers[0])
  }

  console.log(`Starting to stitch ${imageBuffers.length} images using Sharp`)

  // 获取所有图片的元数据
  const imageInfos = await Promise.all(
    imageBuffers.map(async (buffer, index) => {
      try {
        const metadata = await sharp(buffer).metadata()
        console.log(`Image ${index + 1} dimensions: ${metadata.width}x${metadata.height}`)
        return {
          buffer,
          width: metadata.width || 0,
          height: metadata.height || 0,
          index
        }
      } catch (error) {
        console.error(`Failed to get metadata for image ${index + 1}:`, error)
        throw error
      }
    })
  )

  // 计算拼接后的尺寸
  const maxWidth = Math.max(...imageInfos.map((info) => info.width))
  const totalHeight = imageInfos.reduce((sum, info) => sum + info.height, 0)

  console.log(`Stitched image dimensions: ${maxWidth}x${totalHeight}`)

  // 创建空白画布
  const canvas = sharp({
    create: {
      width: maxWidth,
      height: totalHeight,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    }
  })

  // 准备合成操作
  const composite: Array<{
    input: Buffer
    top: number
    left: number
  }> = []
  let currentTop = 0

  for (const imageInfo of imageInfos) {
    // 计算居中位置
    const left = Math.floor((maxWidth - imageInfo.width) / 2)

    composite.push({
      input: imageInfo.buffer,
      top: currentTop,
      left: left
    })

    console.log(`Image ${imageInfo.index + 1} will be placed at position (${left}, ${currentTop})`)
    currentTop += imageInfo.height
  }

  // 执行合成
  const stitchedBuffer = await canvas.composite(composite).png().toBuffer()

  // 创建NativeImage
  const stitchedImage = nativeImage.createFromBuffer(stitchedBuffer)

  console.log(`Successfully stitched ${imageBuffers.length} images using Sharp`)
  return stitchedImage
}

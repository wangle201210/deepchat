# usePageCapture 使用示例

## 基本用法

```typescript
import { usePageCapture } from '@/composables/usePageCapture'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const { isCapturing, captureArea, captureAndCopy } = usePageCapture()

// 获取应用版本
const appVersion = await devicePresenter.getAppVersion()

// 定义截图目标区域
const getTargetRect = () => {
  const element = document.querySelector('.target-element')
  if (!element) return null

  const rect = element.getBoundingClientRect()
  return {
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.round(rect.width),
    height: Math.round(rect.height)
  }
}

// 执行截图并复制到剪贴板
const handleCapture = async () => {
  const success = await captureAndCopy({
    container: '.scroll-container',
    getTargetRect,
    watermark: {
      isDark: true,
      version: appVersion,
      texts: {
        brand: 'DeepChat',
        tip: t('common.watermarkTip')
      }
    }
  })

  if (success) {
    console.log('截图成功')
  } else {
    console.error('截图失败')
  }
}
```

## 使用预设配置

```typescript
import { usePageCapture, createCapturePresets } from '@/composables/usePageCapture'

const { captureAndCopy } = usePageCapture()
const { captureFullConversation, captureMessageRange, captureCustomElement } = createCapturePresets()

// 截取整个会话
const captureConversation = async () => {
  const config = captureFullConversation({
    isDark: true,
    version: appVersion,
    texts: {
      brand: 'DeepChat',
      tip: t('common.watermarkTip')
    }
  })

  await captureAndCopy(config)
}

// 截取指定消息范围
const captureMessages = async (startId: string, endId: string) => {
  const config = captureMessageRange(startId, endId, {
    isDark: true,
    version: appVersion,
    texts: {
      brand: 'DeepChat',
      tip: t('common.watermarkTip')
    }
  })

  await captureAndCopy(config)
}

// 截取自定义元素
const captureCustomArea = async () => {
  const config = captureCustomElement('.chat-sidebar', '.main-container', {
    isDark: true,
    version: appVersion,
    texts: {
      brand: 'DeepChat',
      tip: t('common.watermarkTip')
    }
  })

  await captureAndCopy(config)
}
```

## 高级用法

```typescript
// 自定义配置参数
const advancedCapture = async () => {
  const result = await captureArea({
    container: '.custom-scroll-container',
    getTargetRect: () => {
      // 自定义目标区域计算逻辑
      const elements = document.querySelectorAll('.message-item')
      if (elements.length === 0) return null

      const firstRect = elements[0].getBoundingClientRect()
      const lastRect = elements[elements.length - 1].getBoundingClientRect()

      return {
        x: Math.round(firstRect.x),
        y: Math.round(firstRect.y),
        width: Math.round(firstRect.width),
        height: Math.round(lastRect.bottom - firstRect.top)
      }
    },
    watermark: {
      isDark: false,
      version: '1.0.0',
      texts: {
        brand: 'MyApp',
        tip: '自定义水印提示'
      }
    },
    scrollBehavior: 'smooth', // 平滑滚动
    captureDelay: 500,        // 增加延迟时间
    maxIterations: 50,        // 增加最大迭代次数
    scrollbarOffset: 15,      // 自定义滚动条偏移
    containerHeaderOffset: 60 // 自定义容器头部偏移
  })

  if (result.success && result.imageData) {
    // 处理截图数据
    console.log('截图成功，数据长度:', result.imageData.length)

    // 可以保存到文件或执行其他操作
    // await saveImageToFile(result.imageData)
  } else {
    console.error('截图失败:', result.error)
  }
}
```

## 在组件中使用

```vue
<template>
  <div>
    <button @click="handleCapture" :disabled="isCapturing">
      {{ isCapturing ? '正在截图...' : '截图' }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { usePageCapture } from '@/composables/usePageCapture'

const { isCapturing, captureAndCopy } = usePageCapture()

const handleCapture = async () => {
  await captureAndCopy({
    container: '.message-list',
    getTargetRect: () => {
      const element = document.querySelector('.target-content')
      if (!element) return null

      const rect = element.getBoundingClientRect()
      return {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      }
    }
  })
}
</script>
```

## 配置参数说明

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `container` | `string \| HTMLElement` | - | 滚动容器，CSS选择器或DOM元素 |
| `getTargetRect` | `() => CaptureRect \| null` | - | 获取目标截图区域的函数 |
| `watermark` | `WatermarkConfig` | `undefined` | 水印配置 |
| `scrollBehavior` | `'auto' \| 'smooth'` | `'auto'` | 滚动行为 |
| `captureDelay` | `number` | `350` | 每次截图后的延迟时间（毫秒） |
| `maxIterations` | `number` | `30` | 最大迭代次数 |
| `scrollbarOffset` | `number` | `20` | 滚动条偏移量 |
| `containerHeaderOffset` | `number` | `44` | 容器顶部预留空间 |

## 返回值说明

### CaptureResult

```typescript
interface CaptureResult {
  success: boolean    // 是否成功
  imageData?: string  // base64格式的图片数据
  error?: string      // 错误信息
}
```

### 方法说明

- `captureArea(config)`: 执行截图并返回结果对象
- `captureAndCopy(config)`: 执行截图并直接复制到剪贴板，返回是否成功
- `isCapturing`: 响应式的截图状态，用于显示加载状态

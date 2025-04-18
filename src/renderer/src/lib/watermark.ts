/**
 * 为图片添加水印
 * @param canvas 原始画布
 * @param isDark 是否为暗色主题
 * @param version 版本号
 */
export const addWatermark = (
  canvas: HTMLCanvasElement,
  isDark: boolean,
  version: string,
  t: (key: string) => string
): HTMLCanvasElement => {
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  // 设置水印文字样式
  ctx.font = '24px "Arial", sans-serif'
  ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)'

  // 计算水印位置（底部垂直居中）
  const borderHeight = 80
  const startY = canvas.height - borderHeight

  // 绘制边框背景
  ctx.fillStyle = isDark ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.8)'
  ctx.fillRect(0, startY, canvas.width, borderHeight)

  // 设置信息文字样式
  ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)'

  // 添加信息
  const yPadding = 40
  const lineHeight = 24

  // 计算文本垂直居中的基准Y坐标
  const textBaselineY = startY + borderHeight / 2 + 4
  const upperTextY = textBaselineY - lineHeight / 2 + 4
  const lowerTextY = textBaselineY + lineHeight / 2 + 4

  // 品牌标识 (右对齐)
  ctx.font = 'bold 28px "Arial", sans-serif'
  const brandText = 'DeepChat'
  const brandWidth = ctx.measureText(brandText).width
  ctx.fillText(brandText, canvas.width - brandWidth - yPadding, upperTextY)

  // 版本信息 (右对齐)
  ctx.font = '16px "Arial", sans-serif'
  const versionInfo = 'v' + version
  const versionInfoWidth = ctx.measureText(versionInfo).width
  ctx.fillText(versionInfo, canvas.width - versionInfoWidth - yPadding, lowerTextY)

  // 时间信息 (左对齐)
  const now = new Date()
  const timeStr = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  ctx.fillText(timeStr, yPadding, upperTextY)
  // 绘制分隔线
  ctx.fillStyle = isDark ? 'rgba(200, 200, 200, 0.5)' : 'rgba(50, 50, 50, 0.5)'
  ctx.fillRect(0, startY - 1, canvas.width, 1)
  // 提示文本 (左对齐)
  ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)'
  ctx.fillText(t('common.watermarkTip'), yPadding, lowerTextY)

  return canvas
}

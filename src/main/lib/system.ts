import os from 'os'

// 检查 Windows 版本
export function isWindows10OrLater(): boolean {
  if (process.platform !== 'win32') return false
  const release = os.release().split('.')
  const major = parseInt(release[0])
  return major >= 10
}

// 检查是否为 Windows 11
export function isWindows11OrLater(): boolean {
  if (process.platform !== 'win32') return false
  const release = os.release().split('.')
  const major = parseInt(release[0])
  const build = parseInt(release[2])
  // Windows 11 的内部版本号从 22000 开始
  return major >= 10 && build >= 22000
}

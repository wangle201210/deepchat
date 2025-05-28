export const CommandKey = process.platform === 'darwin' ? 'Command' : 'Control'

const ShiftKey = 'Shift'

// 注册标签页数字快捷键 (1-8) -> 为固定 CommandKey+1 ~ CommandKey+8 切换 Tab
// 如下为常规快捷键定义
export const defaultShotcutKey = {
  NewConversation: `${CommandKey}+N`,
  NewWindow: `${CommandKey}+${ShiftKey}+N`,
  NewTab: `${CommandKey}+T`,
  CloseTab: `${CommandKey}+W`,
  Quit: `${CommandKey}+Q`,
  ZoomIn: `${CommandKey}+=`,
  ZoomOut: `${CommandKey}+-`,
  ZoomResume: `${CommandKey}+0`,
  GoSettings: `${CommandKey},`,
  CleanChatHistory: `${CommandKey}+L`,
  SwitchNextTab: `${CommandKey}+Tab`,
  SwitchPrevTab: `${CommandKey}+${ShiftKey}+Tab`,
  SwtichToLastTab: `${CommandKey}+9`
}

export type ShortcutKey = keyof typeof defaultShotcutKey

export type ShortcutKeySetting = Record<ShortcutKey, string>

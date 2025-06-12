export const CommandKey = 'CommandOrControl'

const ShiftKey = 'Shift'

// 注册标签页数字快捷键 (1-8) -> 为固定 CommandKey+1 ~ CommandKey+8 切换 Tab
// 如下为常规快捷键定义
export const rendererShortcutKey = {
  NewConversation: `${CommandKey}+N`,
  NewWindow: `${CommandKey}+${ShiftKey}+N`,
  NewTab: `${CommandKey}+T`,
  CloseTab: `${CommandKey}+W`,
  ZoomIn: `${CommandKey}+=`,
  ZoomOut: `${CommandKey}+-`,
  ZoomResume: `${CommandKey}+0`,
  GoSettings: `${CommandKey}+,`,
  CleanChatHistory: `${CommandKey}+L`,
  DeleteConversation: `${CommandKey}+D`,
  SwitchNextTab: `${CommandKey}+Tab`,
  SwitchPrevTab: `${CommandKey}+${ShiftKey}+Tab`,
  SwtichToLastTab: `${CommandKey}+9`
}

// 系统层面 快捷键
export const systemShortcutKey = {
  ShowHideWindow: `${CommandKey}+O`,
  Quit: `${CommandKey}+Q`
}

export const defaultShortcutKey = {
  ...rendererShortcutKey,
  ...systemShortcutKey
}

export type ShortcutKey = keyof typeof defaultShortcutKey

export type ShortcutKeySetting = Record<ShortcutKey, string>

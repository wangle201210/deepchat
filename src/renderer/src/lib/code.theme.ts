import { createTheme } from 'vue-renderer-markdown'
import { tags as t } from '@lezer/highlight'

export const darkStyle = {
  theme: 'dark',
  settings: {
    background: 'rgba(0, 0, 0, 0)',
    foreground: '#D6D6DD',
    caret: '#D6D6DD',
    selection: '#163761',
    selectionMatch: '#163761',
    lineHighlight: 'rgba(50, 50, 100, 0.05)',
    gutterBackground: 'rgba(0, 0, 0, 0.3)',
    gutterForeground: 'rgba(255, 255, 255, 0.3)'
  },
  styles: [
    { tag: [t.comment, t.lineComment, t.blockComment], color: '#6D6D6D', fontStyle: 'italic' },
    { tag: t.docComment, color: '#6D6D6D', fontStyle: 'italic', fontWeight: 'bold' },
    { tag: t.variableName, color: '#D1D1D1' },
    { tag: [t.propertyName, t.labelName], color: '#AA9BF5' },
    { tag: [t.string, t.character, t.docString], color: '#E394DC' },
    { tag: [t.number, t.integer, t.float], color: '#EBC88D' },
    { tag: [t.bool, t.null, t.atom], color: '#82D2CE' },
    { tag: [t.keyword, t.modifier, t.operatorKeyword], color: '#82D2CE' },
    { tag: [t.controlKeyword, t.controlOperator], color: '#83D6C5' },
    { tag: t.definitionKeyword, color: '#83D6C5', fontWeight: 'bold' },
    { tag: t.moduleKeyword, color: '#83D6C5', fontStyle: 'italic' },
    { tag: t.self, color: '#83D6C5', fontStyle: 'italic' },
    {
      tag: [
        t.operator,
        t.arithmeticOperator,
        t.logicOperator,
        t.bitwiseOperator,
        t.compareOperator,
        t.updateOperator
      ],
      color: '#D6D6DD'
    },
    { tag: t.definitionOperator, color: '#83D6C5' },
    { tag: [t.className, t.definition(t.typeName), t.typeName], color: '#87C3FF' },
    { tag: t.namespace, color: '#87C3FF' },
    { tag: t.typeOperator, color: '#EFB080' },
    { tag: t.tagName, color: '#87C3FF', fontWeight: 'bold' },
    { tag: t.angleBracket, color: '#898989' },
    { tag: t.attributeName, color: '#AAA0FA' },
    { tag: t.attributeValue, color: '#E394DC' },
    { tag: t.function(t.variableName), color: '#EFB080' },
    { tag: t.macroName, color: '#A8CC7C' },
    { tag: [t.bracket, t.paren, t.brace], color: '#E394DC' },
    { tag: t.punctuation, color: '#D6D6DD' },
    { tag: t.invalid, color: '#ff0000', fontStyle: 'italic' },
    { tag: [t.meta, t.documentMeta, t.annotation], color: '#6D6D6D' },
    { tag: t.url, color: '#83D6C5', textDecoration: 'underline' },
    { tag: t.color, color: '#EBC88D' }
  ]
}
export const lightStyle = {
  theme: 'light',
  settings: {
    background: 'rgba(255,255,255,0)',
    foreground: '#4b5563',
    caret: '#4b5563',
    selection: '#e5e7eb',
    selectionMatch: '#e5e7eb',
    lineHighlight: 'rgba(156, 163, 175, 0.08)',
    gutterBackground: 'rgba(255,255,255,0)',
    gutterForeground: '#9ca3af',
    gutterBorder: '#e5e7eb'
  },
  styles: [
    { tag: [t.comment, t.lineComment, t.blockComment], color: '#9ca3af', fontStyle: 'italic' },
    { tag: t.docComment, color: '#9ca3af', fontStyle: 'italic', fontWeight: 'bold' },
    { tag: t.variableName, color: '#4b5563' },
    { tag: [t.propertyName, t.labelName], color: '#7c2d92' },
    { tag: [t.string, t.character, t.docString], color: '#be185d' },
    { tag: [t.number, t.integer, t.float], color: '#d97706' },
    { tag: [t.bool, t.null, t.atom], color: '#0891b2' },
    { tag: [t.keyword, t.modifier, t.operatorKeyword], color: '#0891b2' },
    { tag: [t.controlKeyword, t.controlOperator], color: '#0e7490' },
    { tag: t.definitionKeyword, color: '#0e7490', fontWeight: 'bold' },
    { tag: t.moduleKeyword, color: '#0e7490', fontStyle: 'italic' },
    { tag: t.self, color: '#0e7490', fontStyle: 'italic' },
    {
      tag: [
        t.operator,
        t.arithmeticOperator,
        t.logicOperator,
        t.bitwiseOperator,
        t.compareOperator,
        t.updateOperator
      ],
      color: '#4b5563'
    },
    { tag: t.definitionOperator, color: '#0e7490' },
    { tag: [t.className, t.definition(t.typeName), t.typeName], color: '#2563eb' },
    { tag: t.namespace, color: '#2563eb' },
    { tag: t.typeOperator, color: '#ea580c' },
    { tag: t.tagName, color: '#2563eb', fontWeight: 'bold' },
    { tag: t.angleBracket, color: '#6b7280' },
    { tag: t.attributeName, color: '#7c3aed' },
    { tag: t.attributeValue, color: '#be185d' },
    { tag: t.function(t.variableName), color: '#ea580c' },
    { tag: t.macroName, color: '#16a34a' },
    { tag: [t.bracket, t.paren, t.brace], color: '#be185d' },
    { tag: t.punctuation, color: '#4b5563' },
    { tag: t.invalid, color: '#dc2626', fontStyle: 'italic' },
    { tag: [t.meta, t.documentMeta, t.annotation], color: '#9ca3af' },
    { tag: t.url, color: '#0e7490', textDecoration: 'underline' },
    { tag: t.color, color: '#d97706' }
  ]
}

export const anysphereThemeDark = createTheme(darkStyle as typeof createTheme.arguments)
export const anysphereThemeLight = createTheme(lightStyle as typeof createTheme.arguments)
// For backward compatibility
export const anysphereTheme = anysphereThemeDark

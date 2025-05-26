import { defineConfig } from 'eslint/config'
import vue from 'eslint-plugin-vue'
import typescript from '@typescript-eslint/eslint-plugin'
import typescriptParser from '@typescript-eslint/parser'
import prettier from 'eslint-config-prettier'

export default defineConfig([
  {
    files: ['**/*.{js,ts,vue}'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module'
      }
    },
    plugins: {
      vue,
      '@typescript-eslint': typescript
    },
    rules: {
      'vue/require-default-prop': 'off',
      'vue/multi-word-component-names': 'off'
    }
  },
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vue.parser,
      parserOptions: {
        parser: typescriptParser,
        ecmaVersion: 'latest',
        sourceType: 'module'
      }
    }
  },
  {
    ignores: [
      'node_modules',
      'dist',
      'out',
      '.gitignore',
      '.github',
      '.cursor',
      '.vscode',
      'build',
      'resources',
      'runtime',
      'scripts',
      'src/renderer/src/components/ui' // shadcn
    ]
  },
  prettier
])

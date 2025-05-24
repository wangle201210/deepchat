/**
 * @module detectLanguage
 * (Language detector)
 */
export type CodeLanguage =
  | 'bash'
  | 'dos'
  | 'go'
  | 'powershell'
  | 'plain'
  | 'http'
  | 'html'
  | 'js'
  | 'ts'
  | 'py'
  | 'sql'
  | 'pl'
  | 'lua'
  | 'make'
  | 'uri'
  | 'css'
  | 'diff'
  | 'md'
  | 'docker'
  | 'xml'
  | 'c'
  | 'rs'
  | 'java'
  | 'asm'
  | 'json'
  | 'yaml'
  | 'toml'
  | 'mermaid'

type LanguageFeature = [RegExp, number]
type LanguageDefinition = [CodeLanguage, ...LanguageFeature[]]

const SHEBANG_MAP: Array<[RegExp, CodeLanguage]> = [
  [/\b(bash|sh)\b/gi, 'bash'],
  [/\b(node|nodejs|iojs)\b/gi, 'js'],
  [/\b(python|python3|py)\b/gi, 'py'],
  [/\b(powershell|pwsh|posh)\b/gi, 'powershell']
]

const languages: LanguageDefinition[] = [
  [
    'bash',
    [/^#!.*\b(bash|sh)\b/gi, 500],
    [
      /(^|\s)(if|elif|then|fi|for|while|do|done|function|source|exit|read|cat|grep|sed|awk|cut|tr|wc|ps|kill|sleep|mkdir|rm|cp|mv|ls|pwd|chmod|chown|tar|zip|unzip|which|find|expr|test|[[|]]|&&|\|\||\$[0-9])\b/gi,
      5
    ]
  ],
  [
    'dos',
    [/^@echo off/gi, 500],
    [/^\s*rem\b/gi, 500],
    [
      /^\s*(goto|call|start|setlocal|endlocal|ping|net|copy|del|move|dir|md|rd|ren|type|findstr|choice|timeout|cls|title|color|path|assoc|ftype|start|reg|tasklist|taskkill|wmic|powershell|cmd|echo)\b/gi,
      10
    ]
  ],
  [
    'go',
    [/\bpackage\s+main\b/gi, 500],
    [/\bimport\s+$$.*$$/gi, 400],
    [/\bfunc\s+\w+\s*$$/gi, 300],
    [/\bfmt\.(Print(ln)?|Sprint)/gi, 200],
    [/\btype\s+\w+\s+struct\s*{/gi, 100]
  ],
  [
    'powershell',
    [/^#requires -version/gi, 500],
    [/^param\s*$$/gi, 400],
    [/^(function|filter|class)\s+/gi, 300],
    [/^Write-(Host|Output|Warning|Error)/gi, 200],
    [/^\$(args|PSVersionTable|MyInvocation|PSScriptRoot)/gi, 150],
    [/^\s*(if|foreach|for|while|switch|try|catch|finally|return|continue|break)\b/gi, 50]
  ],
  [
    'http',
    // 降低高分特征值，防止压制 uri
    [/^(GET|HEAD|POST|PUT|DELETE|PATCH|CONNECT|OPTIONS|TRACE)\s+\S+\s+HTTP\/\d\.\d$/gim, 600],
    [/^Host:\s+\S+/gim, 50],
    [/^User-Agent:/gim, 20],
    [/^(GET|POST|PUT|DELETE)\s+\//gi, 40]
  ],
  ['html', [/<\/?[a-z-]+[^\n>]*>/g, 10], [/^\s+<!DOCTYPE\s+html/gi, 500]],
  [
    'js',
    [
      /\b(console|await|async|function|export|import|this|class|for|let|const|map|join|require)\b/gi,
      10
    ]
  ],
  [
    'ts',
    [
      /\b(console|await|async|function|export|import|this|class|for|let|const|map|join|require|implements|interface|namespace)\b/gi,
      10
    ]
  ],
  ['sql', [/\b(SELECT|INSERT|FROM)\b/gi, 50]],
  ['pl', [/#!(\/usr)?\/bin\/perl/gi, 500], [/\b(use|print)\b|\$/gi, 10]],
  ['lua', [/#!(\/usr)?\/bin\/lua/gi, 500]],
  ['make', [/\b(ifneq|endif|if|elif|then|fi|echo|.PHONY|^[a-z]+ ?:$)\b|\$/gm, 10]],
  [
    'uri',
    // 提升基础正则得分
    [/[a-zA-Z][a-zA-Z0-9+.-]*:\/\/[^\s'"<>]+/gi, 200],
    [/\bdata:(?:[a-zA-Z0-9+.-]+\/[a-zA-Z0-9+.-]+)?;base64,[a-zA-Z0-9+/=]+\b/gi, 150],
    [/\b(urn:[a-zA-Z0-9][a-zA-Z0-9\-+:.]*)\b/gi, 100],
    [/\bfile:\/\/(?:localhost|[^?\s'"<>]+)/gi, 120],
    [/\bmailto:[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/gi, 120],
    [/(https?:\/\/|www\.)[^\s'"<>]+/gi, 180], // 支持无 scheme 的 www 网址
    [/\b(https?|ftps?|wss?|file|telnet|ldap|xmpp|irc|nntp|news|gopher)\b:/gi, 50]
  ],
  ['css', [/^(@import|@page|@media|(\.|#)[a-z]+)/gim, 20]],
  [
    'diff',
    [/^[+]\s[^\n]/gm, 50],
    [/^[-]\s[^\n]/gm, 50],
    [/^[<]\s[^\n]/gm, 40],
    [/^[>]\s[^\n]/gm, 40],
    [/^@@\s+[-+,0-9\s]+@@/gm, 100],
    [/^---\s+a\//gm, 80],
    [/^\+\+\+\s+b\//gm, 80],
    [/^index\s+[a-f0-9]+\.\.[a-f0-9]+\s+/gm, 60]
  ],
  ['md', [/^(>|\t\*|\t\d+.|#{1,6} |-\s+|\*\s+)/gim, 25], [/\[.*\](.*)/gi, 10]],
  ['docker', [/^(FROM|ENTRYPOINT|RUN)/gim, 500]],
  ['xml', [/<\/?[a-z-]+[^\n>]*>/g, 10], [/^<\?xml/gi, 500]],
  ['c', [/#include\b|\bprintf\s+\(/gi, 100]],
  ['rs', [/^\s+(use|fn|mut|match)\b/gim, 100]],
  ['java', [/^import\s+java/gi, 500]],
  ['asm', [/^(section|global main|extern|\t(call|mov|ret))/gim, 100]],
  ['json', [/\b(true|false|null|\{})\b|"[^"]+":/gi, 10]],
  ['yaml', [/^(\s+)?[a-z][a-z0-9]*:/gim, 10]],
  ['toml', [/^\s*\[.*\]\s*$/gim, 100], [/^\s*[a-zA-Z0-9_-]+ *= */gi, 20]],
  [
    'mermaid',
    [
      /(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|mindmap)/gi,
      500
    ]
  ]
]

/**
 * Detect the language of a given code snippet.
 *
 * @param code The code to analyze
 * @returns {CodeLanguage} The detected language
 */
export const detectLanguage = (code: string): CodeLanguage => {
  const firstLine = code.trimStart().split('\n')[0]

  // Step 0: Early return for shebang lines
  if (firstLine.startsWith('#!')) {
    for (const [re, lang] of SHEBANG_MAP) {
      if (re.test(firstLine)) {
        return lang
      }
    }
  }

  // Step 0.5: Early return for URI patterns
  const trimmed = code.trim()
  if (
    /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/[^\s'"<>]+/m.test(trimmed) ||
    /^mailto:[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/m.test(trimmed) ||
    /^data:(?:[a-zA-Z0-9+.-]+\/[a-zA-Z0-9+.-]+)?;base64,[a-zA-Z0-9+/=]+/m.test(trimmed) ||
    /^urn:[a-zA-Z0-9][a-zA-Z0-9\-+:.]*$/m.test(trimmed) ||
    /(https?:\/\/|www\.)[^\s'"<>]+/m.test(trimmed)
  ) {
    return 'uri'
  }

  // Step 1: Exclude certain languages based on content
  if (/^@echo off/gi.test(code) || /^\s*rem\b/gi.test(code)) {
    return 'dos'
  }
  if (/^#requires -version/gi.test(code)) {
    return 'powershell'
  }
  if (/^param\s*$$/gi.test(code)) {
    return 'powershell'
  }

  // Step 2: Score-based detection
  const scored: [CodeLanguage, number][] = []
  for (const [lang, ...features] of languages) {
    let score = 0
    for (const [re, val] of features) {
      score += [...code.matchAll(re)].length * val
    }
    if (score > 0) {
      scored.push([lang, score])
    }
  }

  // Step 3: Apply minimum threshold based on code length
  const minScore = code.length < 20 ? 10 : 50
  const candidates = scored.filter(([, score]) => score > minScore)

  // Step 4: Special handling for http vs uri
  const httpScore = scored.find(([lang]) => lang === 'http')?.[1] ?? 0
  const uriScore = scored.find(([lang]) => lang === 'uri')?.[1] ?? 0

  if (httpScore > 0 && httpScore >= uriScore * 0.8) {
    return 'http'
  }

  if (candidates.length === 0) return 'plain'
  return candidates.sort((a, b) => b[1] - a[1])[0]?.[0] || 'plain'
}

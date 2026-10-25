/**
 * 星芒 · 提示词一键优化（dsh-prompt-starlight）
 * Copyright (c) 2026 Starlit Sky · SPDX-License-Identifier: AGPL-3.0-only
 * https://github.com/Starlit-Sky-code/dsh-prompt-starlight
 *
 * 把「真实组件」渲染成截图，供 README 与评审使用。
 *
 * 流程：jsdom 里挂载真实 React 组件 → 抽出真实 CSS 与 outerHTML →
 * 拼成独立页面（图标内联为 data URI，避免 file:// 相对路径问题）→
 * 用本机 Edge/Chrome 的 headless 模式截图 → 写出 PNG。
 *
 * 因此截图不会和实际界面脱节；改了组件重跑一次即可。
 *
 * 跑法：node tools/make-shots.mjs
 * 依赖：tools/fixture 里的 react / react-dom / jsdom（npm run preview 同款）
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const work = path.join(root, '.tmp', 'shots')
const outDir = path.join(root, 'docs', 'screenshots')
const fixtureRequire = createRequire(path.join(here, 'fixture', 'package.json'))

const ROUTE = '/dsh-starlight'

/** 主题变量（与 DSH 的 design token 同名，真实宿主里由 DSH 提供）。 */
const TOKENS = `
  :root{--dsw-alias-bg-base:#fff;--dsw-alias-bg-layer-1:#f6f7f9;--dsw-alias-bg-layer-2:#fff;--dsw-alias-border-l1:rgba(20,24,30,.06);--dsw-alias-border-l2:rgba(20,24,30,.10);--dsw-alias-border-l3:rgba(20,24,30,.18);--dsw-alias-label-primary:#14181e;--dsw-alias-label-secondary:#5f6570;--dsw-alias-label-tertiary:#8a8f98;--dsw-alias-label-caption:#9aa0a6;--dsw-alias-label-dimmed:#b3b7bd;--dsw-alias-label-primary-foreground:#fff;--dsw-alias-interactive-bg-hover:rgba(20,24,30,.06);--dsw-alias-state-business-primary:#4d6bfe;--dsw-alias-state-success-primary:#2f9e44;--dsw-alias-state-warn-primary:#d17a00;--dsw-alias-state-error-primary:#e5484d;--dsw-alias-menu-surface-fill:#fff;--dsw-alias-button-primary-fill:#4d6bfe;--dsw-alias-link:#4d6bfe;--dsw-elevation-panel:0 12px 40px rgba(0,0,0,.22);--dsw-elevation-prominent:0 8px 24px rgba(0,0,0,.28);--dsw-radius-panel:14px;--dsw-alias-toast-bg:rgba(28,30,34,.94);--dsw-alias-toast-label:#fff;--dsw-font-markdown-code-font-family:ui-monospace,SFMono-Regular,Consolas,monospace}
  html[data-theme=dark]{--dsw-alias-bg-base:#14161a;--dsw-alias-bg-layer-1:#191c21;--dsw-alias-bg-layer-2:#20242b;--dsw-alias-border-l1:rgba(255,255,255,.06);--dsw-alias-border-l2:rgba(255,255,255,.10);--dsw-alias-border-l3:rgba(255,255,255,.20);--dsw-alias-label-primary:#e8eaee;--dsw-alias-label-secondary:#a8aeb8;--dsw-alias-label-tertiary:#8a8f98;--dsw-alias-label-caption:#767c86;--dsw-alias-label-dimmed:#5b616b;--dsw-alias-label-primary-foreground:#fff;--dsw-alias-interactive-bg-hover:rgba(255,255,255,.08);--dsw-alias-state-business-primary:#7f95ff;--dsw-alias-state-success-primary:#57c76b;--dsw-alias-state-warn-primary:#e2a03f;--dsw-alias-state-error-primary:#ff6b6f;--dsw-alias-menu-surface-fill:#2a2f38;--dsw-alias-button-primary-fill:#7f95ff;--dsw-alias-link:#8aa4ff}
  *{box-sizing:border-box}
  body{margin:0;font:13px/1.5 -apple-system,"Segoe UI",system-ui,"Microsoft YaHei",sans-serif;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);-webkit-font-smoothing:antialiased}
  .shot{padding:20px}
  .shot-pop{width:${360 + 40}px}
  .shot-page{width:${612 + 40}px}
  .frame-page{padding:0 24px 24px;background:var(--dsw-alias-bg-layer-2);border-radius:14px}
`

const MANIFEST = {
  ok: true,
  version: '0.4.0',
  configFile: 'C:\\Users\\you\\.dsh\\starlight-prompt.json',
  llmAvailable: true,
  rules: [
    { id: 'goal', group: 'base', title: { zh: '明确目标', en: 'State the goal' }, note: { zh: '开头一句话说清结果', en: 'One line' } },
    { id: 'requirements', group: 'base', title: { zh: '拆出具体要求', en: 'Extract asks' }, note: { zh: '把散落的要求逐条列出', en: 'List the asks' } },
    { id: 'output', group: 'base', title: { zh: '规定输出形式', en: 'Specify output' }, note: { zh: '长度、结构、格式、语言', en: 'Length, format' } },
    { id: 'structure', group: 'base', title: { zh: '结构化排版', en: 'Structure' }, note: { zh: '标题与列表替代流水句', en: 'Headings' } },
    { id: 'concise', group: 'quality', title: { zh: '去冗余', en: 'Cut redundancy' }, note: { zh: '删口语与自明内容', en: 'Drop filler' } },
    { id: 'precise', group: 'quality', title: { zh: '消除歧义', en: 'Remove ambiguity' }, note: { zh: '模糊词换成可判断标准', en: 'Checkable' } },
    { id: 'acceptance', group: 'quality', title: { zh: '验收标准', en: 'Acceptance' }, note: { zh: '怎样算做完、算好', en: 'Definition of done' } },
    { id: 'preserve', group: 'guard', title: { zh: '保真：不改需求', en: 'Fidelity' }, note: { zh: '不加、不删、不替你决定', en: 'Keep the asks' } },
    { id: 'verbatim', group: 'guard', title: { zh: '原样保留技术标识', en: 'Verbatim ids' }, note: { zh: '路径、命令、代码、占位符', en: 'Paths, code' } },
    { id: 'noinvent', group: 'guard', title: { zh: '不编造事实', en: 'Invent nothing' }, note: { zh: '缺信息写「待补充」', en: 'No made-up data' } },
    { id: 'assumptions', group: 'guard', title: { zh: '声明假设', en: 'Assumptions' }, note: { zh: '隐含前提显式化', en: 'Surface premises' } },
  ],
  ruleGroups: [
    { id: 'base', label: { zh: '基础结构', en: 'Structure the ask' }, note: { zh: '骨架', en: 'Skeleton' } },
    { id: 'quality', label: { zh: '表达质量', en: 'Expression quality' }, note: { zh: '清楚', en: 'Clarity' } },
    { id: 'guard', label: { zh: '保真护栏', en: 'Fidelity guards' }, note: { zh: '不跑偏', en: 'Honest' } },
  ],
  verbosities: [
    { id: 'concise', label: { zh: '精简', en: 'Concise' }, note: { zh: '最短篇幅，去掉可推断内容', en: 'Shortest form' } },
    { id: 'standard', label: { zh: '标准', en: 'Standard' }, note: { zh: '目标、要求、输出、约束', en: 'Goal, requirements, output' } },
    { id: 'detailed', label: { zh: '详尽', en: 'Detailed' }, note: { zh: '补充边界与验证方式', en: 'Add edge cases' } },
  ],
  lenses: [
    { id: 'auto', label: { zh: '通用', en: 'General' }, note: { zh: '由模型判断形态', en: 'Model picks' } },
    { id: 'engineering', label: { zh: '工程', en: 'Engineering' }, note: { zh: '面向代码任务', en: 'Code tasks' } },
    { id: 'writing', label: { zh: '写作', en: 'Writing' }, note: { zh: '面向文案创作', en: 'Prose' } },
    { id: 'analysis', label: { zh: '分析', en: 'Analysis' }, note: { zh: '面向研究评估', en: 'Research' } },
  ],
  locales: [
    { id: 'auto', label: { zh: '跟随原文', en: 'Follow' }, note: { zh: '', en: '' } },
    { id: 'zh', label: { zh: '中文', en: 'Chinese' }, note: { zh: '', en: '' } },
    { id: 'en', label: { zh: 'English', en: 'English' }, note: { zh: '', en: '' } },
  ],
  depths: [
    { id: 'minimal', label: { zh: '最小', en: 'Minimal' }, note: { zh: '只修病句与明显错误，措辞尽量不动', en: 'Fix only errors' } },
    { id: 'light', label: { zh: '轻改', en: 'Light' }, note: { zh: '顺语句、调顺序、补结构', en: 'Tidy up' } },
    { id: 'balanced', label: { zh: '均衡', en: 'Balanced' }, note: { zh: '改写为清晰完整，篇幅与原稿相当', en: 'Same length' } },
    { id: 'strong', label: { zh: '重写', en: 'Strong' }, note: { zh: '按最佳实践大幅重写', en: 'Substantial' } },
    { id: 'rewrite', label: { zh: '重构', en: 'Rebuild' }, note: { zh: '只留意图与事实，推倒重写', en: 'Build anew' } },
  ],
  config: {
    enabled: true,
    verbosity: 'standard',
    lens: 'auto',
    locale: 'auto',
    depth: 'balanced',
    disabledRules: ['assumptions'],
    customRules: ['输出必须包含「验收标准」小节'],
    provider: '',
    model: '',
    maxTokens: 1600,
    temperature: 0.3,
    timeoutMs: 60000,
  },
}

const MODELS = {
  ok: true,
  models: [
    { provider: 'deepseek-account', model: 'deepseek-flash', name: 'DeepSeek V4.1 Flash' },
    { provider: 'deepseek-account', model: 'deepseek-pro', name: 'DeepSeek V4.1 Pro' },
    { provider: 'openrouter', model: 'anthropic/claude', name: 'Claude (via OpenRouter)' },
  ],
  default: { provider: 'deepseek-account', model: 'deepseek-flash', source: 'default' },
  errors: [],
}

/** 找本机可用的 Chromium 系浏览器。 */
function findBrowser() {
  const candidates = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ]
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate
  }
  return null
}

async function renderReal(locale) {
  const { JSDOM } = fixtureRequire('jsdom')
  const React = fixtureRequire('react')
  const ReactDOMClient = fixtureRequire('react-dom/client')
  const ReactDOM = fixtureRequire('react-dom')
  const { act } = fixtureRequire('react-dom/test-utils')

  // 语言在模块加载时读取 navigator.language，所以每次用不同 query 重新导入一份模块实例
  const dom = new JSDOM('<!doctype html><html><head></head><body><div id="stage"></div></body></html>', {
    url: 'http://127.0.0.1:19387/',
    pretendToBeVisual: true,
  })
  for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'KeyboardEvent', 'getComputedStyle']) {
    Object.defineProperty(globalThis, key, { value: key === 'window' ? dom.window : dom.window[key], configurable: true, writable: true })
  }
  Object.defineProperty(globalThis, 'requestAnimationFrame', { value: (cb) => setTimeout(() => cb(Date.now()), 0), configurable: true, writable: true })
  globalThis.IS_REACT_ACT_ENVIRONMENT = true

  // 必须放在上面那轮 globals 赋值之后：那轮会把 navigator 换成 jsdom 的，
  // 而 detectLocale() 读的正是 navigator.language。
  Object.defineProperty(globalThis, 'navigator', {
    value: { language: locale === 'zh' ? 'zh-CN' : 'en-US' },
    configurable: true,
    writable: true,
  })

  globalThis.fetch = async (url) => ({
    ok: true,
    json: async () => (String(url).includes('/models') ? MODELS : MANIFEST),
  })

  const loaded = []
  dom.window.__ModuleLoader__ = { load: (entry) => loaded.push(entry) }
  await import(pathToFileURL(path.join(root, 'lib', 'client.js')).href + '?lang=' + locale)
  const exportsOf = loaded[0].factory((id) => {
    if (id === 'react') return React
    if (id === 'react-dom') return ReactDOM
    throw new Error(`unexpected require: ${id}`)
  })

  // apply() 负责注入样式表（injectStyle）并注册槽位；不跑它的话组件没有 CSS。
  exportsOf.apply({
    get: () => undefined,
    slots: { inject: (name, callback) => callback(), register: () => () => {} },
  })

  const makeShell = (draft) => ({
    state: { getSnapshot: () => ({ draft, phase: 'idle' }), subscribe: () => () => {} },
    setDraft() {},
    focus() {},
  })

  // —— 浮层 ——
  const stage = dom.window.document.getElementById('stage')
  const rootObj = ReactDOMClient.createRoot(stage)
  await act(async () => {
    rootObj.render(
      React.createElement(exportsOf.StarlightButton, {
        star: { shell: makeShell('帮我写个二分查找'), route: { provider: 'deepseek-account', model: 'deepseek-flash' } },
      }),
    )
  })
  await act(async () => {
    stage.querySelector('[data-dsh-starlight="button"]').dispatchEvent(new dom.window.MouseEvent('contextmenu', { bubbles: true, cancelable: true }))
  })
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20))
  })
  let popHtml = ''
  let popHtmlOpen = ''
  const panel = dom.window.document.querySelector('.dshsl-panel')
  if (panel !== null) {
    panel.removeAttribute('style')
    panel.style.position = 'relative'
    panel.style.maxHeight = 'none'
    popHtml = panel.outerHTML
    // 再点开模型列表，拍一张「展开态」
    const row = panel.querySelector('.dshsl-picker-row')
    if (row !== null) {
      await act(async () => {
        row.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
      })
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 220))
      })
      popHtmlOpen = panel.outerHTML
    }
  }
  await act(async () => {
    rootObj.unmount()
  })

  // —— 设置页（并展开「高级」以便看到数字滑块）——
  const stage2 = dom.window.document.createElement('div')
  dom.window.document.body.appendChild(stage2)
  const root2 = ReactDOMClient.createRoot(stage2)
  await act(async () => {
    root2.render(React.createElement(exportsOf.StarlightSettingsSection, {}))
  })
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20))
  })
  const mores = stage2.querySelectorAll('.dshsl-more-head')
  // 只展开「高级」：截图要证明的正是「默认很干净、高级项默认收起」
  const advancedHead = mores[2]
  if (advancedHead) {
    await act(async () => {
      advancedHead.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
    })
  }
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20))
  })
  const pageHtml = stage2.innerHTML
  await act(async () => {
    root2.unmount()
  })

  const styleTag = dom.window.document.head.querySelector('style[data-plugin-css]')
  const css = styleTag === null ? '' : styleTag.textContent
  dom.window.close()
  return { css, popHtml, popHtmlOpen, pageHtml }
}

/** 把图标换成 data URI，file:// 页面才不会破图。 */
function inlineIcon(html) {
  const iconPath = path.join(root, 'assets', 'icon-ui.png')
  if (!fs.existsSync(iconPath)) return html
  const dataUri = `data:image/png;base64,${fs.readFileSync(iconPath).toString('base64')}`
  return html.split(`src="${ROUTE}/icon.png"`).join(`src="${dataUri}"`)
}

function shot(browser, htmlPath, pngPath, width, height) {
  execFileSync(
    browser,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--hide-scrollbars',
      '--force-device-scale-factor=2',
      `--user-data-dir=${path.join(work, 'profile')}`,
      `--window-size=${width},${height}`,
      `--screenshot=${pngPath}`,
      pathToFileURL(htmlPath).href,
    ],
    { stdio: 'ignore' },
  )
}

const browser = findBrowser()
if (browser === null) {
  console.error('找不到 Edge / Chrome，无法截图')
  process.exit(1)
}

fs.mkdirSync(work, { recursive: true })
fs.mkdirSync(outDir, { recursive: true })

const mkPage = (body, width, css, lang) => `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8" />
<style>${TOKENS}</style>
<style data-preview="real-css">${css}</style>
<!-- 截图要拍「最终态」：静态页会重新播放入场动画，必须关掉 -->
<style>.dshsl-panel,.dshsl-picker-list,.dshsl-toast,.dshsl-skel-bar,.dshsl-star{animation:none !important;opacity:1 !important;transform:none !important}</style>
</head><body><div class="shot" style="width:${width}px">${inlineIcon(body)}</div></body></html>`

const written = []

for (const locale of ['zh', 'en']) {
  const rendered = await renderReal(locale)
  if (rendered.popHtml === '' || rendered.pageHtml === '') {
    console.error(`[${locale}] 渲染真实组件失败`)
    process.exit(1)
  }

  const suffix = locale === 'zh' ? '.zh' : ''
  const popPage = path.join(work, `popover${suffix}.html`)
  fs.writeFileSync(popPage, mkPage(rendered.popHtml, 400, rendered.css, locale === 'zh' ? 'zh-CN' : 'en'), 'utf8')
  const popPng = path.join(outDir, `popover${suffix}.png`)
  shot(browser, popPage, popPng, 440, 620)
  written.push(popPng)

  if (rendered.popHtmlOpen !== '') {
    const openPage = path.join(work, `popover-open${suffix}.html`)
    fs.writeFileSync(openPage, mkPage(rendered.popHtmlOpen, 400, rendered.css, locale === 'zh' ? 'zh-CN' : 'en'), 'utf8')
    const openPng = path.join(outDir, `popover-open${suffix}.png`)
    shot(browser, openPage, openPng, 440, 700)
    written.push(openPng)
  }

  const pagePage = path.join(work, `settings${suffix}.html`)
  fs.writeFileSync(
    pagePage,
    mkPage(`<div class="frame-page">${rendered.pageHtml}</div>`, 660, rendered.css, locale === 'zh' ? 'zh-CN' : 'en'),
    'utf8',
  )
  const pagePng = path.join(outDir, `settings${suffix}.png`)
  shot(browser, pagePage, pagePng, 700, 1240)
  written.push(pagePng)

  console.log(`  [${locale}] 浮层 ${rendered.popHtml.length} 字符 / 设置页 ${rendered.pageHtml.length} 字符`)
}

for (const file of written) {
  console.log(`  ${path.basename(file).padEnd(16)} ${(fs.statSync(file).size / 1024).toFixed(0)} KB`)
}
console.log('已生成 docs/screenshots/（zh 与 en 各一套）')

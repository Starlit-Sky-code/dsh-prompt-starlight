/*!
 * 星芒 · 提示词一键优化（dsh-prompt-starlight）
 * Copyright (c) 2026 Starlit Sky · SPDX-License-Identifier: AGPL-3.0-only
 * https://github.com/Starlit-Sky-code/dsh-prompt-starlight
 *
 * 这是 dsh-prompt-starlight 的一部分。保留本署名是使用条件：
 * 分发、修改或作为网络服务提供时必须附上完整对应源码（AGPL-3.0 第 4、5、13 条）。
 * 商业授权请联系作者。
 */
/**
 * 生成 tools/preview.html：把**真实组件**渲染成静态页，供重启 DSH 前肉眼验收。
 *
 * 做法：用 jsdom + 真实 React 加载 lib/client.js，挂载
 *   - StarlightButton（工具行位置 + 五种状态）
 *   - StarPanel（右键浮层，真实排版）
 *   - StarlightSettingsSection（独立设置页，真实排版）
 * 然后把 document 里真实的 style 与 outerHTML 抽出来拼成一页。
 *
 * 因此预览里的样式与标记都不是手抄副本，改组件后重跑即可同步。
 * 依赖只在 tools/fixture 里（react / react-dom / jsdom）；缺失时退化为纯 CSS 样本。
 *
 * 跑法：node tools/make-preview.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const fixtureRequire = createRequire(path.join(here, 'fixture', 'package.json'))

const STAR = 'M12 1.6 14.34 9.66 22.4 12 14.34 14.34 12 22.4 9.66 14.34 1.6 12 9.66 9.66Z'

/** 从源码里抽出 CSS 数组（fixture 缺失时的退路）。 */
function cssFromSource() {
  const source = fs.readFileSync(path.join(root, 'lib', 'client.js'), 'utf8')
  const block = /var CSS = \[\n([\s\S]*?)\n\s*\]\.join\(''\)/.exec(source)
  if (block === null) return null
  const body = block[1]
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n')
  try {
    return new Function(`return [${body}].join('')`)()
  } catch {
    return null
  }
}

/** 各状态下按钮的静态标记（状态由 data-state 驱动，CSS 才是真实的）。 */
function staticButton(attrs, size = 16) {
  return (
    `<button type="button" class="dshsl-btn" ${attrs}>` +
    `<svg class="dshsl-star" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true">` +
    `<path fill="currentColor" d="${STAR}"/></svg>` +
    `</button>`
  )
}

/* ------------------------------------------------------------------ */
/* 渲染真实组件                                                        */
/* ------------------------------------------------------------------ */

async function renderReal() {
  let JSDOM
  let React
  let ReactDOMClient
  let ReactDOM
  let act
  try {
    JSDOM = fixtureRequire('jsdom').JSDOM
    React = fixtureRequire('react')
    ReactDOMClient = fixtureRequire('react-dom/client')
    ReactDOM = fixtureRequire('react-dom')
    act = fixtureRequire('react-dom/test-utils').act
  } catch {
    return null
  }

  const dom = new JSDOM('<!doctype html><html><head></head><body><div id="stage"></div></body></html>', {
    url: 'http://127.0.0.1:19387/',
    pretendToBeVisual: true,
  })
  for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'KeyboardEvent', 'getComputedStyle']) {
    const value = key === 'window' ? dom.window : dom.window[key]
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true })
  }
  Object.defineProperty(globalThis, 'requestAnimationFrame', {
    value: (callback) => setTimeout(() => callback(Date.now()), 0),
    configurable: true,
    writable: true,
  })
  globalThis.IS_REACT_ACT_ENVIRONMENT = true

  /* —— 假宿主 —— */
  const manifest = {
    ok: true,
    version: '0.3.0',
    configFile: 'C:\\Users\\you\\.dsh\\starlight-prompt.json',
    llmAvailable: true,
    rules: [
      { id: 'goal', group: 'base', title: { zh: '明确目标', en: 'State the goal' }, note: { zh: '开头一句话说清要达成什么结果', en: 'One line up front' } },
      { id: 'requirements', group: 'base', title: { zh: '拆出具体要求', en: 'Extract requirements' }, note: { zh: '把混在叙述里的要求逐条列出', en: 'List the asks' } },
      { id: 'output', group: 'base', title: { zh: '规定输出形式', en: 'Specify the output' }, note: { zh: '长度、结构、格式、语言', en: 'Length, format' } },
      { id: 'structure', group: 'base', title: { zh: '结构化排版', en: 'Structure the layout' }, note: { zh: '用标题/列表替代大段流水句', en: 'Headings over prose' } },
      { id: 'concise', group: 'quality', title: { zh: '去冗余', en: 'Cut redundancy' }, note: { zh: '删口语、重复、自明内容', en: 'Drop filler' } },
      { id: 'precise', group: 'quality', title: { zh: '消除歧义', en: 'Remove ambiguity' }, note: { zh: '把模糊词换成可判断的表述', en: 'Make it checkable' } },
      { id: 'acceptance', group: 'quality', title: { zh: '验收标准', en: 'Acceptance criteria' }, note: { zh: '怎样算做完、怎样算好', en: 'Definition of done' } },
      { id: 'preserve', group: 'guard', title: { zh: '保真：不改需求', en: 'Fidelity: keep the asks' }, note: { zh: '不加需求、不删需求', en: 'No added or dropped asks' } },
      { id: 'verbatim', group: 'guard', title: { zh: '原样保留技术标识', en: 'Keep identifiers verbatim' }, note: { zh: '路径/命令/代码/占位符', en: 'Paths, code, placeholders' } },
      { id: 'noinvent', group: 'guard', title: { zh: '不编造事实', en: 'Invent nothing' }, note: { zh: '不补数据、不假设环境', en: 'No made-up data' } },
      { id: 'assumptions', group: 'guard', title: { zh: '声明假设', en: 'Declare assumptions' }, note: { zh: '把隐含前提显式写出来', en: 'Surface premises' } },
    ],
    ruleGroups: [
      { id: 'base', label: { zh: '基础结构', en: 'Structure the ask' }, note: { zh: '决定提示词的骨架', en: 'The skeleton' } },
      { id: 'quality', label: { zh: '表达质量', en: 'Expression quality' }, note: { zh: '决定读起来有多清楚', en: 'How clear it reads' } },
      { id: 'guard', label: { zh: '保真护栏', en: 'Fidelity guards' }, note: { zh: '防止改写跑偏', en: 'Keeps rewrites honest' } },
    ],
    verbosities: [
      { id: 'concise', label: { zh: '精简', en: 'Concise' }, note: { zh: '最短篇幅', en: 'Shortest form' } },
      { id: 'standard', label: { zh: '标准', en: 'Standard' }, note: { zh: '目标/要求/输出/约束', en: 'Goal/requirements/output' } },
      { id: 'detailed', label: { zh: '详尽', en: 'Detailed' }, note: { zh: '补充边界与验证', en: 'Add edge cases' } },
    ],
    lenses: [
      { id: 'auto', label: { zh: '通用', en: 'General' }, note: { zh: '由模型判断形态', en: 'Let the model pick' } },
      { id: 'engineering', label: { zh: '工程', en: 'Engineering' }, note: { zh: '面向代码/系统任务', en: 'For code tasks' } },
      { id: 'writing', label: { zh: '写作', en: 'Writing' }, note: { zh: '面向文案/文章', en: 'For copy and prose' } },
      { id: 'analysis', label: { zh: '分析', en: 'Analysis' }, note: { zh: '面向研究/评估', en: 'For research' } },
    ],
    depths: [
      { id: 'minimal', label: { zh: '最小', en: 'Minimal' }, note: { zh: '只改错，措辞不动', en: 'Fix errors only' } },
      { id: 'light', label: { zh: '轻改', en: 'Light' }, note: { zh: '顺语句、补结构', en: 'Tidy up' } },
      { id: 'balanced', label: { zh: '均衡', en: 'Balanced' }, note: { zh: '篇幅与原稿相当', en: 'Similar length' } },
      { id: 'strong', label: { zh: '重写', en: 'Strong' }, note: { zh: '可明显变长', en: 'May grow' } },
      { id: 'rewrite', label: { zh: '重构', en: 'Rebuild' }, note: { zh: '推倒重写成新提示词', en: 'Build anew' } },
    ],
    locales: [
      { id: 'auto', label: { zh: '跟随原文', en: 'Follow draft' }, note: { zh: '中文进中文出', en: 'Same language' } },
      { id: 'zh', label: { zh: '中文', en: 'Chinese' }, note: { zh: '始终简体中文', en: 'Always Chinese' } },
      { id: 'en', label: { zh: 'English', en: 'English' }, note: { zh: '始终英文', en: 'Always English' } },
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
  const models = {
    ok: true,
    models: [
      { provider: 'deepseek-account', model: 'deepseek-flash', name: 'DeepSeek V4.1 Flash' },
      { provider: 'deepseek-account', model: 'deepseek-pro', name: 'DeepSeek V4.1 Pro' },
      { provider: 'openrouter', model: 'anthropic/claude', name: 'Claude (via OpenRouter)' },
    ],
    default: { provider: 'deepseek-account', model: 'deepseek-flash', source: 'default' },
    configured: { provider: '', model: '' },
    errors: [],
  }
  globalThis.fetch = async (url) => ({
    ok: true,
    json: async () => (String(url).includes('/models') ? models : manifest),
  })

  /* —— 加载真实客户端半部 —— */
  const loaded = []
  dom.window.__ModuleLoader__ = {
    load(entry) {
      loaded.push(entry)
    },
  }
  await import(pathToFileURL(path.join(root, 'lib', 'client.js')).href)
  const exportsOf = loaded[0].factory((id) => {
    if (id === 'react') return React
    if (id === 'react-dom') return ReactDOM
    throw new Error(`unexpected require: ${id}`)
  })

  /* —— 假输入面板 —— */
  const makeShell = (draft) => ({
    state: {
      getSnapshot: () => ({ draft, phase: 'idle' }),
      subscribe: () => () => {},
    },
    setDraft() {},
    focus() {},
  })

  const stage = dom.window.document.getElementById('stage')
  const rootObj = ReactDOMClient.createRoot(stage)

  // 1) 设置页
  await act(async () => {
    rootObj.render(React.createElement(exportsOf.StarlightSettingsSection, {}))
  })
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10))
  })
  const settingsHtml = stage.innerHTML
  await act(async () => {
    rootObj.unmount()
  })

  // 2) 按钮 + 右键浮层
  const stage2 = dom.window.document.createElement('div')
  dom.window.document.body.appendChild(stage2)
  const root2 = ReactDOMClient.createRoot(stage2)
  await act(async () => {
    root2.render(
      React.createElement(exportsOf.StarlightButton, {
        star: { shell: makeShell('帮我写个二分查找'), route: { provider: 'deepseek-account', model: 'deepseek-flash' } },
      }),
    )
  })
  const buttonHtml = stage2.querySelector('[data-dsh-starlight="button"]').outerHTML

  await act(async () => {
    stage2
      .querySelector('[data-dsh-starlight="button"]')
      .dispatchEvent(new dom.window.MouseEvent('contextmenu', { bubbles: true, cancelable: true }))
  })
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10))
  })
  let panelHtml = ''
  const panel = dom.window.document.querySelector('.dshsl-panel')
  if (panel !== null) {
    // 浮层在真实界面里是 position:fixed 贴按钮；静态页里改成文档流展示
    panel.removeAttribute('style')
    panel.style.position = 'relative'
    panel.style.maxHeight = 'none'
    panelHtml = panel.outerHTML
  }

  // 3) 真实 CSS（由 injectStyle 注入）
  const styleTag = dom.window.document.head.querySelector('style[data-plugin-css]')
  const css = styleTag === null ? null : styleTag.textContent

  await act(async () => {
    root2.unmount()
  })
  dom.window.close()
  return { css, settingsHtml, buttonHtml, panelHtml }
}

/* ------------------------------------------------------------------ */
/* 组装页面                                                            */
/* ------------------------------------------------------------------ */

const rendered = await renderReal()
const CSS = rendered?.css ?? cssFromSource()
if (CSS === null) {
  console.error('既没有 fixture 也抽不出 CSS，无法生成预览')
  process.exit(1)
}

const buttonHtml = rendered ? rendered.buttonHtml : staticButton('data-state="idle"')
const settingsHtml =
  rendered?.settingsHtml ??
  '<p style="color:#9aa0a6">（未安装 tools/fixture 依赖，设置页与浮层预览已跳过。运行 <code>cd tools/fixture &amp;&amp; npm install</code> 后重跑本脚本即可看到真实排版。）</p>'
const panelHtml = rendered?.panelHtml ?? ''

const TOKENS = `
  :root{--dsw-alias-bg-base:#fff;--dsw-alias-bg-layer-1:#f6f7f9;--dsw-alias-bg-layer-2:#fff;--dsw-alias-border-l1:rgba(20,24,30,.06);--dsw-alias-border-l2:rgba(20,24,30,.10);--dsw-alias-border-l3:rgba(20,24,30,.18);--dsw-alias-border-l4:rgba(20,24,30,.26);--dsw-alias-label-primary:#14181e;--dsw-alias-label-secondary:#5f6570;--dsw-alias-label-tertiary:#8a8f98;--dsw-alias-label-caption:#9aa0a6;--dsw-alias-label-dimmed:#b3b7bd;--dsw-alias-label-primary-foreground:#fff;--dsw-alias-interactive-bg-hover:rgba(20,24,30,.06);--dsw-alias-state-business-primary:#4d6bfe;--dsw-alias-state-error-primary:#e5484d;--dsw-alias-state-success-primary:#2f9e44;--dsw-alias-state-warn-primary:#d17a00;--dsw-alias-menu-surface-fill:#fff;--dsw-alias-button-primary-fill:#4d6bfe;--dsw-alias-link:#4d6bfe;--dsw-elevation-panel:0 12px 40px rgba(0,0,0,.22);--dsw-elevation-prominent:0 8px 24px rgba(0,0,0,.28);--dsw-radius-panel:14px;--dsw-alias-toast-bg:rgba(28,30,34,.94);--dsw-alias-toast-label:#fff;--dsw-font-markdown-code-font-family:ui-monospace,SFMono-Regular,Consolas,monospace}
  html[data-theme=dark]{--dsw-alias-bg-base:#14161a;--dsw-alias-bg-layer-1:#191c21;--dsw-alias-bg-layer-2:#20242b;--dsw-alias-border-l1:rgba(255,255,255,.06);--dsw-alias-border-l2:rgba(255,255,255,.10);--dsw-alias-border-l3:rgba(255,255,255,.20);--dsw-alias-border-l4:rgba(255,255,255,.28);--dsw-alias-label-primary:#e8eaee;--dsw-alias-label-secondary:#a8aeb8;--dsw-alias-label-tertiary:#8a8f98;--dsw-alias-label-caption:#767c86;--dsw-alias-label-dimmed:#5b616b;--dsw-alias-label-primary-foreground:#fff;--dsw-alias-interactive-bg-hover:rgba(255,255,255,.08);--dsw-alias-state-business-primary:#7f95ff;--dsw-alias-state-error-primary:#ff6b6f;--dsw-alias-state-success-primary:#57c76b;--dsw-alias-state-warn-primary:#e2a03f;--dsw-alias-menu-surface-fill:#20242b;--dsw-alias-button-primary-fill:#7f95ff;--dsw-alias-link:#8aa4ff}
`

const PREVIEW_CHROME = `
  body{margin:0;padding:32px 32px 80px;font:14px/1.6 -apple-system,"Segoe UI",system-ui,"Microsoft YaHei",sans-serif;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary)}
  h1{font-size:18px;margin:0 0 4px}
  p.sub{margin:0 0 8px;color:var(--dsw-alias-label-secondary);font-size:12.5px}
  h2{font-size:13px;font-weight:600;margin:30px 0 10px;color:var(--dsw-alias-label-secondary)}
  .row{display:flex;align-items:flex-start;gap:14px;flex-wrap:wrap}
  .stage{background:var(--dsw-alias-bg-base);border:.5px solid var(--dsw-alias-border-l2);border-radius:14px;padding:18px 20px}
  .toolbar{display:flex;align-items:center;gap:6px;border:.5px solid var(--dsw-alias-border-l3);border-radius:14px;padding:8px 10px;margin-top:4px}
  .toolbar .spacer{flex:1}
  .chip{height:26px;padding:0 10px;display:inline-flex;align-items:center;border-radius:999px;font-size:12px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-interactive-bg-hover)}
  .dot{width:26px;height:26px;border-radius:999px;background:var(--dsw-alias-state-business-primary)}
  .caption{font-size:11.5px;color:var(--dsw-alias-label-caption);margin:6px 0 0}
  .toggle{position:fixed;top:20px;right:24px;font-size:12px;padding:5px 12px;border-radius:999px;border:.5px solid var(--dsw-alias-border-l3);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);cursor:pointer;z-index:9}
  .hover-demo .dshsl-btn{color:var(--dsw-alias-state-business-primary);box-shadow:0 0 0 1px var(--dsw-alias-state-business-primary),0 0 0 4px color-mix(in srgb,var(--dsw-alias-state-business-primary) 16%,transparent),0 4px 16px -6px color-mix(in srgb,var(--dsw-alias-state-business-primary) 55%,transparent)}
  .settings-host{max-width:620px}
`

const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<title>星芒 · 界面预览</title>
<style>${TOKENS}${PREVIEW_CHROME}</style>
<style data-preview="real-css">${CSS}</style>
</head>
<body>
  <button class="toggle" type="button" onclick="var h=document.documentElement;h.dataset.theme=h.dataset.theme==='dark'?'light':'dark';this.textContent=h.dataset.theme==='dark'?'切换到亮色':'切换到暗色'">切换到暗色</button>

  <h1>星芒 · 界面预览</h1>
  <p class="sub">${
    rendered
      ? '按钮、右键浮层、设置页都是<strong>真实组件</strong>在 jsdom 里渲染出来的标记与 CSS（不是手抄副本）。改动需重启 DSH 后才会出现在真实界面里。'
      : '当前显示的是纯 CSS 样本（未安装 tools/fixture 依赖）。'
  }</p>

  <h2>① 按钮在工具行里的位置（左侧簇首位）</h2>
  <div class="stage">
    <div class="toolbar">
      ${buttonHtml}
      <span class="chip">＋</span>
      <span class="chip">权限</span>
      <span class="spacer"></span>
      <span class="chip">模型选择</span>
      <span class="dot"></span>
    </div>
    <p class="caption">order: 10 —— 排在官方附件与权限按钮之前；右侧圆点是「发送」占位。</p>
  </div>

  <h2>② 五种状态 + 悬停示意</h2>
  <div class="row">
    <div class="stage" style="text-align:center;min-width:104px">${staticButton('data-state="idle"')}<p class="caption">idle</p></div>
    <div class="stage" style="text-align:center;min-width:104px">${staticButton('data-state="idle" disabled')}<p class="caption">disabled（空草稿）</p></div>
    <div class="stage" style="text-align:center;min-width:104px">${staticButton('data-state="busy"')}<p class="caption">busy（旋转）</p></div>
    <div class="stage" style="text-align:center;min-width:104px">${staticButton('data-state="error"')}<p class="caption">error</p></div>
    <div class="stage" style="text-align:center;min-width:104px">${staticButton('data-state="done"')}<p class="caption">done</p></div>
    <div class="stage" style="text-align:center;min-width:104px"><span class="hover-demo">${staticButton('data-state="idle"')}</span><p class="caption">hover（示意）</p></div>
  </div>

  <h2>③ 放大看外圈</h2>
  <div class="row">
    <div class="stage" style="transform:scale(3);transform-origin:left center;margin:24px 0 24px 28px">${staticButton('data-state="idle"')}</div>
    <p class="caption" style="max-width:420px">外圈是三层 <code>box-shadow</code>：1px 描边圈 + 1px 近距投影 + 14px 远距扩散。刻意不用 <code>border</code>——按钮恒为 28×28，不会把工具行撑高。</p>
  </div>

  <h2>④ 右键浮层（真实排版）</h2>
  <div class="row">${panelHtml === '' ? '<p class="caption">（打开浮层失败，已跳过）</p>' : panelHtml}</div>

  <h2>⑤ 设置 → 星芒提示词（真实排版）</h2>
  <div class="stage settings-host">${settingsHtml}</div>

  <script>
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.dataset.theme = 'dark'
      document.querySelector('.toggle').textContent = '切换到亮色'
    }
  </script>
</body>
</html>
`

const target = path.join(root, 'tools', 'preview.html')
fs.writeFileSync(target, html, 'utf8')
console.log(`已生成 ${path.relative(root, target)}（${Buffer.byteLength(html)} 字节）`)
console.log(rendered ? '模式：真实组件渲染（jsdom + React）+ 真实 CSS' : '模式：纯 CSS 样本（fixture 缺失）')
console.log(`CSS 长度：${CSS.length}；设置页标记：${settingsHtml.length}；浮层标记：${panelHtml.length}`)

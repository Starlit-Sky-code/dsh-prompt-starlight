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
 * Client 半部集成测试：用 jsdom + 真实 React 18 加载 lib/client.js，
 * 验证模块加载器契约、两条槽位注册（composer 按钮 + 设置页）、
 * 按钮渲染与一键优化、撤销、规则浮层、以及独立设置页的读写。
 * 跑法：node tools/test-client.mjs
 */
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
// 测试依赖（react / react-dom / jsdom）装在 tools/fixture 里，不污染插件包本身。
const fixtureRequire = createRequire(path.join(here, 'fixture', 'package.json'))
const { JSDOM } = fixtureRequire('jsdom')

/* ------------------------------------------------------------------ */
/* 环境                                                               */
/* ------------------------------------------------------------------ */

const dom = new JSDOM('<!doctype html><html><head></head><body><div id="root"></div></body></html>', {
  url: 'http://127.0.0.1:19387/',
  pretendToBeVisual: true,
})
const globals = ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'KeyboardEvent', 'getComputedStyle']
for (const key of globals) {
  const value = key === 'window' ? dom.window : dom.window[key]
  Object.defineProperty(globalThis, key, { value, configurable: true, writable: true })
}
Object.defineProperty(globalThis, 'requestAnimationFrame', {
  value: (callback) => setTimeout(() => callback(Date.now()), 0),
  configurable: true,
  writable: true,
})
globalThis.IS_REACT_ACT_ENVIRONMENT = true

const React = fixtureRequire('react')
const ReactDOMClient = fixtureRequire('react-dom/client')
const ReactDOM = fixtureRequire('react-dom')
const { act } = fixtureRequire('react-dom/test-utils')

let failures = 0
let passes = 0
function check(name, condition, detail) {
  if (condition) {
    passes += 1
    console.log(`  ok   ${name}`)
  } else {
    failures += 1
    console.log(`  FAIL ${name}${detail === undefined ? '' : ` — ${detail}`}`)
  }
}
const tick = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })

/* ------------------------------------------------------------------ */
/* 1. 模块加载器契约                                                  */
/* ------------------------------------------------------------------ */

console.log('\n[1] 模块加载器契约')

const loaded = []
dom.window.__ModuleLoader__ = {
  load(entry) {
    loaded.push(entry)
  },
}

await import(pathToFileURL(path.join(here, '..', 'lib', 'client.js')).href)

check('调用了 __ModuleLoader__.load', loaded.length === 1, String(loaded.length))
check('id 为包名', loaded[0].id === 'dsh-prompt-starlight', loaded[0].id)
check('factory 是函数', typeof loaded[0].factory === 'function')

const exportsOf = loaded[0].factory((id) => {
  if (id === 'react') return React
  if (id === 'react-dom') return ReactDOM
  throw new Error(`unexpected require: ${id}`)
})

check('导出 apply', typeof exportsOf.apply === 'function')
check('导出 inject = ["slots"]', Array.isArray(exportsOf.inject) && exportsOf.inject[0] === 'slots', JSON.stringify(exportsOf.inject))
check('导出 StarlightButton 组件', typeof exportsOf.StarlightButton === 'function')
check('导出 StarlightSettingsSection 组件', typeof exportsOf.StarlightSettingsSection === 'function')

/* ------------------------------------------------------------------ */
/* 2. 槽位注册                                                        */
/* ------------------------------------------------------------------ */

console.log('\n[2] 槽位注册')

function makeFakeShell(draft) {
  const listeners = new Set()
  let snapshot = { draft, phase: 'idle' }
  const shell = {
    writes: [],
    state: {
      getSnapshot: () => snapshot,
      subscribe: (listener) => {
        listeners.add(listener)
        return () => listeners.delete(listener)
      },
    },
    set draft(next) {
      snapshot = { ...snapshot, draft: next }
      for (const listener of listeners) listener()
    },
    get draft() {
      return snapshot.draft
    },
    setDraft(text) {
      shell.writes.push(text)
      shell.draft = text
    },
    focus() {
      shell.focused = (shell.focused || 0) + 1
    },
  }
  return shell
}

const fakeShell = makeFakeShell('原始草稿')
const registry = {}

function makeSlots() {
  return {
    inject(name, callback) {
      return callback()
    },
    register(config, component) {
      registry[config.name] = { config, component }
      return () => {
        delete registry[config.name]
      }
    },
  }
}

function makeCtx(overrides = {}) {
  return {
    get(name) {
      if (overrides.sessions !== undefined) return overrides.sessions(name)
      if (name === 'sessions') {
        return {
          binding: (sessionId) => {
            if (sessionId !== 's1') return undefined
            return {
              session: {
                projections: {
                  faceOf: (face) => ({
                    getSnapshot: () =>
                      face === 'modelSelection' ? { next: { provider: 'deepseek-account', model: 'deepseek-flash' } } : null,
                  }),
                },
              },
              ctx: {
                get: (service) => (service === 'conversation' ? { input: { for: () => fakeShell } } : null),
              },
            }
          },
        }
      }
      return undefined
    },
    slots: makeSlots(),
  }
}

exportsOf.apply(makeCtx())

const buttonEntry = registry['conversation.input.left']
check('注册进 conversation.input.left（左侧席位）', buttonEntry !== undefined)
check('不再注册到 conversation.input.right', registry['conversation.input.right'] === undefined)
check('按钮条目 id 为 dsh-starlight', buttonEntry.config.id === 'dsh-starlight', buttonEntry.config.id)
check('按钮条目 order 为数字', typeof buttonEntry.config.order === 'number', String(buttonEntry.config.order))
check('按钮条目 order 足够靠左', buttonEntry.config.order <= 10, String(buttonEntry.config.order))
check('注入了 inject 工厂', typeof buttonEntry.config.inject === 'function')

const sectionEntry = registry['settings.section']
check('注册进 settings.section（独立设置页）', sectionEntry !== undefined)
check('设置页 id 为 starlight', sectionEntry.config.id === 'starlight', sectionEntry.config.id)
check('设置页 order 为数字', typeof sectionEntry.config.order === 'number', String(sectionEntry.config.order))
check('设置页 label 是求值函数', typeof sectionEntry.config.label === 'function')
const labelText = sectionEntry.config.label()
check('设置页 label 非空', typeof labelText === 'string' && labelText.length > 0, labelText)
check('设置页组件已挂载', typeof sectionEntry.component === 'function')

const starProps = buttonEntry.config.inject('s1')
check('拿到输入面板 facade', starProps.star.shell === fakeShell)
check('拿到会话当前模型', starProps.star.route.provider === 'deepseek-account' && starProps.star.route.model === 'deepseek-flash')

const missing = buttonEntry.config.inject('nope')
check('未知会话不抛异常', missing.star.shell === null && missing.star.route === null)

// 只提供 shell(sessionId) 的 facade 也要能拿到（for() 缺失的宿主变体）
exportsOf.apply(
  makeCtx({
    sessions: (name) =>
      name === 'sessions'
        ? {
            binding: () => ({
              session: { projections: { faceOf: () => ({ getSnapshot: () => null }) } },
              ctx: { get: () => ({ input: { shell: () => fakeShell } }) },
            }),
          }
        : undefined,
  }),
)
const shellOnlyStar = registry['conversation.input.left'].config.inject('s1')
check('仅 shell(sessionId) 的 facade 可用', shellOnlyStar.star.shell === fakeShell)
check('facade 缺失时模型路由为 null', shellOnlyStar.star.route === null)

// 会话服务整个缺失时也必须安全退化
exportsOf.apply(
  makeCtx({
    sessions: () => undefined,
  }),
)
check('无 sessions 服务时安全退化', registry['conversation.input.left'].config.inject('s1').star.shell === null)

// 恢复完整 ctx 供后续渲染
exportsOf.apply(makeCtx())
const readyStar = registry['conversation.input.left'].config.inject('s1')
const SettingsSection = registry['settings.section'].component

/* ------------------------------------------------------------------ */
/* 3. 按钮渲染与一键优化                                              */
/* ------------------------------------------------------------------ */

console.log('\n[3] 按钮渲染与一键优化')

const fetchLog = []
let fetchImpl = null
globalThis.fetch = async (url, init) => {
  const target = String(url)
  const body = init && init.body ? JSON.parse(init.body) : undefined
  fetchLog.push({ url: target, method: (init && init.method) || 'GET', body })
  const payload = fetchImpl(target, body)
  return { ok: true, json: async () => payload }
}

const container = dom.window.document.getElementById('root')
const root = ReactDOMClient.createRoot(container)

await act(async () => {
  root.render(React.createElement(exportsOf.StarlightButton, { star: readyStar.star }))
})

const button = container.querySelector('[data-dsh-starlight="button"]')
check('渲染出圆形按钮', button !== null)
check('按钮内含四角星 SVG', button.querySelector('svg path') !== null)
check('按钮 type=button', button.getAttribute('type') === 'button')
check('草稿非空时按钮可用', button.disabled === false)
check('title 为优化提示', /optimize|优化/i.test(button.getAttribute('title') || ''), button.getAttribute('title'))

// 点击 → 优化
fetchImpl = (url) => {
  if (url.endsWith('/dsh-starlight/optimize')) {
    return { ok: true, text: '优化后的提示词', mode: 'model', model: 'deepseek-flash', elapsedMs: 1200 }
  }
  return { ok: false, error: { code: 'unexpected', message: `unexpected url ${url}` } }
}

await act(async () => {
  button.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
})
await tick()

check('发出了 optimize 请求', fetchLog.some((entry) => entry.url === '/dsh-starlight/optimize' && entry.method === 'POST'))
const optimizeCall = fetchLog.find((entry) => entry.url === '/dsh-starlight/optimize')
check('请求体带草稿', optimizeCall.body.text === '原始草稿', JSON.stringify(optimizeCall.body))
check('请求体带会话模型路由', optimizeCall.body.route.model === 'deepseek-flash')
check('回填了优化结果', fakeShell.writes.includes('优化后的提示词'), JSON.stringify(fakeShell.writes))
check('回填后草稿更新', fakeShell.draft === '优化后的提示词', fakeShell.draft)
check('回填后聚焦编辑器', (fakeShell.focused || 0) >= 1)

const toast = dom.window.document.querySelector('.dshsl-toast')
check('出现撤销提示条', toast !== null)
check('提示条含模型与耗时', /deepseek-flash/.test(toast.textContent) && /1\.2s/.test(toast.textContent), toast.textContent)
const undoButton = toast.querySelector('.dshsl-toast-btn')
check('提示条含撤销按钮', undoButton !== null)

await act(async () => {
  undoButton.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
})
check('撤销恢复原草稿', fakeShell.draft === '原始草稿', fakeShell.draft)
check('撤销后提示条消失', dom.window.document.querySelector('.dshsl-toast') === null)

/* 空草稿 */
await act(async () => {
  fakeShell.draft = '   '
  await new Promise((resolve) => setTimeout(resolve, 0))
})
check('空草稿时按钮禁用', container.querySelector('[data-dsh-starlight="button"]').disabled === true)

await act(async () => {
  fakeShell.draft = '再来一次'
  await new Promise((resolve) => setTimeout(resolve, 0))
})
check('重新输入后按钮恢复可用', container.querySelector('[data-dsh-starlight="button"]').disabled === false)

/* 失败路径 */
fetchImpl = () => ({ ok: false, error: { code: 'llm-failed', message: '模型挂了' } })
const beforeFail = fetchLog.length
await act(async () => {
  container.querySelector('[data-dsh-starlight="button"]').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
})
await tick()
check('失败时仍发出请求', fetchLog.length > beforeFail)
check('失败不改草稿', fakeShell.draft === '再来一次', fakeShell.draft)
check('失败进入 error 态', container.querySelector('[data-dsh-starlight="button"]').getAttribute('data-state') === 'error')
check('失败弹出错误提示', /模型挂了/.test(dom.window.document.querySelector('.dshsl-toast')?.textContent || ''))

/* ------------------------------------------------------------------ */
/* 4. 按钮右键浮层                                                    */
/* ------------------------------------------------------------------ */

console.log('\n[4] 浮层：模型置顶 + 滑块')

const manifestPayload = () => ({
  ok: true,
  version: '0.4.0',
  configFile: 'C:/fake/starlight-prompt.json',
  llmAvailable: true,
  rules: [
    { id: 'goal', group: 'base', title: { zh: '明确目标', en: 'State the goal' }, note: { zh: '开头一句话', en: 'One line' } },
    { id: 'structure', group: 'base', title: { zh: '结构化排版', en: 'Structure' }, note: { zh: '标题与列表', en: 'Headings' } },
    { id: 'preserve', group: 'guard', title: { zh: '保真', en: 'Fidelity' }, note: { zh: '不改需求', en: 'Keep the asks' } },
  ],
  ruleGroups: [
    { id: 'base', label: { zh: '基础结构', en: 'Structure the ask' }, note: { zh: '骨架', en: 'Skeleton' } },
    { id: 'quality', label: { zh: '表达质量', en: 'Expression quality' }, note: { zh: '清楚', en: 'Clarity' } },
    { id: 'guard', label: { zh: '保真护栏', en: 'Fidelity guards' }, note: { zh: '不跑偏', en: 'Keeps it honest' } },
  ],
  verbosities: [
    { id: 'concise', label: { zh: '精简', en: 'Concise' }, note: { zh: '短', en: 'Short' } },
    { id: 'standard', label: { zh: '标准', en: 'Standard' }, note: { zh: '标准', en: 'Standard' } },
    { id: 'detailed', label: { zh: '详尽', en: 'Detailed' }, note: { zh: '长', en: 'Long' } },
  ],
  lenses: [
    { id: 'auto', label: { zh: '通用', en: 'General' }, note: { zh: '通用', en: 'General' } },
    { id: 'engineering', label: { zh: '工程', en: 'Engineering' }, note: { zh: '工程', en: 'Engineering' } },
  ],
  locales: [
    { id: 'auto', label: { zh: '跟随原文', en: 'Follow' }, note: { zh: '', en: '' } },
    { id: 'zh', label: { zh: '中文', en: 'Chinese' }, note: { zh: '', en: '' } },
    { id: 'en', label: { zh: 'English', en: 'English' }, note: { zh: '', en: '' } },
  ],
  depths: [
    { id: 'minimal', label: { zh: '最小', en: 'Minimal' }, note: { zh: '只改错', en: 'Fix errors' } },
    { id: 'light', label: { zh: '轻改', en: 'Light' }, note: { zh: '顺语句', en: 'Tidy' } },
    { id: 'balanced', label: { zh: '均衡', en: 'Balanced' }, note: { zh: '默认', en: 'Default' } },
    { id: 'strong', label: { zh: '重写', en: 'Strong' }, note: { zh: '大改', en: 'Big' } },
    { id: 'rewrite', label: { zh: '重构', en: 'Rebuild' }, note: { zh: '推倒重写', en: 'Rebuild' } },
  ],
  config: {
    enabled: true,
    verbosity: 'standard',
    lens: 'auto',
    locale: 'auto',
    depth: 'balanced',
    disabledRules: [],
    customRules: [],
    provider: '',
    model: '',
    maxTokens: 1600,
    temperature: 0.3,
    timeoutMs: 60000,
  },
})

let savedConfigRequest = null
fetchImpl = (url, body) => {
  if (url.endsWith('/manifest')) return manifestPayload()
  if (url.includes('/models')) {
    return {
      ok: true,
      models: [{ provider: 'deepseek-account', model: 'deepseek-flash', name: 'DeepSeek V4.1 Flash' }],
      default: { provider: 'deepseek-account', model: 'deepseek-flash', source: 'default' },
      errors: [],
    }
  }
  if (url.endsWith('/config')) {
    savedConfigRequest = body
    return { ...manifestPayload(), config: { ...manifestPayload().config, ...body } }
  }
  return { ok: false, error: { code: 'unexpected', message: url } }
}

await act(async () => {
  container
    .querySelector('[data-dsh-starlight="button"]')
    .dispatchEvent(new dom.window.MouseEvent('contextmenu', { bubbles: true, cancelable: true }))
})
await tick()

const panel = dom.window.document.querySelector('.dshsl-panel')
check('右键打开浮层', panel !== null)

// 模型必须排在第一位
const firstRow = panel.querySelector('.dshsl-body .dshsl-row')
check('第一项是模型', firstRow !== null && /模型|Model/.test(firstRow.textContent), firstRow && firstRow.textContent.slice(0, 40))
check('模型用原生形态的选择行（不是系统下拉）', firstRow !== null && firstRow.querySelector('.dshsl-picker-row') !== null)
check('页面上没有 <select> 元素（避免系统级弹出层）', panel.querySelector('select') === null)
check('选择行显示当前值', firstRow !== null && /跟随会话|Follow/.test(firstRow.textContent), firstRow && firstRow.textContent.slice(0, 40))
check('选择行带箭头', firstRow !== null && firstRow.querySelector('.dshsl-picker-caret') !== null)
check('列表默认收起', panel.querySelector('.dshsl-picker-list') === null)

await act(async () => {
  firstRow.querySelector('.dshsl-picker-row').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
})
const pickerList = panel.querySelector('.dshsl-picker-list')
check('点开后出现选项列表', pickerList !== null)
check('列表带 listbox 语义', pickerList !== null && pickerList.getAttribute('role') === 'listbox')
const pickerOptions = pickerList === null ? [] : Array.from(pickerList.querySelectorAll('.dshsl-option[role=option]'))
check('选项至少包含跟随会话 + 目录里的模型', pickerOptions.length >= 2, String(pickerOptions.length))
check('跟随会话排在第一位', pickerOptions[0] !== undefined && (pickerOptions[0].getAttribute('aria-selected') === 'true'), pickerOptions[0] && pickerOptions[0].textContent)
check('当前项有勾选标记', pickerOptions[0] !== undefined && pickerOptions[0].querySelector('.dshsl-option-check').textContent === '✓')
check('有「重新读取目录」项', pickerList !== null && pickerList.querySelector('.dshsl-option-reload') !== null)

// 选一个目录里的模型：列表应收起，且状态变脏
await act(async () => {
  pickerOptions[1].dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
})
check('选中后列表收起', panel.querySelector('.dshsl-picker-list') === null)
check('选中后选择行显示新值', /DeepSeek/.test(panel.querySelector('.dshsl-picker-row').textContent), panel.querySelector('.dshsl-picker-row').textContent)
check('浮层头部带插件图标', panel.querySelector('.dshsl-head img.dshsl-icon') !== null)

// 齿轮：DSH 没有「打开设置页」的接口，所以这里就地展开设置页的内容。
check('头部有齿轮按钮', panel.querySelectorAll('.dshsl-head .dshsl-x').length === 2, String(panel.querySelectorAll('.dshsl-head .dshsl-x').length))
check('齿轮有说明与按下态语义', panel.querySelector('.dshsl-head .dshsl-x').getAttribute('aria-pressed') === 'false')
check('默认是常用视图（标题不含「全部设置」）', !/全部设置|all settings/.test(panel.querySelector('.dshsl-title').textContent))

const gear = panel.querySelector('.dshsl-head .dshsl-x')
await act(async () => {
  gear.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
})
check('齿轮切换后标题变为「全部设置」', /全部设置|all settings/.test(panel.querySelector('.dshsl-title').textContent), panel.querySelector('.dshsl-title').textContent)
check('齿轮进入按下态', panel.querySelector('.dshsl-head .dshsl-x').getAttribute('aria-pressed') === 'true')
const fullRanges = Array.from(panel.querySelectorAll('.dshsl-body .dshsl-range'))
check('全部设置是常用视图的超集（5 根滑块）', fullRanges.length === 5, String(fullRanges.length))
check('全部设置里有模型选择行', panel.querySelector('.dshsl-body .dshsl-picker-row') !== null)
check('全部设置里有规则勾选', panel.querySelectorAll('.dshsl-rule input[type=checkbox]').length >= 4, String(panel.querySelectorAll('.dshsl-rule input[type=checkbox]').length))
check('全部设置里说明了为什么不是跳转', /同一份配置|share one config/.test(panel.querySelector('.dshsl-body').textContent), panel.querySelector('.dshsl-body').textContent.slice(-80))

await act(async () => {
  panel.querySelector('.dshsl-head .dshsl-x').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
})
check('再点一次回到常用视图', !/全部设置|all settings/.test(panel.querySelector('.dshsl-title').textContent))
check('常用视图仍是 2 根滑块', panel.querySelectorAll('.dshsl-body .dshsl-range').length === 2, String(panel.querySelectorAll('.dshsl-body .dshsl-range').length))

// 两根滑块
const ranges = Array.from(panel.querySelectorAll('.dshsl-body .dshsl-range'))
check('浮层有两根滑块', ranges.length === 2, String(ranges.length))
check('强度滑块是 5 档', ranges[0] && ranges[0].getAttribute('max') === '4', ranges[0] && ranges[0].getAttribute('max'))
check('详细度滑块是 3 档', ranges[1] && ranges[1].getAttribute('max') === '2', ranges[1] && ranges[1].getAttribute('max'))
check('强度滑块当前在均衡（索引 2）', ranges[0] && ranges[0].value === '2', ranges[0] && ranges[0].value)
check('刻度文字齐全', panel.querySelectorAll('.dshsl-tick').length === 8, String(panel.querySelectorAll('.dshsl-tick').length))

// 语言分段 3 个
const langGroup = Array.from(panel.querySelectorAll('.dshsl-seg')).pop()
check('语言有 3 个选项', langGroup !== undefined && langGroup.querySelectorAll('button').length === 3, langGroup && String(langGroup.querySelectorAll('button').length))

// 规则默认折叠
const more = panel.querySelector('.dshsl-more')
check('有折叠区', more !== null)
check('折叠区默认收起', more.getAttribute('data-open') === '0')
check('收起时看不到规则勾选框', panel.querySelectorAll('.dshsl-rule input[type=checkbox]').length === 0)

await act(async () => {
  more.querySelector('.dshsl-more-head').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
})
check('点击后展开', panel.querySelector('.dshsl-more').getAttribute('data-open') === '1')
check('展开后能看到规则', panel.querySelectorAll('.dshsl-rule input[type=checkbox]').length === 4, String(panel.querySelectorAll('.dshsl-rule input[type=checkbox]').length))
check('展开后能看到场景', /场景|Scenario/.test(panel.textContent))

// 拖到最小强度 + 取消勾选一条规则，然后保存
await act(async () => {
  const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set
  setter.call(ranges[0], '0')
  ranges[0].dispatchEvent(new dom.window.Event('input', { bubbles: true }))
})
await act(async () => {
  panel.querySelector('.dshsl-rule input[type=checkbox]').click()
})
check('滑块与勾选都让状态变脏', /未保存|Unsaved/.test(panel.querySelector('.dshsl-hint').textContent), panel.querySelector('.dshsl-hint').textContent)

const saveButton = Array.from(panel.querySelectorAll('.dshsl-btn2')).find((node) => /保存|Save/.test(node.textContent))
check('存在保存按钮', saveButton !== undefined)
await act(async () => {
  saveButton.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
})
await tick()
check('保存请求已发出', savedConfigRequest !== null)
check('保存带最小强度', savedConfigRequest && savedConfigRequest.depth === 'minimal', JSON.stringify(savedConfigRequest && savedConfigRequest.depth))
check('保存带详细度与场景', savedConfigRequest && savedConfigRequest.verbosity === 'standard' && savedConfigRequest.lens === 'auto', JSON.stringify([savedConfigRequest && savedConfigRequest.verbosity, savedConfigRequest && savedConfigRequest.lens]))
check('保存带被取消的规则', savedConfigRequest && JSON.stringify(savedConfigRequest.disabledRules) === '["goal"]', JSON.stringify(savedConfigRequest && savedConfigRequest.disabledRules))
check('保存不再提交旧 style 字段', savedConfigRequest && !('style' in savedConfigRequest), JSON.stringify(Object.keys(savedConfigRequest || {})))

await act(async () => {
  dom.window.document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
})
const closingPanel = dom.window.document.querySelector('.dshsl-panel')
check('Esc 先进入收回动画态', closingPanel !== null && closingPanel.getAttribute('data-closing') === '1', closingPanel && closingPanel.getAttribute('data-closing'))
await act(async () => {
  await new Promise((resolve) => setTimeout(resolve, 240))
})
check('动画结束后浮层卸载', dom.window.document.querySelector('.dshsl-panel') === null)

/* ------------------------------------------------------------------ */
/* 5. 独立设置页                                                      */
/* ------------------------------------------------------------------ */

console.log('\n[5] 设置页：同样的骨架')

const pageContainer = dom.window.document.createElement('div')
dom.window.document.body.appendChild(pageContainer)
const pageRoot = ReactDOMClient.createRoot(pageContainer)

let pageSave = null
fetchImpl = (url, body) => {
  if (url.endsWith('/manifest')) return manifestPayload()
  if (url.includes('/models')) {
    return {
      ok: true,
      models: [{ provider: 'deepseek-account', model: 'deepseek-pro', name: 'DeepSeek V4.1 Pro' }],
      default: { provider: 'deepseek-account', model: 'deepseek-flash', source: 'default' },
      errors: [],
    }
  }
  if (url.endsWith('/config')) {
    pageSave = body
    return { ...manifestPayload(), config: { ...manifestPayload().config, ...body } }
  }
  if (url.endsWith('/reset')) return manifestPayload()
  return { ok: false, error: { code: 'unexpected', message: url } }
}

await act(async () => {
  pageRoot.render(React.createElement(SettingsSection, {}))
})
await tick()

check('设置页渲染出标题', /星芒提示词优化|Starlight prompt optimizer/.test(pageContainer.textContent))
check('设置页头部带插件图标', pageContainer.querySelector('.dshsl-hero img.dshsl-icon') !== null)

// 顺序：模型卡片在改写力度卡片之前
const cards = Array.from(pageContainer.querySelectorAll('.dshsl-card'))
check('有模型与改写力度两张主卡', cards.length === 2, String(cards.length))
check('模型是第一张卡', /模型|Model/.test(cards[0].textContent), cards[0] && cards[0].textContent.slice(0, 30))
check('改写力度是第二张卡', /改写力度|Rewrite force/.test(cards[1].textContent), cards[1] && cards[1].textContent.slice(0, 30))

const pageRanges = Array.from(pageContainer.querySelectorAll('.dshsl-range'))
check('主��面两根滑块', pageRanges.length === 2, String(pageRanges.length))
check('设置页强度也是 5 档', pageRanges[0] && pageRanges[0].getAttribute('max') === '4')
check('设置页有 3 个语言选项', pageContainer.querySelectorAll('.dshsl-seg button').length === 3, String(pageContainer.querySelectorAll('.dshsl-seg button').length))

// 折叠区：规则 / 自定义规则 / 高级 / 关于
const mores = Array.from(pageContainer.querySelectorAll('.dshsl-more'))
check('四个折叠区', mores.length === 4, String(mores.length))
check('折叠区默认全收起', mores.every((node) => node.getAttribute('data-open') === '0'))
check('收起时不渲染规则勾选', pageContainer.querySelectorAll('.dshsl-rule input[type=checkbox]').length === 0)

const pageButtons = () => Array.from(pageContainer.querySelectorAll('.dshsl-page-foot .dshsl-btn2'))
const pageSaveButton = () => pageButtons().find((node) => /保存|Save/.test(node.textContent))
const pageStatus = () => pageContainer.querySelector('.dshsl-status')

check('初始状态「与磁盘一致」', /磁盘|disk/i.test(pageStatus().textContent), pageStatus().textContent)
check('未修改时保存按钮禁用', pageSaveButton().disabled === true)

// 展开「高级」→ 应该出现 3 根数字滑块
const advancedMore = mores[2]
await act(async () => {
  advancedMore.querySelector('.dshsl-more-head').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
})
const allRanges = Array.from(pageContainer.querySelectorAll('.dshsl-range'))
check('高级展开后共 5 根滑块', allRanges.length === 5, String(allRanges.length))
check('高级滑块是数字区间', allRanges[2].getAttribute('min') === '256' && allRanges[2].getAttribute('max') === '8000', allRanges[2] && `${allRanges[2].getAttribute('min')}..${allRanges[2].getAttribute('max')}`)

// 展开「规则」→ 勾选框出现
await act(async () => {
  mores[0].querySelector('.dshsl-more-head').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
})
check('规则展开后有 4 个勾选框', pageContainer.querySelectorAll('.dshsl-rule input[type=checkbox]').length === 4, String(pageContainer.querySelectorAll('.dshsl-rule input[type=checkbox]').length))

// 调一根滑块 + 取消一条规则，然后保存
await act(async () => {
  const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set
  setter.call(pageRanges[1], '2')
  pageRanges[1].dispatchEvent(new dom.window.Event('input', { bubbles: true }))
})
await act(async () => {
  pageContainer.querySelector('.dshsl-rule input[type=checkbox]').click()
})
check('改动后状态变「未保存」', pageStatus().getAttribute('data-dirty') === '1', pageStatus().textContent)
check('改动后保存按钮可用', pageSaveButton().disabled === false)

await act(async () => {
  pageSaveButton().dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
})
await tick()

check('设置页发出保存请求', pageSave !== null)
check('保存带详细度=详尽', pageSave && pageSave.verbosity === 'detailed', JSON.stringify(pageSave && pageSave.verbosity))
check('保存带取消的规则', pageSave && JSON.stringify(pageSave.disabledRules) === '["goal"]', JSON.stringify(pageSave && pageSave.disabledRules))
check('保存带高级字段', pageSave && pageSave.maxTokens === 1600 && pageSave.timeoutMs === 60000, JSON.stringify(pageSave))
check('保存后状态回到「已保存」', pageStatus().getAttribute('data-dirty') === '0', pageStatus().textContent)

/* 宿主不可达时的降级 */
fetchImpl = () => ({ ok: false, error: { code: 'network', message: '宿主无响应' } })
const failContainer = dom.window.document.createElement('div')
dom.window.document.body.appendChild(failContainer)
const failRoot = ReactDOMClient.createRoot(failContainer)
await act(async () => {
  failRoot.render(React.createElement(SettingsSection, {}))
})
await tick()
check('宿主不可达时给出提示', /宿主无响应|宿主半部没有响应|host half/i.test(failContainer.textContent), failContainer.textContent.slice(0, 120))
check('宿主不可达时提供重试按钮', Array.from(failContainer.querySelectorAll('button')).some((node) => /重试|Retry/.test(node.textContent)))


/* ------------------------------------------------------------------ */
/* 6. 设置页：技能市场（只读目录）                                    */
/* ------------------------------------------------------------------ */

console.log('\n[6] 技能市场：只读目录')

const marketContainer = dom.window.document.createElement('div')
dom.window.document.body.appendChild(marketContainer)
const marketRoot = ReactDOMClient.createRoot(marketContainer)

const CATALOG_ITEMS = [
  {
    id: 'clawhub:1',
    reference: 'someone/prompt-harness',
    slug: 'prompt-harness',
    author: 'someone',
    name: 'prompt-harness',
    summary: '把草稿改写成可执行提示词',
    downloads: 4321,
    official: true,
    url: 'https://clawhub.ai/someone/skills/prompt-harness',
  },
  {
    id: 'clawhub:2',
    reference: 'other/review-helper',
    slug: 'review-helper',
    author: 'other',
    name: 'review-helper',
    summary: '',
    url: 'https://clawhub.ai/other/skills/review-helper',
  },
]

let catalogRequest = null
let catalogMode = 'ok'
fetchImpl = (url) => {
  if (url.includes('/skills')) {
    catalogRequest = url
    if (catalogMode === 'error') return { ok: false, error: { code: 'catalog_upstream', message: '目录服务暂时不可用' } }
    return { ok: true, source: 'clawhub', sourceLabel: 'ClawHub', query: 'prompt', items: CATALOG_ITEMS }
  }
  return manifestPayload()
}

await act(async () => {
  marketRoot.render(React.createElement(SettingsSection, {}))
})
await tick()

check('设置页有两个标签页', marketContainer.querySelectorAll('.dshsl-tab').length === 2, String(marketContainer.querySelectorAll('.dshsl-tab').length))
check('默认停在「配置」', marketContainer.querySelector('.dshsl-tab[data-on="1"]').textContent !== '' && /配置|Settings/.test(marketContainer.querySelector('.dshsl-tab[data-on="1"]').textContent), marketContainer.querySelector('.dshsl-tab[data-on="1"]').textContent)
check('默认看不到技能目录', marketContainer.querySelector('.dshsl-market') === null)

await act(async () => {
  marketContainer.querySelectorAll('.dshsl-tab')[1].dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
})
check('切到技能市场', marketContainer.querySelector('.dshsl-market') !== null)
check('有搜索框与按钮', marketContainer.querySelector('.dshsl-market-search input') !== null && marketContainer.querySelectorAll('.dshsl-market-search button').length === 1)
check('未搜索时显示只读说明', /只做展示|read-only/.test(marketContainer.querySelector('.dshsl-market').textContent))
check('切到市场后配置卡片消失', marketContainer.querySelector('.dshsl-card') === null)
check(
  '只读目录页不显示保存类操作',
  marketContainer.querySelectorAll('.dshsl-page-foot .dshsl-btn2').length === 0 &&
    /只读|read-only/.test(marketContainer.querySelector('.dshsl-page-foot').textContent),
  marketContainer.querySelector('.dshsl-page-foot').textContent,
)
await act(async () => {
  marketContainer.querySelectorAll('.dshsl-tab')[0].dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
})
check(
  '切回配置页保存按钮回来',
  marketContainer.querySelectorAll('.dshsl-page-foot .dshsl-btn2').length === 2,
  String(marketContainer.querySelectorAll('.dshsl-page-foot .dshsl-btn2').length),
)
await act(async () => {
  marketContainer.querySelectorAll('.dshsl-tab')[1].dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
})

// 搜索
const searchInput = marketContainer.querySelector('.dshsl-market-search input')
await act(async () => {
  const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set
  setter.call(searchInput, 'prompt')
  searchInput.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
})
await act(async () => {
  marketContainer.querySelector('.dshsl-market-search button').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
})
await act(async () => {
  await new Promise((resolve) => setTimeout(resolve, 30))
})

check('搜索请求打到 /skills 并带编码后的查询词', String(catalogRequest).includes('/skills?q=prompt'), String(catalogRequest))
const skillCards = Array.from(marketContainer.querySelectorAll('.dshsl-skill'))
check('渲染出目录条目', cards.length === 2, String(cards.length))
check('显示名称与作者', skillCards[0].textContent.includes('prompt-harness') && skillCards[0].textContent.includes('someone'), skillCards[0].textContent.slice(0, 60))
check('显示下载数与官方标', skillCards[0].textContent.includes('4321') && /官方|Official/.test(skillCards[0].textContent), skillCards[0].textContent.slice(0, 60))
check('展示目录给的安装引用（不自行编造命令）', skillCards[0].querySelector('.dshsl-skill-ref').textContent === 'someone/prompt-harness', skillCards[0].querySelector('.dshsl-skill-ref').textContent)
check('没有摘要的条目不留空行', skillCards[1].querySelector('.dshsl-skill-summary') === null)
check('有打开目录页的链接', skillCards[0].querySelector('.dshsl-skill-link') !== null && skillCards[0].querySelector('.dshsl-skill-link').getAttribute('rel').includes('noreferrer'))
check('结果显示条数与只读说明', /共 2 条|Found 2/.test(marketContainer.querySelector('.dshsl-market').textContent))

// 复制引用
let copiedText = null
Object.defineProperty(dom.window.navigator, 'clipboard', {
  value: { writeText: async (text) => { copiedText = text } },
  configurable: true,
})
const copyButton = skillCards[0].querySelector('.dshsl-btn3')
await act(async () => {
  copyButton.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
})
await act(async () => {
  await new Promise((resolve) => setTimeout(resolve, 20))
})
check('复制的是目录引用', copiedText === 'someone/prompt-harness', String(copiedText))
check('复制后按钮反馈「已复制」', /已复制|Copied/.test(skillCards[0].textContent), skillCards[0].textContent.slice(0, 40))

// 上游故障
catalogMode = 'error'
await act(async () => {
  const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set
  setter.call(marketContainer.querySelector('.dshsl-market-search input'), 'other')
  marketContainer.querySelector('.dshsl-market-search input').dispatchEvent(new dom.window.Event('input', { bubbles: true }))
})
await act(async () => {
  marketContainer.querySelectorAll('.dshsl-market-search button')[0].dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
})
await act(async () => {
  await new Promise((resolve) => setTimeout(resolve, 30))
})
check('目录故障时给出原因与重试', /目录服务暂时不可用/.test(marketContainer.querySelector('.dshsl-market').textContent) && /重试|Retry/.test(marketContainer.querySelector('.dshsl-market').textContent), marketContainer.querySelector('.dshsl-market').textContent.slice(0, 80))
check('故障时不再展示旧条目', marketContainer.querySelectorAll('.dshsl-skill').length === 0)

console.log(`\n结果：${passes} 通过 / ${failures} 失败`)
await act(async () => {
  root.unmount()
  pageRoot.unmount()
  failRoot.unmount()
  marketRoot.unmount()
})
dom.window.close()
process.exit(failures === 0 ? 0 : 1)

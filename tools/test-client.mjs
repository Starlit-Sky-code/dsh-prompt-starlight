/**
 * Client 半部集成测试：用 jsdom + 真实 React 18 加载 lib/client.js，
 * 验证模块加载器契约、槽位注册、按钮渲染、点击优化、撤销、以及规则面板。
 * 跑法：node tools/test-client.mjs
 */
import fs from 'node:fs'
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

// react-dom 的真实命名空间（含 createPortal）
const ReactDOM = fixtureRequire('react-dom')

const exportsOf = loaded[0].factory((id) => {
  if (id === 'react') return React
  if (id === 'react-dom') return ReactDOM
  throw new Error(`unexpected require: ${id}`)
})

check('导出 apply', typeof exportsOf.apply === 'function')
check('导出 inject = ["slots"]', Array.isArray(exportsOf.inject) && exportsOf.inject[0] === 'slots', JSON.stringify(exportsOf.inject))
check('导出 StarlightButton 组件', typeof exportsOf.StarlightButton === 'function')

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

let registered = null
const fakeShell = makeFakeShell('原始草稿')
const fakeCtx = {
  get(name) {
    if (name === 'sessions') {
      return {
        binding: (sessionId) => {
          if (sessionId !== 's1') return undefined
          return {
            session: {
              projections: {
                faceOf: (name) => ({
                  getSnapshot: () =>
                    name === 'modelSelection' ? { next: { provider: 'deepseek-account', model: 'deepseek-flash' } } : null,
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
  slots: {
    inject(name, callback) {
      const dispose = callback()
      return dispose
    },
    register(config, component) {
      registered = { config, component }
      return () => {
        registered = null
      }
    },
  },
}

exportsOf.apply(fakeCtx)
check('注册进 conversation.input.right', registered !== null && registered.config.name === 'conversation.input.right')
check('条目 id 为 dsh-starlight', registered.config.id === 'dsh-starlight', registered.config.id)
check('条目 order 为数字', typeof registered.config.order === 'number', String(registered.config.order))
check('注入了 inject 工厂', typeof registered.config.inject === 'function')

const starProps = registered.config.inject('s1')
check('拿到输入面板 facade', starProps.star.shell === fakeShell)
check('拿到会话当前模型', starProps.star.route.provider === 'deepseek-account' && starProps.star.route.model === 'deepseek-flash')

const missing = registered.config.inject('nope')
check('未知会话不抛异常', missing.star.shell === null && missing.star.route === null)

// 会话服务整个缺失时也必须安全退化
const bareCtx = {
  get: () => undefined,
  slots: fakeCtx.slots,
}
exportsOf.apply(bareCtx)
const bareStar = registered.config.inject('s1')
check('无 sessions 服务时安全退化', bareStar.star.shell === null)

// 只提供 shell(sessionId) 的 facade 也要能拿到（for() 缺失的宿主变体）
const shellOnlyCtx = {
  get: (name) =>
    name === 'sessions'
      ? {
          binding: () => ({
            session: { projections: { faceOf: () => ({ getSnapshot: () => null }) } },
            ctx: { get: () => ({ input: { shell: () => fakeShell } }) },
          }),
        }
      : undefined,
  slots: fakeCtx.slots,
}
exportsOf.apply(shellOnlyCtx)
const shellOnlyStar = registered.config.inject('s1')
check('仅 shell(sessionId) 的 facade 可用', shellOnlyStar.star.shell === fakeShell)
check('facade 缺失时模型路由为 null', shellOnlyStar.star.route === null)

// 恢复完整 ctx 供后续渲染
exportsOf.apply(fakeCtx)
const readyStar = registered.config.inject('s1')

/* ------------------------------------------------------------------ */
/* 3. 按钮渲染与一键优化                                              */
/* ------------------------------------------------------------------ */

console.log('\n[3] 按钮渲染与一键优化')

const fetchLog = []
let fetchReply = null
globalThis.fetch = async (url, init) => {
  fetchLog.push({ url: String(url), method: (init && init.method) || 'GET', body: init && init.body ? JSON.parse(init.body) : undefined })
  const payload = fetchReply(String(url), init)
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
fetchReply = (url) => {
  if (url.endsWith('/dsh-starlight/optimize')) {
    return { ok: true, text: '优化后的提示词', mode: 'model', model: 'deepseek-flash', elapsedMs: 1200 }
  }
  return { ok: false, error: { code: 'unexpected', message: `unexpected url ${url}` } }
}

await act(async () => {
  button.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
})
// 等 promise 链跑完
await act(async () => {
  await new Promise((resolve) => setTimeout(resolve, 0))
})

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
fetchReply = () => ({ ok: false, error: { code: 'llm-failed', message: '模型挂了' } })
const beforeFail = fetchLog.length
await act(async () => {
  container.querySelector('[data-dsh-starlight="button"]').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
})
await act(async () => {
  await new Promise((resolve) => setTimeout(resolve, 0))
})
check('失败时仍发出请求', fetchLog.length > beforeFail)
check('失败不改草稿', fakeShell.draft === '再来一次', fakeShell.draft)
check('失败进入 error 态', container.querySelector('[data-dsh-starlight="button"]').getAttribute('data-state') === 'error')
check('失败弹出错误提示', /模型挂了/.test(dom.window.document.querySelector('.dshsl-toast')?.textContent || ''))

/* ------------------------------------------------------------------ */
/* 4. 规则面板                                                        */
/* ------------------------------------------------------------------ */

console.log('\n[4] 规则面板')

const manifestPayload = {
  ok: true,
  version: '0.1.0',
  configFile: 'C:/fake/starlight-prompt.json',
  llmAvailable: true,
  rules: [
    { id: 'goal', group: 'base', title: { zh: '明确目标', en: 'State the goal' }, note: { zh: '开头一句话', en: 'One line' } },
    { id: 'structure', group: 'base', title: { zh: '结构化排版', en: 'Structure' }, note: { zh: '标题与列表', en: 'Headings' } },
  ],
  styles: [
    { id: 'auto', label: { zh: '自动', en: 'Auto' }, note: { zh: '自动', en: 'Auto' } },
    { id: 'concise', label: { zh: '精简', en: 'Concise' }, note: { zh: '短', en: 'Short' } },
  ],
  locales: [{ id: 'auto', label: { zh: '跟随原文', en: 'Follow' }, note: { zh: '', en: '' } }],
  depths: [{ id: 'balanced', label: { zh: '均衡', en: 'Balanced' }, note: { zh: '', en: '' } }],
  config: { style: 'auto', locale: 'auto', depth: 'balanced', enabled: true, disabledRules: [], customRules: [] },
}

let savedConfigRequest = null
globalThis.fetch = async (url, init) => {
  fetchLog.push({ url: String(url), method: (init && init.method) || 'GET', body: init && init.body ? JSON.parse(init.body) : undefined })
  const target = String(url)
  if (target.endsWith('/manifest')) return { ok: true, json: async () => manifestPayload }
  if (target.endsWith('/config')) {
    const sent = JSON.parse(init.body)
    savedConfigRequest = sent
    return {
      ok: true,
      json: async () => ({ ...manifestPayload, config: { ...manifestPayload.config, ...sent } }),
    }
  }
  return { ok: true, json: async () => ({ ok: false, error: { code: 'unexpected', message: target } }) }
}

await act(async () => {
  container
    .querySelector('[data-dsh-starlight="button"]')
    .dispatchEvent(new dom.window.MouseEvent('contextmenu', { bubbles: true, cancelable: true }))
})
await act(async () => {
  await new Promise((resolve) => setTimeout(resolve, 0))
})

const panel = dom.window.document.querySelector('.dshsl-panel')
check('右键打开面板', panel !== null)
check('面板标题正确', /提示词优化规则|Prompt rules/.test(panel.textContent), panel.querySelector('.dshsl-title')?.textContent)
const checkboxes = panel.querySelectorAll('.dshsl-rule input[type=checkbox]')
check('渲染出规则勾选框', checkboxes.length === 3 /* 2 条规则 + 启用开关 */, String(checkboxes.length))
check('规则默认勾选', checkboxes[0].checked === true && checkboxes[1].checked === true)

// 取消勾选第一条规则后保存（用真实 click 让 React 的 onChange 生效）
await act(async () => {
  panel.querySelector('.dshsl-rule input[type=checkbox]').click()
})
check('取消勾选后进入停用集合', /.dshsl-rule input/.test('.dshsl-rule input') && panel.querySelector('.dshsl-rule input[type=checkbox]').checked === false)
const saveButton = Array.from(panel.querySelectorAll('.dshsl-btn2')).find((node) => /保存|Save/.test(node.textContent))
check('存在保存按钮', saveButton !== undefined)
await act(async () => {
  saveButton.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
})
await act(async () => {
  await new Promise((resolve) => setTimeout(resolve, 0))
})
check('保存请求已发出', savedConfigRequest !== null)
check('保存内容只含被取消的规则', savedConfigRequest && JSON.stringify(savedConfigRequest.disabledRules) === '["goal"]', JSON.stringify(savedConfigRequest))

// Esc 关闭
await act(async () => {
  dom.window.document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
})
check('Esc 关闭面板', dom.window.document.querySelector('.dshsl-panel') === null)

/* ------------------------------------------------------------------ */

console.log(`\n结果：${passes} 通过 / ${failures} 失败`)
await act(async () => {
  root.unmount()
})
dom.window.close()
process.exit(failures === 0 ? 0 : 1)

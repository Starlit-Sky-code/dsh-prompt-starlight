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

console.log('\n[4] 按钮右键浮层')

const manifestPayload = () => ({
  ok: true,
  version: '0.2.0',
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
  config: {
    enabled: true,
    style: 'auto',
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
check('右键打开面板', panel !== null)
check('面板标题正确', /提示词优化规则|prompt rules/i.test(panel.textContent), panel.querySelector('.dshsl-title')?.textContent)
const checkboxes = panel.querySelectorAll('.dshsl-rule input[type=checkbox]')
check('渲染出规则勾选框', checkboxes.length === 3 /* 2 条规则 + 启用开关 */, String(checkboxes.length))
check('规则默认勾选', checkboxes[0].checked === true && checkboxes[1].checked === true)

await act(async () => {
  panel.querySelector('.dshsl-rule input[type=checkbox]').click()
})
check('取消勾选后立即反映到界面', panel.querySelector('.dshsl-rule input[type=checkbox]').checked === false)

const saveButton = Array.from(panel.querySelectorAll('.dshsl-btn2')).find((node) => /保存|Save/.test(node.textContent))
check('存在保存按钮', saveButton !== undefined)
await act(async () => {
  saveButton.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
})
await tick()
check('保存请求已发出', savedConfigRequest !== null)
check('保存内容只含被取消的规则', savedConfigRequest && JSON.stringify(savedConfigRequest.disabledRules) === '["goal"]', JSON.stringify(savedConfigRequest))

await act(async () => {
  dom.window.document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
})
check('Esc 关闭面板', dom.window.document.querySelector('.dshsl-panel') === null)

/* ------------------------------------------------------------------ */
/* 5. 独立设置页                                                      */
/* ------------------------------------------------------------------ */

console.log('\n[5] 独立设置页')

const pageContainer = dom.window.document.createElement('div')
dom.window.document.body.appendChild(pageContainer)
const pageRoot = ReactDOMClient.createRoot(pageContainer)

let pageSave = null
fetchImpl = (url, body) => {
  if (url.endsWith('/manifest')) return manifestPayload()
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
check('设置页显示配置文件路径', pageContainer.textContent.includes('starlight-prompt.json'))
check('设置页含风格档位', pageContainer.querySelectorAll('.dshsl-seg').length === 3, String(pageContainer.querySelectorAll('.dshsl-seg').length))
check('设置页含规则勾选框', pageContainer.querySelectorAll('.dshsl-rule input[type=checkbox]').length === 3)
// 注意：设置页的「启用开关」也是一个 .dshsl-rule，所以规则列表要用 .dshsl-rules 限定
const pageRuleInputs = () => Array.from(pageContainer.querySelectorAll('.dshsl-rules input[type=checkbox]'))
check('设置页规则列表含 2 条规则', pageRuleInputs().length === 2, String(pageRuleInputs().length))
check('设置页含高级字段', pageContainer.querySelectorAll('.dshsl-input').length === 5, String(pageContainer.querySelectorAll('.dshsl-input').length))
check('设置页含 provider 输入框', /provider/i.test(pageContainer.textContent) === true)

const pageButtons = () => Array.from(pageContainer.querySelectorAll('.dshsl-page-foot .dshsl-btn2'))
const pageSaveButton = () => pageButtons().find((node) => /保存|Save/.test(node.textContent))
const pageStatus = () => pageContainer.querySelector('.dshsl-status')

check('初始状态「与磁盘一致」', /磁盘|disk/i.test(pageStatus().textContent), pageStatus().textContent)
check('未修改时保存按钮禁用', pageSaveButton().disabled === true)

// 改一条规则 → 变脏 → 保存可用
await act(async () => {
  pageRuleInputs()[0].click()
})
check('修改后状态变「未保存」', pageStatus().getAttribute('data-dirty') === '1', pageStatus().textContent)
check('修改后保存按钮可用', pageSaveButton().disabled === false)
check('规则勾选已被取消', pageRuleInputs()[0].checked === false)

// 再改高级字段里的 temperature
const numberInputs = Array.from(pageContainer.querySelectorAll('.dshsl-input[type=number]'))
check('有三个数字高级字段', numberInputs.length === 3, String(numberInputs.length))
await act(async () => {
  const temperature = numberInputs[1]
  const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set
  setter.call(temperature, '0.6')
  temperature.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
})
await tick()

await act(async () => {
  pageSaveButton().dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
})
await tick()

check('设置页发出保存请求', pageSave !== null)
check('保存含被停用的规则', pageSave && JSON.stringify(pageSave.disabledRules) === '["goal"]', JSON.stringify(pageSave && pageSave.disabledRules))
check('保存含高级字段', pageSave && pageSave.maxTokens === 1600 && pageSave.timeoutMs === 60000, JSON.stringify(pageSave))
check('保存含 provider/model 字段', pageSave && 'provider' in pageSave && 'model' in pageSave, JSON.stringify(Object.keys(pageSave || {})))
check('保存含改后的温度', pageSave && pageSave.temperature === 0.6, JSON.stringify(pageSave && pageSave.temperature))
check('保存后状态回到「已保存」', pageStatus().getAttribute('data-dirty') === '0', pageStatus().textContent)

// 全关 / 全开
await act(async () => {
  const allOff = Array.from(pageContainer.querySelectorAll('.dshsl-btn3')).find((node) => /全关|All off/.test(node.textContent))
  allOff.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
})
const checkedAfterAllOff = pageRuleInputs()
check('「全关」清空所有规则勾选', checkedAfterAllOff.every((input) => input.checked === false))

await act(async () => {
  const allOn = Array.from(pageContainer.querySelectorAll('.dshsl-btn3')).find((node) => /全开|All on/.test(node.textContent))
  allOn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
})
const checkedAfterAllOn = pageRuleInputs()
check('「全开」恢复所有规则勾选', checkedAfterAllOn.every((input) => input.checked === true))

/* 宿主不可达时的降级 */
fetchImpl = () => ({ ok: false, error: { code: 'network', message: '宿主无响应' } })
const failContainer = dom.window.document.createElement('div')
dom.window.document.body.appendChild(failContainer)
const failRoot = ReactDOMClient.createRoot(failContainer)
await act(async () => {
  failRoot.render(React.createElement(SettingsSection, {}))
})
await tick()
check('宿主不可达时设置页给出提示', /宿主无响应|宿主半部没有响应|host half/i.test(failContainer.textContent), failContainer.textContent.slice(0, 120))
check('宿主不可达时提供重试按钮', Array.from(failContainer.querySelectorAll('button')).some((node) => /重试|Retry/.test(node.textContent)))

/* ------------------------------------------------------------------ */

console.log(`\n结果：${passes} 通过 / ${failures} 失败`)
await act(async () => {
  root.unmount()
  pageRoot.unmount()
  failRoot.unmount()
})
dom.window.close()
process.exit(failures === 0 ? 0 : 1)

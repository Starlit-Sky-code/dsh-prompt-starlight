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
 * Host 半部集成测试（无 DSH 依赖）：用假 webServer / 假 llm 驱动真实路由处理函数。
 * 跑法：node tools/test-host.mjs
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'starlight-test-'))
process.env.STARLIGHT_CONFIG_FILE = path.join(tempDir, 'starlight-prompt.json')
process.env.DSH_HOME = tempDir

const { default: plugin } = await import('../lib/index.js')
const rules = await import('../lib/rules.js')

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
/* 假宿主                                                              */
/* ------------------------------------------------------------------ */

const routes = []

function makeCtx(overrides = {}) {
  const services = {
    llm: {
      listProviders: () => ['deepseek-account'],
      listModels: async () => [{ provider: 'deepseek-account', id: 'deepseek-flash', name: 'Flash' }],
      stream(options) {
        const text = harness.llmReply
        const fail = harness.llmFail
        return (async function* () {
          if (fail) throw new Error(fail)
          // 故意把答案切成多片，验证逐片拼接
          for (let i = 0; i < text.length; i += 7) {
            yield { type: 'text-delta', index: 0, text: text.slice(i, i + 7) }
          }
          yield { type: 'finish', kind: 'stop', usage: { outputTokens: 42 } }
        })()
      },
    },
    agentDefaultModel: { currentSelection: () => ({ provider: 'deepseek-account', model: 'deepseek-flash' }) },
    connection: { requestRejection: () => null },
    ...overrides,
  }
  return {
    get: (name) => services[name],
    effect: () => () => {},
  }
}

const harness = { llmReply: '', llmFail: '' }

/**
 * 用给定服务起一份插件实例，路由表清空后重新收集。
 * @param {object} [overrides] 覆盖 makeCtx 的默认服务
 * @returns 插件上下文
 */
function boot(overrides) {
  routes.length = 0
  const ctx = makeCtx(overrides)
  plugin.apply({
    inject: (deps, callback) => {
      for (const dep of deps) {
        if (dep !== 'webServer' && ctx.get(dep) === undefined) throw new Error(`missing service ${dep}`)
      }
      callback({
        get: (name) =>
          name === 'webServer'
            ? {
                register(route) {
                  routes.push(route)
                  return () => {
                    const index = routes.indexOf(route)
                    if (index >= 0) routes.splice(index, 1)
                  }
                },
              }
            : ctx.get(name),
        effect: () => () => {},
      })
    },
  })
  return ctx
}

function fakeRequest({ method = 'GET', headers = {}, body, query = '' } = {}) {
  const payload = body === undefined ? null : Buffer.from(JSON.stringify(body))
  return {
    method,
    url: undefined,
    headers: { host: '127.0.0.1:19387', ...headers },
    ...(query === '' ? {} : { url: query }),
    async *[Symbol.asyncIterator]() {
      if (payload !== null) yield payload
    },
  }
}

function fakeResponse() {
  const record = { status: 0, headers: null, body: '' }
  return {
    record,
    writeHead(status, headers) {
      record.status = status
      record.headers = headers
    },
    end(chunk) {
      if (chunk !== undefined) record.body += String(chunk)
    },
  }
}

async function call({ kind = 'exact', path: routePath, ...requestInit }) {
  const entry = routes.find((item) => item.kind === kind && item.path === routePath)
  if (entry === undefined) throw new Error(`route not registered: ${routePath}`)
  const req = fakeRequest(requestInit)
  const res = fakeResponse()
  await entry.handler(req, res)
  let json = null
  try {
    json = JSON.parse(res.record.body)
  } catch {}
  return { status: res.record.status, json, raw: res.record.body }
}

/* ------------------------------------------------------------------ */
/* 1. 插件形状                                                         */
/* ------------------------------------------------------------------ */

console.log('\n[1] 插件形状')
const ctx = boot()
check('name 为 dsh-prompt-starlight', plugin.name === 'dsh-prompt-starlight', plugin.name)
check('注册了 8 条路由', routes.length === 8, String(routes.length))
check(
  '全部为 exact 路由且前缀正确',
  routes.every((route) => route.kind === 'exact' && route.path.startsWith('/dsh-starlight/')),
  routes.map((route) => route.path).join(','),
)
check(
  '包含模型目录路由',
  routes.some((route) => route.path === '/dsh-starlight/models'),
  routes.map((route) => route.path).join(','),
)
check(
  '包含图标路由',
  routes.some((route) => route.path === '/dsh-starlight/icon.png'),
  routes.map((route) => route.path).join(','),
)
check(
  '包含技能目录路由',
  routes.some((route) => route.path === '/dsh-starlight/skills'),
  routes.map((route) => route.path).join(','),
)

/* ------------------------------------------------------------------ */
/* 2. 信任栅栏                                                         */
/* ------------------------------------------------------------------ */

console.log('\n[2] 信任栅栏')
const crossSite = await call({ path: '/dsh-starlight/manifest', headers: { 'sec-fetch-site': 'cross-site' } })
check('cross-site 被拒 403', crossSite.status === 403, String(crossSite.status))

const badOrigin = await call({ path: '/dsh-starlight/manifest', headers: { origin: 'http://evil.example' } })
check('异源 Origin 被拒 403', badOrigin.status === 403, String(badOrigin.status))

const sameOrigin = await call({ path: '/dsh-starlight/manifest', headers: { origin: 'http://127.0.0.1:19387' } })
check('同源 Origin 放行 200', sameOrigin.status === 200, String(sameOrigin.status))

const remoteHost = await call({ path: '/dsh-starlight/manifest', headers: { host: '192.168.1.9:19387' } })
check('非回环 Host 被拒 403', remoteHost.status === 403, String(remoteHost.status))

const writeFromRemote = await call({
  path: '/dsh-starlight/config',
  method: 'POST',
  headers: { host: '192.168.1.9:19387', 'sec-fetch-site': 'same-origin' },
  body: { style: 'concise' },
})
check('非本机写请求被拒 403', writeFromRemote.status === 403, String(writeFromRemote.status))

/* ------------------------------------------------------------------ */
/* 3. manifest / health                                                */
/* ------------------------------------------------------------------ */

console.log('\n[3] 目录与探活')
const manifest = await call({ path: '/dsh-starlight/manifest' })
check('manifest 200', manifest.status === 200, String(manifest.status))
check('规则数为 11', manifest.json.rules.length === 11, String(manifest.json.rules.length))
check('强度档位为 5', manifest.json.depths.length === 5, String(manifest.json.depths.length))
check('详细度档位为 3', manifest.json.verbosities.length === 3, String(manifest.json.verbosities.length))
check('场景档位为 4', manifest.json.lenses.length === 4, String(manifest.json.lenses.length))
check('不再下发旧 styles 字段', manifest.json.styles === undefined)
check('llmAvailable 为 true', manifest.json.llmAvailable === true)
check('默认 verbosity=standard', manifest.json.config.verbosity === 'standard', manifest.json.config.verbosity)
check('默认 lens=auto', manifest.json.config.lens === 'auto', manifest.json.config.lens)
check('规则条目带双语标题', manifest.json.rules[0].title.zh !== undefined && manifest.json.rules[0].title.en !== undefined)

const health = await call({ path: '/dsh-starlight/health' })
check('health 200 且报出 provider', health.status === 200 && health.json.providers[0] === 'deepseek-account')
check('health 报出规则分组可用', Array.isArray(manifest.json.ruleGroups) && manifest.json.ruleGroups.length === 3, String(manifest.json.ruleGroups?.length))
check('health 未固定模型时 modelOverride 为 null', health.json.modelOverride === null, JSON.stringify(health.json.modelOverride))

/* —— 模型目录 —— */
const models = await call({ path: '/dsh-starlight/models' })
check('模型目录 200', models.status === 200, String(models.status))
check('目录含适配器公布的模型', models.json.models.length === 1, JSON.stringify(models.json.models))
check('目录带友好名', models.json.models[0].name === 'Flash', models.json.models[0].name)
check('目录带默认路由', models.json.default && models.json.default.provider === 'deepseek-account', JSON.stringify(models.json.default))
check('目录无错误', Array.isArray(models.json.errors) && models.json.errors.length === 0, JSON.stringify(models.json.errors))
check('首次查询未命中缓存', models.json.cached === false, String(models.json.cached))

const modelsAgain = await call({ path: '/dsh-starlight/models' })
check('二次查询命中缓存', modelsAgain.json.cached === true, String(modelsAgain.json.cached))
const modelsRefresh = await call({ path: '/dsh-starlight/models', query: '/dsh-starlight/models?refresh=1' })
check('?refresh=1 绕过缓存', modelsRefresh.json.cached === false, String(modelsRefresh.json.cached))

// provider 抛错时不能整体失败，只记 errors
boot({
  llm: {
    listProviders: () => ['deepseek-account', 'broken-provider'],
    listModels: async (provider) => {
      if (provider === 'broken-provider') throw new Error('provider 挂了')
      return [{ provider, id: 'deepseek-flash', name: 'Flash' }]
    },
    stream: () => {
      throw new Error('unused')
    },
  },
})
const partial = await call({ path: '/dsh-starlight/models', query: '/dsh-starlight/models?refresh=1' })
check('单个 provider 失败不影响整体', partial.status === 200 && partial.json.models.length === 1, JSON.stringify(partial.json.models))
check('失败 provider 记入 errors', partial.json.errors.length === 1 && partial.json.errors[0].provider === 'broken-provider', JSON.stringify(partial.json.errors))
// 恢复标准服务组合
boot()

/* ------------------------------------------------------------------ */
/* 4. config / reset                                                   */
/* ------------------------------------------------------------------ */

console.log('\n[4] 规则持久化')
const saved = await call({
  path: '/dsh-starlight/config',
  method: 'POST',
  body: { verbosity: 'detailed', lens: 'engineering', depth: 'rewrite', locale: 'zh', disabledRules: ['structure', 'bogus-id'], customRules: ['必须包含验收小节', '  ', '不要用"请确保"'] },
})
check('保存 200', saved.status === 200, String(saved.status))
check('verbosity 已保存', saved.json.config.verbosity === 'detailed', saved.json.config.verbosity)
check('lens 已保存', saved.json.config.lens === 'engineering', saved.json.config.lens)
check('强度 5 档可选 rewrite', saved.json.config.depth === 'rewrite', saved.json.config.depth)
check('未知规则 id 被丢弃', saved.json.config.disabledRules.length === 1, JSON.stringify(saved.json.config.disabledRules))
check('空白自定义规则被剔除', saved.json.config.customRules.length === 2, JSON.stringify(saved.json.config.customRules))

const onDisk = JSON.parse(fs.readFileSync(process.env.STARLIGHT_CONFIG_FILE, 'utf8'))
check('落盘文件含 updatedAt', typeof onDisk.updatedAt === 'string')
check('落盘文件含新字段', onDisk.verbosity === 'detailed' && onDisk.lens === 'engineering', JSON.stringify([onDisk.verbosity, onDisk.lens]))
check('落盘文件为合法 JSON 且换行结尾', fs.readFileSync(process.env.STARLIGHT_CONFIG_FILE, 'utf8').endsWith('\n'))

const reread = await call({ path: '/dsh-starlight/manifest' })
check('重新读取生效', reread.json.config.verbosity === 'detailed')

const reset = await call({ path: '/dsh-starlight/reset', method: 'POST', body: {} })
check('重置回默认', reset.json.config.verbosity === 'standard' && reset.json.config.lens === 'auto' && reset.json.config.customRules.length === 0)

// 损坏文件不应炸掉
fs.writeFileSync(process.env.STARLIGHT_CONFIG_FILE, '{ this is not json')
const broken = await call({ path: '/dsh-starlight/manifest' })
check('损坏配置回落默认值', broken.status === 200 && broken.json.config.verbosity === 'standard', String(broken.status))

/* ------------------------------------------------------------------ */
/* 5. optimize                                                         */
/* ------------------------------------------------------------------ */

console.log('\n[5] 一键优化')
fs.rmSync(process.env.STARLIGHT_CONFIG_FILE, { force: true })

const empty = await call({ path: '/dsh-starlight/optimize', method: 'POST', body: { text: '   ' } })
check('空草稿 400', empty.status === 400, String(empty.status))
check('空草稿错误码', empty.json.error.code === 'empty-draft', empty.json.error.code)

const tooBig = await call({ path: '/dsh-starlight/optimize', method: 'POST', body: { text: 'x'.repeat(24001) } })
check('超长草稿 400', tooBig.status === 400 && tooBig.json.error.code === 'input-too-large')

harness.llmReply = '```text\n# 目标\n让模型输出一个二分查找实现。\n\n# 要求\n- 只改必要部分\n```'
const optimized = await call({
  path: '/dsh-starlight/optimize',
  method: 'POST',
  body: { text: '帮我写个二分查找', route: { provider: 'deepseek-account', model: 'deepseek-flash' } },
})
check('优化 200', optimized.status === 200, String(optimized.status))
check('mode=model', optimized.json.mode === 'model', optimized.json.mode)
check('代码围栏被剥掉', !optimized.json.text.startsWith('```'), optimized.json.text.slice(0, 20))
check('正文保留', optimized.json.text.includes('# 目标'), optimized.json.text.slice(0, 60))
check('回传模型名', optimized.json.model === 'deepseek-flash', optimized.json.model)
check('优化响应带模型友好名', optimized.json.modelName === 'Flash', String(optimized.json.modelName))
check('回传耗时', typeof optimized.json.elapsedMs === 'number')

// 固定模型后 health 要反映出来
await call({ path: '/dsh-starlight/config', method: 'POST', body: { provider: 'openrouter', model: 'anthropic/claude' } })
const healthFixed = await call({ path: '/dsh-starlight/health' })
check(
  'health 报出固定的模型覆盖',
  healthFixed.json.modelOverride && healthFixed.json.modelOverride.provider === 'openrouter',
  JSON.stringify(healthFixed.json.modelOverride),
)
await call({ path: '/dsh-starlight/reset', method: 'POST', body: {} })

harness.llmReply = ''
harness.llmFail = 'network down'
const degraded = await call({ path: '/dsh-starlight/optimize', method: 'POST', body: { text: '你好  \n\n\n\n世界  ' } })
check('模型失败时降级 200', degraded.status === 200, String(degraded.status))
check('降级标记', degraded.json.mode === 'local' && degraded.json.degraded === true, JSON.stringify(degraded.json).slice(0, 120))
check('降级做了本地整理', degraded.json.text === '你好\n\n世界', JSON.stringify(degraded.json.text))
check('降级带说明', String(degraded.json.note).includes('network down'), String(degraded.json.note))
harness.llmFail = ''

/* ------------------------------------------------------------------ */
/* 6. 提示词构造                                                       */
/* ------------------------------------------------------------------ */

console.log('\n[6] 系统提示构造')
const cfg = rules.normalizeConfig(rules.DEFAULTS)
const system = rules.buildSystemPrompt(cfg)
check('含输出契约', system.includes('Output contract'))
check('含全部 11 条规则正文', rules.RULE_CATALOG.every((rule) => system.includes(rule.body.en)))
check('含不可协商护栏', system.includes('Never add, drop or replace a requirement'))
check('默认风格=自动', system.includes('Decide the best prompt shape'))

const withCustom = rules.buildSystemPrompt(cfg, { customRules: ['必须引用行号'] })
check('自定义规则进提示', withCustom.includes('必须引用行号'))
check('自定义规则段优先级说明', withCustom.includes('Additional user rules'))

const offCfg = rules.normalizeConfig({ ...rules.DEFAULTS, disabledRules: ['structure', 'acceptance'] })
const systemOff = rules.buildSystemPrompt(offCfg)
check('停用规则后正文消失', !systemOff.includes(rules.RULE_CATALOG.find((r) => r.id === 'structure').body.en))
check('未停用规则仍在', systemOff.includes(rules.RULE_CATALOG.find((r) => r.id === 'goal').body.en))

const userContent = rules.buildUserContent('包含 "JSON" 和 ``` 围栏的草稿')
check('用户消息用 JSON 框住草稿', userContent.includes('DRAFT_JSON:'))
check('草稿被 JSON 转义', userContent.includes('\\"JSON\\"'), userContent.split('\n').pop())

console.log('\n[7] 输出清洗')
check('剥整体围栏', rules.sanitizeOutput('```md\nA\nB\n```') === 'A\nB', JSON.stringify(rules.sanitizeOutput('```md\nA\nB\n```')))
check('剥中文前言', rules.sanitizeOutput('以下是优化后的提示词：\n\n正文') === '正文', JSON.stringify(rules.sanitizeOutput('以下是优化后的提示词：\n\n正文')))
check('剥「优化后的提示词：」', rules.sanitizeOutput('优化后的提示词：\n\n正文') === '正文', JSON.stringify(rules.sanitizeOutput('优化后的提示词：\n\n正文')))
check('剥英文前言', rules.sanitizeOutput("Here's the improved prompt:\n\nBody") === 'Body', JSON.stringify(rules.sanitizeOutput("Here's the improved prompt:\n\nBody")))
check('剥 "Sure" 开头前言', rules.sanitizeOutput('Sure! Here is the optimized prompt:\n\nBody') === 'Body', JSON.stringify(rules.sanitizeOutput('Sure! Here is the optimized prompt:\n\nBody')))
check('剥尾部寒暄', rules.sanitizeOutput('正文\n\n希望这有帮助！') === '正文', JSON.stringify(rules.sanitizeOutput('正文\n\n希望这有帮助！')))
check(
  '不误删用户自己的「这是要求：」标题',
  rules.sanitizeOutput('这是要求：\n\n- 输出 JSON') === '这是要求：\n\n- 输出 JSON',
  JSON.stringify(rules.sanitizeOutput('这是要求：\n\n- 输出 JSON')),
)
check(
  '不误删不带感叹号的尾句',
  rules.sanitizeOutput('正文\n\n如需更多示例请在草稿里说明。') === '正文\n\n如需更多示例请在草稿里说明。',
)
check('保留内部代码块', rules.sanitizeOutput('写一个函数：\n\n```js\nconst a = 1\n```') === '写一个函数：\n\n```js\nconst a = 1\n```')
check('空输入返回空', rules.sanitizeOutput('   ') === '')

console.log('\n[8] 本地兜底整理')
check('去行尾空白', rules.tidyLocally('a  \nb\t') === 'a\nb', JSON.stringify(rules.tidyLocally('a  \nb\t')))
check('压缩空行', rules.tidyLocally('a\n\n\n\nb') === 'a\n\nb')
check('统一列表符号', rules.tidyLocally('• 一\n· 二') === '- 一\n- 二', JSON.stringify(rules.tidyLocally('• 一\n· 二')))
check('补平奇数围栏', rules.tidyLocally('```js\nx').endsWith('```'))

console.log('\n[9] maxTokens 缩放')
check('短草稿有下限', rules.scaleMaxTokens('短', 1600) >= 512)
check('不超过配置上限', rules.scaleMaxTokens('x'.repeat(20000), 2000) <= 2000)

/* ------------------------------------------------------------------ */

console.log('\n[10] 只读技能目录（宿主代理）')

// 上游用 stub 的 fetch 顶替：断言的是我们这个路由的行为，不是人家的服务
const realFetch = globalThis.fetch
const catalogCalls = []
function stubCatalog(handler) {
  globalThis.fetch = async (url) => {
    catalogCalls.push(String(url))
    return handler(String(url))
  }
}
function jsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    text: async () => JSON.stringify(payload),
    body: { cancel: async () => {} },
  }
}

const CLAWHUB_BODY = {
  results: [
    {
      id: 'clawhub:abc',
      displayName: 'prompt-harness',
      summary: '把草稿改写成可执行提示词',
      downloads: 4321,
      official: true,
      canonicalUrl: '/someone/skills/prompt-harness',
      install: { kind: 'clawhub', reference: 'someone/prompt-harness' },
    },
    // 引用非法 → 整条丢弃
    { id: 'bad', displayName: 'bad', install: { reference: '../../etc/passwd' } },
    // 没有 install.reference → 丢弃
    { id: 'noinstall', displayName: 'x' },
    // 与第一条同引用 → 去重
    { id: 'dup', displayName: 'dup', install: { reference: 'someone/prompt-harness' } },
  ],
}

stubCatalog(() => jsonResponse(CLAWHUB_BODY))
const skillsOk = await call({ path: '/dsh-starlight/skills', query: '?q=prompt' })
check('技能目录 200', skillsOk.status === 200, String(skillsOk.status))
check('返回条目已归一化', skillsOk.json?.items?.length === 1, JSON.stringify(skillsOk.json?.items?.length))
const firstItem = skillsOk.json?.items?.[0] ?? {}
check('保留引用与作者', firstItem.reference === 'someone/prompt-harness' && firstItem.author === 'someone', JSON.stringify(firstItem.reference))
check('保留下载数与官方标', firstItem.downloads === 4321 && firstItem.official === true)
check('拼出可点链接', firstItem.url === 'https://clawhub.ai/someone/skills/prompt-harness', String(firstItem.url))
check('丢弃非法/缺失/重复的引用', skillsOk.json?.items?.length === 1)
check('查询词会被编码进上游 URL', catalogCalls[0]?.includes('q=prompt'), String(catalogCalls[0]))

// 缓存：同一查询不再打上游
const before = catalogCalls.length
const skillsCached = await call({ path: '/dsh-starlight/skills', query: '?q=prompt' })
check('第二次命中缓存', skillsCached.json?.cached === true, String(skillsCached.json?.cached))
check('缓存命中时不请求上游', catalogCalls.length === before, String(catalogCalls.length - before))

// 大小写不同视为同一查询
await call({ path: '/dsh-starlight/skills', query: '?q=PROMPT' })
check('查询词大小写归一后共用缓存', catalogCalls.length === before, String(catalogCalls.length - before))

const noQuery = await call({ path: '/dsh-starlight/skills' })
check('缺搜索词 400', noQuery.status === 400 && noQuery.json?.error?.code === 'catalog_query', String(noQuery.status))

const longQuery = await call({ path: '/dsh-starlight/skills', query: `?q=${'x'.repeat(120)}` })
check('搜索词超长 400', longQuery.status === 400 && longQuery.json?.error?.code === 'catalog_query', String(longQuery.status))

const badSource = await call({ path: '/dsh-starlight/skills', query: '?q=prompt&source=evil' })
check('未知目录源 400', badSource.status === 400 && badSource.json?.error?.code === 'catalog_source', String(badSource.status))

stubCatalog(() => jsonResponse({ error: 'boom' }, 503))
const upstreamDown = await call({ path: '/dsh-starlight/skills', query: '?q=fresh-1' })
check('上游 5xx → 502', upstreamDown.status === 502 && upstreamDown.json?.error?.code === 'catalog_upstream', String(upstreamDown.status))

stubCatalog(() => ({ ok: true, status: 200, headers: { get: () => null }, text: async () => 'not json', body: { cancel: async () => {} } }))
const badJson = await call({ path: '/dsh-starlight/skills', query: '?q=fresh-2' })
check('上游返回非 JSON → 502', badJson.status === 502 && badJson.json?.error?.code === 'catalog_response', String(badJson.status))

stubCatalog(() => ({ ok: true, status: 200, headers: { get: () => '999999999' }, text: async () => '{}', body: { cancel: async () => {} } }))
const tooLarge = await call({ path: '/dsh-starlight/skills', query: '?q=fresh-3' })
check('声明体积过大 → 502', tooLarge.status === 502 && tooLarge.json?.error?.code === 'catalog_response', String(tooLarge.status))

stubCatalog(() => {
  const error = new Error('timed out')
  error.name = 'TimeoutError'
  throw error
})
const timedOut = await call({ path: '/dsh-starlight/skills', query: '?q=fresh-4' })
check('上游超时 → 504', timedOut.status === 504 && timedOut.json?.error?.code === 'catalog_timeout', String(timedOut.status))

globalThis.fetch = realFetch

console.log(`\n结果：${passes} 通过 / ${failures} 失败`)
fs.rmSync(tempDir, { recursive: true, force: true })
process.exit(failures === 0 ? 0 : 1)
fs.rmSync(tempDir, { recursive: true, force: true })
process.exit(failures === 0 ? 0 : 1)

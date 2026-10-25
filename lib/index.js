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
 * 星芒 · 提示词一键优化 —— Host 半部。
 *
 * 职责只有三件事，全部通过明确的 HTTP 路由暴露给浏览器半部：
 *   1. 下发规则目录与当前配置（面板渲染用）；
 *   2. 保存/重置用户自定义规则（写 $DSH_HOME/starlight-prompt.json）；
 *   3. 把草稿交给模型改写（旁路调用 ctx.llm.stream，不进会话日志、不产生对话轮次）。
 *
 * 之所以放在 Host 而不是浏览器里直接打模型：
 *   - 模型凭据只在宿主侧（ctx.credentials / 适配器内部），浏览器拿不到也不该拿；
 *   - 规则目录与持久化文件本来就在宿主侧，放在同侧可以只有一个事实来源；
 *   - ctx.llm.stream 是 DSH 唯一受支持的模型调用入口，浏览器侧没有这个服务。
 *
 * 安全边界：所有路由都要求「回环 Host + 同源 + 非跨站」，写请求额外要求本机。
 * 这与 DSH 自己的信任栅栏同向；栅栏存在时再委托它一次（双重校验，取更严格的结果）。
 */

import {
  activeRules,
  buildSystemPrompt,
  buildUserContent,
  catalogForClient,
  sanitizeOutput,
  scaleMaxTokens,
  tidyLocally,
} from './rules.js'
import { CONFIG_FILE, readConfig, resetConfig, writeConfig } from './config.js'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** 路由前缀：与包名一致，避免与其它插件撞路。 */
const ROUTE = '/dsh-starlight'
/** 请求体上限：草稿再长也不该超过这个量级。 */
const MAX_BODY_BYTES = 512 * 1024
/** 单次优化的输入上限（字符），超出直接拒绝而不是悄悄截断。 */
const MAX_INPUT_CHARS = 24000
/** 一次请求最多尝试的模型路由数量（主路由 + 少量兜底）。 */
const MAX_ROUTE_ATTEMPTS = 3
/** 包根目录：用于给界面提供图标（浏览器半部不能读本地文件，只能走路由）。 */
const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
/** 插件界面用的图标（96×96，十几个 KB），首次请求后按 mtime 缓存。 */
const ICON_CANDIDATES = [
  path.join(PACKAGE_ROOT, 'assets', 'icon-ui.png'),
  path.join(PACKAGE_ROOT, 'assets', 'icon.png'),
]
let iconCache = null // { bytes, mtimeMs }

/** 读图标；改动后按 mtime 自动失效。找不到返回 null，由路由回 404。 */
function loadIcon() {
  for (const candidate of ICON_CANDIDATES) {
    try {
      const stat = fs.statSync(candidate)
      if (iconCache !== null && iconCache.mtimeMs === stat.mtimeMs) return iconCache.bytes
      const bytes = fs.readFileSync(candidate)
      iconCache = { bytes, mtimeMs: stat.mtimeMs }
      return bytes
    } catch {}
  }
  return null
}

/* ------------------------------------------------------------------ *
 * 信任栅栏
 * ------------------------------------------------------------------ */

/** 只认回环：localhost / *.localhost / 127.0.0.0/8 / ::1。 */
function isLoopbackHostname(hostname) {
  const host = String(hostname || '').toLowerCase().replace(/^\[/, '').replace(/\]$/, '')
  if (host === '') return false
  if (host === 'localhost' || host.endsWith('.localhost')) return true
  if (host === '::1') return true
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host)
  if (match === null) return false
  if (Number(match[1]) !== 127) return false
  return [match[2], match[3], match[4]].every((part) => Number(part) <= 255)
}

/** 显式信任列表（反代/局域网部署时用，逗号分隔，可带端口）。 */
function trustedAuthorities() {
  return String(process.env.STARLIGHT_TRUSTED_HOSTS || '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
}

/**
 * @returns {null|number} null 表示放行，否则是应当返回的状态码
 */
function rejectionOf(req, { requireLocal = false } = {}) {
  const headers = (req && req.headers) || {}
  let authority
  let hostname
  try {
    const url = new URL(`http://${String(headers.host || '')}`)
    authority = url.host.toLowerCase()
    hostname = url.hostname.toLowerCase()
  } catch {
    return 403
  }
  const local = isLoopbackHostname(hostname)
  if (requireLocal && !local) return 403
  if (!local) {
    const listed = trustedAuthorities().some((entry) => (entry.includes(':') ? entry === authority : entry === hostname))
    if (!listed) return 403
  }
  // 跨站标记直接拒绝（任何情况都不放行）。
  if (String(headers['sec-fetch-site'] || '').toLowerCase() === 'cross-site') return 403
  // 带 Origin 时必须与 Host 同源。
  const origin = headers.origin
  if (typeof origin === 'string' && origin !== '' && origin !== 'null') {
    let originAuthority
    try {
      originAuthority = new URL(origin).host.toLowerCase()
    } catch {
      return 403
    }
    if (originAuthority !== authority) return 403
  }
  return null
}

/** 委托宿主的 connection 栅栏（存在时）；返回 null 表示放行。 */
function hostFenceRejection(ctx, req) {
  let conn = null
  try {
    conn = typeof ctx.get === 'function' ? ctx.get('connection') : null
  } catch {
    conn = null
  }
  if (!conn || typeof conn.requestRejection !== 'function') return null
  try {
    const code = conn.requestRejection(req)
    if (code === undefined || code === null || code === false) return null
    return typeof code === 'number' ? code : 403
  } catch {
    return 403
  }
}

/** 组合校验：先自校验，再委托宿主栅栏（取更严格的结果）。 */
function denyResponse(ctx, req, res, options) {
  const self = rejectionOf(req, options)
  const code = self !== null ? self : hostFenceRejection(ctx, req)
  if (code === null) return false
  sendJson(res, code, { ok: false, error: { code: 'forbidden', message: '请求来源不被信任（需要本机同源访问）' } })
  return true
}

/* ------------------------------------------------------------------ *
 * HTTP 小工具
 * ------------------------------------------------------------------ */

function sendJson(res, status, value) {
  const body = `${JSON.stringify(value)}\n`
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': String(Buffer.byteLength(body)),
    'Cache-Control': 'no-store',
  })
  res.end(body)
}

/**
 * 读取 JSON 请求体（带大小上限）。@returns {Promise<object>}
 */
async function readJsonBody(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_BODY_BYTES) {
      const error = new Error(`请求体超过 ${MAX_BODY_BYTES} 字节上限`)
      error.code = 'body-too-large'
      throw error
    }
    chunks.push(chunk)
  }
  if (size === 0) return {}
  const text = Buffer.concat(chunks).toString('utf8')
  try {
    const parsed = JSON.parse(text)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    const error = new Error('请求体不是合法 JSON')
    error.code = 'bad-json'
    throw error
  }
}

/* ------------------------------------------------------------------ *
 * 模型路由解析
 * ------------------------------------------------------------------ */

/** 从 `listProviders()` 的返回值里稳妥地取出 provider 名字。 */
function providerNameOf(entry) {
  if (typeof entry === 'string') return entry.trim()
  if (!entry || typeof entry !== 'object') return ''
  for (const key of ['provider', 'id', 'name', 'route']) {
    const value = entry[key]
    if (typeof value === 'string' && value.trim() !== '') return value.trim()
  }
  return ''
}

/**
 * 生成「按优先级排列的候选模型路由」。
 * 顺序：配置覆盖 → 会话当前模型 → 宿主默认模型；都为空时才去目录里找。
 * @returns {Promise<Array<{provider: string, model: string, source: string}>>}
 */
async function resolveCandidates(ctx, config, sessionRoute) {
  const candidates = []
  const push = (provider, model, source) => {
    if (typeof provider !== 'string' || provider.trim() === '') return
    if (typeof model !== 'string' || model.trim() === '') return
    const entry = { provider: provider.trim(), model: model.trim(), source }
    if (candidates.some((item) => item.provider === entry.provider && item.model === entry.model)) return
    candidates.push(entry)
  }

  // 1) 用户显式指定的路由（配置文件里写了就最高优先）。
  push(config.provider, config.model, 'config')
  // 2) 浏览器半部报上来的「会话当前模型」——用户点按钮时就在用这个模型。
  if (sessionRoute && typeof sessionRoute === 'object') push(sessionRoute.provider, sessionRoute.model, 'session')
  // 3) 宿主默认模型（agent-default-model）。
  try {
    const selection = ctx.get('agentDefaultModel')?.currentSelection?.()
    if (selection) push(selection.provider, selection.model, 'default')
  } catch {}
  // 4) 兜底：目录里排第一的可用模型。
  if (candidates.length === 0) {
    const llm = ctx.get('llm')
    let providers = []
    try {
      providers = typeof llm?.listProviders === 'function' ? llm.listProviders() : []
    } catch {
      providers = []
    }
    for (const entry of Array.isArray(providers) ? providers : []) {
      const name = providerNameOf(entry)
      if (name === '') continue
      try {
        const models = await llm.listModels(name)
        for (const model of Array.isArray(models) ? models : []) {
          if (typeof model?.id === 'string' && model.id !== '') {
            push(name, model.id, 'catalog')
            break
          }
        }
      } catch {}
      if (candidates.length > 0) break
    }
  }
  return candidates
}

/* ------------------------------------------------------------------ *
 * 模型调用
 * ------------------------------------------------------------------ */

/** 把流终止原因翻译成可读错误；正常返回 undefined。 */
function finishError(finish) {
  if (finish == null) return undefined
  switch (finish.kind) {
    case 'stop':
    case 'max-tokens':
      return undefined
    case 'error':
    case 'aborted': {
      const error = new Error(finish.failure?.message ?? '模型调用失败')
      error.code = finish.failure?.code ?? 'LLM_FAILED'
      return error
    }
    default:
      return new Error(`模型以非预期原因结束：${String(finish.kind)}`)
  }
}

/**
 * 调用模型完成一次改写。失败时抛错，交由路由层决定是否本地兜底。
 * @returns {Promise<{text: string, route: {provider: string, model: string, source: string}, elapsedMs: number}>}
 */
async function callModel(ctx, { text, config, system, sessionRoute, overrides }) {
  const llm = ctx.get('llm')
  if (!llm || typeof llm.stream !== 'function') {
    const error = new Error('本机没有可用的模型服务（ctx.llm 缺失）')
    error.code = 'NO_LLM'
    throw error
  }
  const candidates = await resolveCandidates(ctx, config, sessionRoute)
  if (candidates.length === 0) {
    const error = new Error('没有解析到可用的模型路由；请在配置里填 provider/model，或让会话先跑一次')
    error.code = 'NO_ROUTE'
    throw error
  }

  const messages = [{ role: 'user', content: [{ type: 'text', text: buildUserContent(text) }] }]
  const maxTokens = scaleMaxTokens(text, config.maxTokens)
  let lastError = null

  for (const candidate of candidates.slice(0, MAX_ROUTE_ATTEMPTS)) {
    const controller = new AbortController()
    const timer = setTimeout(() => {
      try {
        controller.abort(new Error(`优化超时（${config.timeoutMs}ms 内模型没有返回）`))
      } catch {}
    }, config.timeoutMs)
    if (typeof timer.unref === 'function') timer.unref()
    const startedAt = Date.now()
    try {
      let raw = ''
      let finish
      const stream = llm.stream({
        provider: candidate.provider,
        model: candidate.model,
        messages,
        system,
        maxTokens,
        temperature: config.temperature,
        signal: controller.signal,
        purpose: 'prompt-starlight',
      })
      for await (const chunk of stream) {
        if (chunk == null) continue
        if (chunk.type === 'text-delta' && typeof chunk.text === 'string') raw += chunk.text
        else if (chunk.type === 'finish') finish = chunk
      }
      const terminal = finishError(finish)
      if (terminal !== undefined) throw terminal
      const cleaned = sanitizeOutput(raw)
      if (cleaned === '') {
        const error = new Error('模型返回了空内容')
        error.code = 'EMPTY_OUTPUT'
        throw error
      }
      return {
        text: cleaned,
        outputTokens: finish?.usage?.outputTokens,
        route: candidate,
        elapsedMs: Date.now() - startedAt,
      }
    } catch (error) {
      lastError = error
      // 路由不存在/无凭据时换下一个候选；其它错误（超时、内容为空）沿用第一个候选的失败即可。
      const code = String(error?.code ?? '')
      if (code !== 'NO_ADAPTER' && code !== 'MISSING_CREDENTIAL' && code !== 'AUTH') break
    } finally {
      clearTimeout(timer)
    }
  }
  throw lastError ?? new Error('模型调用失败')
}

/* ------------------------------------------------------------------ *
 * 模型目录（供设置页的「模型切换」用）
 * ------------------------------------------------------------------ */

/** 目录缓存的存活时间：listModels 可能打网络，不能每次开面板都去问。 */
const MODELS_CACHE_MS = 60_000
/** 单个 provider 的目录查询超时：慢的那个不能拖死整个列表。 */
const MODELS_QUERY_TIMEOUT_MS = 4000

/** 模型目录缓存：{ at, value }。 */
let modelsCache = null

/** 给一个 promise 加超时，超时后 reject 一个带 code 的错误。 */
function withTimeout(promise, ms, code) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const error = new Error(`查询超时（${ms}ms）`)
      error.code = code
      reject(error)
    }, ms)
    if (typeof timer.unref === 'function') timer.unref()
    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

/** 当前生效的「会话/默认」模型路由（不含用户在配置里的覆盖）。 */
function defaultRouteOf(ctx) {
  try {
    const selection = ctx.get('agentDefaultModel')?.currentSelection?.()
    if (selection && typeof selection.provider === 'string' && typeof selection.model === 'string') {
      return { provider: selection.provider, model: selection.model, source: 'default' }
    }
  } catch {}
  return null
}

/**
 * 枚举宿主当前能用的模型。
 * @param {object} ctx 插件上下文
 * @param {boolean} force 忽略缓存
 * @returns {Promise<{models: Array, default: object|null, errors: Array, cachedAt: number}>}
 */
async function listAvailableModels(ctx, force) {
  if (!force && modelsCache !== null && Date.now() - modelsCache.at < MODELS_CACHE_MS) {
    return { ...modelsCache.value, cachedAt: modelsCache.at, cached: true }
  }

  const llm = ctx.get('llm')
  const errors = []
  const models = []
  const seen = new Set()

  let providers = []
  try {
    providers = typeof llm?.listProviders === 'function' ? llm.listProviders() : []
  } catch (error) {
    errors.push({ provider: '*', message: String(error?.message ?? error) })
    providers = []
  }

  for (const entry of Array.isArray(providers) ? providers : []) {
    const provider = providerNameOf(entry)
    if (provider === '') continue
    try {
      const list = await withTimeout(llm.listModels(provider), MODELS_QUERY_TIMEOUT_MS, 'MODELS_TIMEOUT')
      for (const model of Array.isArray(list) ? list : []) {
        if (typeof model?.id !== 'string' || model.id === '') continue
        const key = `${provider}\u001f${model.id}`
        if (seen.has(key)) continue
        seen.add(key)
        models.push({
          provider,
          model: model.id,
          name: typeof model.name === 'string' && model.name !== '' ? model.name : model.id,
          ...(typeof model.description === 'string' && model.description !== '' ? { description: model.description } : {}),
        })
      }
    } catch (error) {
      errors.push({ provider, message: String(error?.message ?? error) })
    }
  }

  const value = { models, default: defaultRouteOf(ctx), errors }
  modelsCache = { at: Date.now(), value }
  return { ...value, cachedAt: modelsCache.at, cached: false }
}

/** 用已缓存的目录把路由翻译成友好名（拿不到就返回 undefined）。 */
function friendlyModelName(route) {
  if (modelsCache === null || route == null) return undefined
  const hit = modelsCache.value.models.find((item) => item.provider === route.provider && item.model === route.model)
  return hit?.name
}

/* ------------------------------------------------------------------ *
 * 插件
 * ------------------------------------------------------------------ */

export default {
  name: 'dsh-prompt-starlight',

  /**
   * 只等 webServer 就绪：模型、默认模型、栅栏全部用 `ctx.get()` 按需读取，
   * 这样任何一个可选服务缺失都不会让插件停在 PENDING。
   */
  apply(root) {
    // 宿主侧署名：启动日志里能看出这份代码是谁的，fork 掉署名一眼可见。
    // STARLIGHT_QUIET=1 可关掉（给不想看日志的部署留个开关）。
    try {
      if (String(process.env.STARLIGHT_QUIET || '') !== '1') {
        console.info(
          '[dsh-prompt-starlight] 星芒 · Starlit Sky 0.4.0 · AGPL-3.0 · github.com/Starlit-Sky-code/dsh-prompt-starlight',
        )
      }
    } catch {}

    root.inject(['webServer'], (ctx) => {
      // 服务访问两种风格都支持：cordis 的服务代理（ctx.webServer）与显式 get()。
      const webServer = ctx.webServer ?? (typeof ctx.get === 'function' ? ctx.get('webServer') : null)
      if (!webServer || typeof webServer.register !== 'function') {
        throw new Error('[starlight] webServer 服务不可用，路由未注册')
      }
      const disposers = []

      /** 统一注册：自动套信任栅栏。 */
      const route = (kind, path, handler, options) => {
        disposers.push(
          webServer.register({
            kind,
            path,
            handler: async (req, res) => {
              try {
                if (denyResponse(ctx, req, res, options)) return
                await handler(req, res)
              } catch (error) {
                const code = String(error?.code ?? '')
                const status = code === 'bad-json' || code === 'body-too-large' ? 400 : 500
                try {
                  sendJson(res, status, {
                    ok: false,
                    error: { code: code || 'internal', message: String(error?.message ?? error) },
                  })
                } catch {}
              }
            },
          }),
        )
      }

      // —— 插件图标：浏览器半部不能读本地文件，图标只能由宿主下发 ——
      route('exact', `${ROUTE}/icon.png`, async (req, res) => {
        const bytes = loadIcon()
        if (bytes === null) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
          res.end('icon unavailable')
          return
        }
        res.writeHead(200, {
          'Content-Type': 'image/png',
          'Content-Length': String(bytes.length),
          // 图标基本不变，允许浏览器缓存，但用 ETag 让改动可见
          'Cache-Control': 'public, max-age=3600',
          ETag: `"${bytes.length.toString(16)}"`,
        })
        res.end(bytes)
      })

      // —— 目录 + 当前配置：面板每次打开都会拉一次 ——
      route('exact', `${ROUTE}/manifest`, async (req, res) => {
        const config = readConfig()
        let llmAvailable = false
        try {
          llmAvailable = typeof ctx.get('llm')?.stream === 'function'
        } catch {}
        sendJson(res, 200, {
          ok: true,
          version: '0.4.0',
          configFile: CONFIG_FILE,
          llmAvailable,
          ...catalogForClient(config),
        })
      })

      // —— 可用模型目录（设置页的「模型切换」用；?refresh=1 强制刷新） ——
      route('exact', `${ROUTE}/models`, async (req, res) => {
        const config = readConfig()
        const force = /[?&]refresh=1/.test(String(req.url || ''))
        let catalog
        try {
          catalog = await listAvailableModels(ctx, force)
        } catch (error) {
          sendJson(res, 200, {
            ok: true,
            models: [],
            default: defaultRouteOf(ctx),
            configured: { provider: config.provider, model: config.model },
            errors: [{ provider: '*', message: String(error?.message ?? error) }],
          })
          return
        }
        sendJson(res, 200, {
          ok: true,
          models: catalog.models,
          default: catalog.default,
          configured: { provider: config.provider, model: config.model },
          errors: catalog.errors,
          cachedAt: catalog.cachedAt,
          cached: catalog.cached === true,
        })
      })

      // —— 保存用户自定义规则（部分字段合并） ——
      route(
        'exact',
        `${ROUTE}/config`,
        async (req, res) => {
          if (String(req.method || 'GET').toUpperCase() !== 'POST') {
            sendJson(res, 405, { ok: false, error: { code: 'method-not-allowed', message: '需要 POST' } })
            return
          }
          const body = await readJsonBody(req)
          const config = writeConfig(body)
          sendJson(res, 200, { ok: true, configFile: CONFIG_FILE, ...catalogForClient(config) })
        },
        { requireLocal: true },
      )

      // —— 恢复默认规则 ——
      route(
        'exact',
        `${ROUTE}/reset`,
        async (req, res) => {
          if (String(req.method || 'GET').toUpperCase() !== 'POST') {
            sendJson(res, 405, { ok: false, error: { code: 'method-not-allowed', message: '需要 POST' } })
            return
          }
          const config = resetConfig()
          sendJson(res, 200, { ok: true, configFile: CONFIG_FILE, ...catalogForClient(config) })
        },
        { requireLocal: true },
      )

      // —— 一键优化 ——
      route('exact', `${ROUTE}/optimize`, async (req, res) => {
        if (String(req.method || 'GET').toUpperCase() !== 'POST') {
          sendJson(res, 405, { ok: false, error: { code: 'method-not-allowed', message: '需要 POST' } })
          return
        }
        const body = await readJsonBody(req)
        const text = typeof body.text === 'string' ? body.text : ''
        if (text.trim() === '') {
          sendJson(res, 400, { ok: false, error: { code: 'empty-draft', message: '草稿是空的，没有可优化的内容' } })
          return
        }
        if (text.length > MAX_INPUT_CHARS) {
          sendJson(res, 400, {
            ok: false,
            error: { code: 'input-too-large', message: `草稿超过 ${MAX_INPUT_CHARS} 字符上限（当前 ${text.length}）` },
          })
          return
        }

        const config = readConfig()
        if (!config.enabled) {
          sendJson(res, 200, {
            ok: true,
            text: tidyLocally(text),
            mode: 'local',
            note: '插件已在设置里被关闭，只做了本地格式整理',
          })
          return
        }

        // 单次调用的临时覆盖：界面上拖动滑块不必先保存。
        const overrides = {
          verbosity: typeof body.verbosity === 'string' ? body.verbosity : undefined,
          lens: typeof body.lens === 'string' ? body.lens : undefined,
          locale: typeof body.locale === 'string' ? body.locale : undefined,
          depth: typeof body.depth === 'string' ? body.depth : undefined,
          customRules: Array.isArray(body.customRules)
            ? body.customRules
            : typeof body.customRules === 'string' && body.customRules.trim() !== ''
              ? body.customRules.split('\n')
              : undefined,
        }
        const system = buildSystemPrompt(config, {
          verbosity: overrides.verbosity,
          lens: overrides.lens,
          locale: overrides.locale,
          depth: overrides.depth,
          customRules: overrides.customRules,
        })

        try {
          const result = await callModel(ctx, {
            text,
            config,
            system,
            sessionRoute: body.route,
            overrides,
          })
          sendJson(res, 200, {
            ok: true,
            text: result.text,
            mode: 'model',
            provider: result.route.provider,
            model: result.route.model,
            // 目录里能查到就给友好名，查不到前端回落显示 id
            modelName: friendlyModelName(result.route),
            routeSource: result.route.source,
            elapsedMs: result.elapsedMs,
            outputTokens: result.outputTokens,
          })
        } catch (error) {
          // 模型不可用不是用户的错：退回机械整理，并在返回值里说清楚发生了什么。
          let localText = ''
          try {
            localText = tidyLocally(text)
          } catch {}
          sendJson(res, 200, {
            ok: true,
            text: localText === '' ? text : localText,
            mode: 'local',
            degraded: true,
            note: `模型调用失败，已退回本地格式整理：${String(error?.message ?? error)}`,
            errorCode: String(error?.code ?? 'unknown'),
          })
        }
      })

      // —— 探活（排查用） ——
      route('exact', `${ROUTE}/health`, async (req, res) => {
        const config = readConfig()
        let providers = []
        try {
          const llm = ctx.get('llm')
          providers = (typeof llm?.listProviders === 'function' ? llm.listProviders() : [])
            .map((entry) => providerNameOf(entry))
            .filter(Boolean)
        } catch {}
        sendJson(res, 200, {
          ok: true,
          version: '0.4.0',
          configFile: CONFIG_FILE,
          enabled: config.enabled,
          verbosity: config.verbosity,
          lens: config.lens,
          locale: config.locale,
          depth: config.depth,
          activeRuleIds: activeRules(config).map((rule) => rule.id),
          customRuleCount: config.customRules.length,
          modelOverride: config.provider !== '' && config.model !== '' ? { provider: config.provider, model: config.model } : null,
          providers,
        })
      })

      ctx.effect(() => () => {
        for (const dispose of disposers) {
          try {
            dispose()
          } catch {}
        }
      }, 'dsh-prompt-starlight routes')
    })
  },
}

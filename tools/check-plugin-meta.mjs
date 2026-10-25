/**
 * 星芒 · 提示词一键优化（dsh-prompt-starlight）
 * Copyright (c) 2026 Starlit Sky · SPDX-License-Identifier: AGPL-3.0-only
 * https://github.com/Starlit-Sky-code/dsh-prompt-starlight
 *
 * 复刻 DSH 宿主 `readPluginMeta()` 的规则，在重启 DSH 之前就能验证
 * 「插件卡片上会显示什么图标、什么标题、什么描述」。
 *
 * 规则来源：app.asar 内 @deepseek-ai/dsh-app-boot/lib/index.js 的
 * lib/types/package-meta.js 区段（图标校验）与 readPluginMeta()（本地化）。
 *
 * 宿主的实际行为：
 *   1. icon 必须是**清单目录内的相对路径**，绝对路径 / 带协议前缀（含 data:）都会被拒；
 *      扩展名限 .svg/.png/.jpg/.jpeg/.webp；原始字节 ≤ 256 KiB；必须是普通文件。
 *      通过后内联为 `data:<mime>;base64,...` 交给 UI 的 pkg.meta.icon。
 *   2. title / description 来自 `<包名>/locale/<lang>.json`，形如
 *      { "meta": { "title": "...", "description": "..." } }，值为非空字符串。
 *      缺失时回退到 package.json 的 name / description。
 *   3. locale 资源走 Node ESM 解析，所以 package.json 的 exports 必须放行 ./locale/*。
 *
 * 跑法：node tools/check-plugin-meta.mjs
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const MAX_ICON_BYTES = 256 * 1024
const ICON_MEDIA_TYPES = new Map([
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
])
const LANGUAGE_ID = /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/u

const problems = []
const notes = []
function fail(message) {
  problems.push(message)
}

const manifestPath = path.join(root, 'package.json')
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
notes.push(`包名   : ${manifest.name}`)
notes.push(`版本   : ${manifest.version}`)

/* ---------------- 1) 图标：逐条对照宿主校验 ---------------- */
let iconDataUrl
const icon = manifest.icon
if (icon === undefined) {
  fail('package.json 没有 icon 字段 → 插件卡片会显示 DSH 内置占位图标')
} else if (typeof icon !== 'string' || icon.trim() === '') {
  fail(`icon 必须是非空字符串，当前是 ${JSON.stringify(icon)}`)
} else if (path.isAbsolute(icon) || /^[A-Za-z][A-Za-z\d+.-]*:/u.test(icon)) {
  fail(`icon 必须是相对文件路径；宿主的协议正则会把 "${icon.slice(0, 24)}…" 判为非法（data: URL 也不行）`)
} else {
  const mediaType = ICON_MEDIA_TYPES.get(path.extname(icon).toLowerCase())
  if (mediaType === undefined) {
    fail(`icon 扩展名不支持（只收 .svg/.png/.jpg/.jpeg/.webp）：${icon}`)
  } else {
    const abs = path.resolve(root, icon)
    const relative = path.relative(root, abs)
    if (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) {
      fail(`icon 必须留在清单目录内：${icon} 解析到 ${abs}`)
    } else if (!fs.existsSync(abs)) {
      fail(`icon 指向的文件不存在：${icon}`)
    } else if (!fs.statSync(abs).isFile()) {
      fail(`icon 必须是普通文件：${icon}`)
    } else {
      const size = fs.statSync(abs).size
      if (size > MAX_ICON_BYTES) {
        fail(`icon 超过 256 KiB：${size} 字节`)
      } else {
        iconDataUrl = `data:${mediaType};base64,${fs.readFileSync(abs).toString('base64')}`
        notes.push(`图标   : ${icon} → ${mediaType} · ${(size / 1024).toFixed(1)} KB · 内联后 ${(iconDataUrl.length / 1024).toFixed(1)} KB`)
      }
    }
    // 图标要随包发布，否则装完读不到
    const files = Array.isArray(manifest.files) ? manifest.files : []
    if (!files.includes(icon)) fail(`files[] 没有包含 icon 路径 ${icon} → 安装后文件缺失`)
  }
}

/* ---------------- 2) locale 资源能否被解析 ---------------- */
const files = Array.isArray(manifest.files) ? manifest.files : []
if (!files.some((entry) => entry === 'locale' || entry.startsWith('locale/'))) {
  fail('files[] 没有包含 locale → 安装后本地化文案缺失')
}

const exportsField = manifest.exports ?? {}
const exportsPattern = exportsField['./locale/*']
if (exportsPattern === undefined) {
  fail('exports 没有放行 "./locale/*" → 宿主解析 <包名>/locale/en.json 会 ERR_PACKAGE_PATH_NOT_EXPORTED，本地化被静默跳过')
} else if (exportsPattern !== './locale/*') {
  fail(`exports["./locale/*"] 应当是 "./locale/*"，当前是 ${JSON.stringify(exportsPattern)}`)
}

const localeDir = path.join(root, 'locale')
const dictionaries = new Map()
if (!fs.existsSync(localeDir)) {
  fail('缺少 locale/ 目录')
} else {
  for (const entry of fs.readdirSync(localeDir, { withFileTypes: true })) {
    if (!entry.name.endsWith('.json')) continue
    const language = entry.name.slice(0, -5)
    if (!LANGUAGE_ID.test(language)) fail(`locale 文件名必须是语言 id：${entry.name}`)
    const file = path.join(localeDir, entry.name)
    let parsed
    try {
      parsed = JSON.parse(fs.readFileSync(file, 'utf8'))
    } catch (error) {
      fail(`${file}: ${String(error)}`)
      continue
    }
    const meta = parsed?.meta
    if (typeof meta !== 'object' || meta === null || Array.isArray(meta)) {
      fail(`${file} 缺少 meta 对象（宿主只读 meta.title / meta.description）`)
      continue
    }
    const fields = {}
    for (const key of ['title', 'description']) {
      const value = meta[key]
      if (value === undefined) continue
      if (typeof value !== 'string' || value.trim() === '') fail(`${file}: meta.${key} 必须是非空字符串`)
      else fields[key] = value
    }
    dictionaries.set(language.toLowerCase(), fields)
  }
  if (!dictionaries.has('en')) fail('缺少 locale/en.json：宿主以它为基准锚点枚举语言')
}

/* ---------------- 3) 复刻 localizedText() 的取值结果 ---------------- */
function localizedText(field, fallback, finalFallback) {
  const entries = []
  for (const [language, fields] of dictionaries) {
    if (fields[field] !== undefined) entries.push([language, fields[field]])
  }
  if (entries.length === 0) return fallback
  return { en: fallback ?? finalFallback, ...Object.fromEntries(entries) }
}

const title = localizedText('title', manifest.name, manifest.name)
const description = localizedText('description', manifest.description, '')

notes.push('')
notes.push(`标题   : ${typeof title === 'string' ? title : JSON.stringify(title)}`)
if (typeof description === 'string') {
  notes.push(`描述   : ${description}`)
} else {
  for (const [language, value] of Object.entries(description)) {
    notes.push(`描述 ${language.padEnd(3)}: ${value}`)
  }
}

if (typeof description === 'object') {
  for (const [language, value] of Object.entries(description)) {
    if (value.length > 140) notes.push(`  ⚠ 描述 ${language} 有 ${value.length} 字符，卡片上会被省略号截断`)
  }
}

/* ---------------- 输出 ---------------- */
for (const line of notes) console.log(line)
console.log('')
if (problems.length === 0) {
  console.log('✅ 符合宿主的插件元数据规则；重启 DSH 后卡片应显示上述图标与文案')
} else {
  for (const problem of problems) console.error(`❌ ${problem}`)
  console.error(`\n共 ${problems.length} 个问题`)
  process.exit(1)
}

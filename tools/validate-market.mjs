/**
 * 星芒 · 提示词一键优化（dsh-prompt-starlight）
 * Copyright (c) 2026 Starlit Sky · SPDX-License-Identifier: AGPL-3.0-only
 * https://github.com/Starlit-Sky-code/dsh-prompt-starlight
 *
 * 用**官方格式 1 校验器**读一遍 market/index.json，并打印每个版本的安装参数。
 *
 * DSH 本身不提供官方市场：「市场」就是一个 format 1 的 JSON 索引，放在任意 https 地址上，
 * 用户在 Plugins → Discover 里把地址加进去即可浏览与安装。所以这份索引就是我们自己的分发渠道。
 *
 * 校验器是 devDependency，需要先安装：
 *   npm i --no-save @deepseek-ai/dsh-plugin-market-index
 *
 * 跑法：node tools/validate-market.mjs
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const indexPath = path.join(root, 'market', 'index.json')

/** 校验器可能装在仓库根，也可能装在仅供本地验证的 .tmp/market 里。 */
const CANDIDATES = [
  ['@deepseek-ai/dsh-plugin-market-index', path.join(root, 'node_modules')],
  ['@deepseek-ai/dsh-plugin-market-index', path.join(root, '.tmp', 'market', 'node_modules')],
]

async function loadValidator() {
  for (const [name, nodeModules] of CANDIDATES) {
    const entry = path.join(nodeModules, name, 'lib', 'index.js')
    if (!fs.existsSync(entry)) continue
    return import(pathToFileURL(entry).href)
  }
  return null
}

const validator = await loadValidator()
if (validator === null) {
  console.error('找不到校验器 @deepseek-ai/dsh-plugin-market-index。')
  console.error('先运行：npm i --no-save @deepseek-ai/dsh-plugin-market-index')
  process.exit(1)
}

if (!fs.existsSync(indexPath)) {
  console.error('找不到 market/index.json')
  process.exit(1)
}

const raw = JSON.parse(fs.readFileSync(indexPath, 'utf8'))
// indexUrl 只用于解析相对图标；我们的图标是内联 data URL，这里给一个占位基准。
const indexUrl = 'https://cdn.jsdelivr.net/gh/Starlit-Sky-code/dsh-prompt-starlight@main/market/index.json'

let parsed
try {
  parsed = validator.parseMarketIndex(raw, indexUrl)
} catch (error) {
  console.error(`格式校验失败：${error.path} — ${error.reason ?? error.message}`)
  process.exit(1)
}

console.log(`格式校验通过：format ${parsed.format} · ${parsed.plugins.length} 个插件`)
for (const plugin of parsed.plugins) {
  const title = typeof plugin.title === 'string' ? plugin.title : plugin.title?.zh ?? plugin.title?.en ?? plugin.name
  console.log(`\n  ${plugin.name} — ${title}`)
  console.log(`    category : ${plugin.metadata.category ?? '(none)'}   labels: ${plugin.metadata.labels.join(', ') || '(none)'}`)
  if (plugin.icon !== undefined) {
    const dataUrl = plugin.icon.startsWith('data:')
    console.log(`    icon     : ${dataUrl ? `内联 ${Math.round((plugin.icon.length * 3) / 4 / 1024)} KB` : plugin.icon}`)
  }
  for (const version of plugin.versions) {
    const target = validator.marketInstallTarget(plugin.name, version)
    console.log(`    ${version.version}  →  ${target.spec}`)
    if (target.registry) console.log(`       registry: ${target.registry}`)
  }
}

const size = fs.statSync(indexPath).size
console.log(`\n索引体积：${(size / 1024).toFixed(1)} KB`)

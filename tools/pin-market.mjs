#!/usr/bin/env node
/**
 * 星芒 · 提示词一键优化（dsh-prompt-starlight）
 * Copyright (c) 2026 Starlit Sky · SPDX-License-Identifier: AGPL-3.0-only
 * https://github.com/Starlit-Sky-code/dsh-prompt-starlight
 *
 * 把 market/index.json 重新指向一个新版本与新提交。
 *
 * DSH 的「市场」是一个 format 1 的 JSON 索引，每个版本都钉死 40 位 commit，
 * 所以发版流程是：改版本号 → 提交 → 用那个提交跑本脚本 → 再提交索引。
 *
 * 用法：
 *   node tools/pin-market.mjs                 # 用 HEAD 与 package.json 的 version
 *   node tools/pin-market.mjs <commit> <ver>  # 显式指定
 */

import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const indexPath = path.join(root, 'market', 'index.json')

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
const commit = process.argv[2] ?? execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root }).toString().trim()
const version = process.argv[3] ?? pkg.version

if (!/^[0-9a-f]{40}$/.test(commit)) {
  console.error(`commit 必须是 40 位十六进制：${commit}`)
  process.exit(1)
}
if (!/^\d+\.\d+\.\d+/.test(version)) {
  console.error(`version 不像 SemVer：${version}`)
  process.exit(1)
}

const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'))
const plugin = index.plugins.find((item) => item.name === pkg.name)
if (plugin === undefined) {
  console.error(`index.json 里没有 ${pkg.name} 这个插件条目`)
  process.exit(1)
}

// 同一版本已存在就替换（重打标签的场景），否则插到最前（versions 按 SemVer 降序）。
const entry = {
  version,
  publishTimestamp: Math.floor(Date.now() / 1000),
  source: { type: 'git', url: 'https://github.com/Starlit-Sky-code/dsh-prompt-starlight', commit },
  engines: {},
}
const existing = plugin.versions.findIndex((item) => item.version === version)
if (existing >= 0) plugin.versions[existing] = entry
else plugin.versions.unshift(entry)

fs.writeFileSync(indexPath, JSON.stringify(index, null, 2) + '\n', 'utf8')
console.log(`已钉 ${pkg.name}@${version} → ${commit.slice(0, 12)}`)
console.log('下一步：node tools/validate-market.mjs 校验，然后提交 market/index.json')

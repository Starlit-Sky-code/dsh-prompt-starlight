/**
 * 星芒 · 提示词一键优化（dsh-prompt-starlight）
 * Copyright (c) 2026 Starlit Sky · SPDX-License-Identifier: AGPL-3.0-only
 * https://github.com/Starlit-Sky-code/dsh-prompt-starlight
 *
 * 从两份 CHANGELOG 里抽出某个版本的小节，拼成 Release 说明。
 *
 * 为什么不用 `--generate-notes`：那是把提交标题堆成列表，读起来像 git log，
 * 不是给人看的版本说明。版本说明应当随代码一起评审（写进 CHANGELOG diff 里）。
 *
 * 用法：
 *   node tools/extract-release-notes.mjs v0.4.1            # 打到 stdout
 *   node tools/extract-release-notes.mjs v0.4.1 out.md     # 写文件
 *
 * 找不到该版本的小节时以非零码退出——发版时缺版本说明应当直接失败，
 * 而不是发出一个空 Release。
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** 从 CHANGELOG 里取出 `## [x.y.z]` 到下一个 `## ` 之间的内容。 */
function sectionOf(text, version) {
  // 标题形如：## [0.4.1] - 2026-10-25  或  ## [未发布] / ## [Unreleased]
  const heading = new RegExp(`^##\\s*\\[${version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\][^\\n]*$`, 'm')
  const match = heading.exec(text)
  if (match === null) return null
  const start = match.index + match[0].length
  const rest = text.slice(start)
  const next = /^##\s+/m.exec(rest)
  const body = (next === null ? rest : rest.slice(0, next.index)).trim()
  return body === '' ? null : body
}

const tag = process.argv[2]
if (!tag) {
  console.error('用法: node tools/extract-release-notes.mjs <tag> [输出文件]')
  process.exit(1)
}
const version = tag.replace(/^v/, '')
const outputFile = process.argv[3]

const sources = [
  { file: 'CHANGELOG.zh-CN.md', placeholder: '中文' },
  { file: 'CHANGELOG.md', placeholder: 'English' },
]

const chunks = []
const missing = []
for (const source of sources) {
  const file = path.join(root, source.file)
  if (!fs.existsSync(file)) {
    missing.push(source.file)
    continue
  }
  const body = sectionOf(fs.readFileSync(file, 'utf8'), version)
  if (body === null) {
    missing.push(`${source.file} 里没有 ${version} 小节`)
    continue
  }
  chunks.push({ language: source.placeholder, body })
}

if (chunks.length === 0) {
  console.error(`找不到 ${version} 的版本说明：`)
  for (const item of missing) console.error(`  - ${item}`)
  console.error('先在 CHANGELOG 里补上该版本的小节，再打 tag。')
  process.exit(1)
}

const parts = [`# ${tag}`, '']
const chinese = chunks.find((chunk) => chunk.language === '中文')
const english = chunks.find((chunk) => chunk.language === 'English')
if (chinese) parts.push(chinese.body, '')
if (chinese && english) parts.push('---', '')
if (english) parts.push(`<details><summary>English</summary>`, '', english.body, '', '</details>', '')

const notes = parts.join('\n')
if (outputFile === undefined) {
  process.stdout.write(notes)
} else {
  fs.writeFileSync(outputFile, notes, 'utf8')
  const bytes = Buffer.byteLength(notes, 'utf8')
  console.error(`已写出 ${outputFile}（${bytes} 字节，${chunks.length} 种语言）`)
}

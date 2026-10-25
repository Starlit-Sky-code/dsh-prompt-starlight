/**
 * 星芒 · 提示词一键优化（dsh-prompt-starlight）
 * Copyright (c) 2026 Starlit Sky · SPDX-License-Identifier: AGPL-3.0-only
 * https://github.com/Starlit-Sky-code/dsh-prompt-starlight
 *
 * 给每个源文件盖上统一署名头。幂等：已有署名就跳过。
 * `--check` 只校验不写入，供测试与 CI 用（缺署名的文件会以退出码 1 失败）。
 *
 * 为什么要有这个工具：
 *   - 署名统一由脚本生成，手写会漂移成好几种写法；
 *   - AGPL 的「How to Apply」要求把声明附在源文件里，而不是只放一个 LICENSE；
 *   - 浏览器侧 lib/client.js 是原样下发的，署名头会直接出现在开发者工具里，
 *     fork 掉署名的人一眼可见。
 *
 * 用法：node tools/stamp-signature.mjs [--check]
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const MARK = 'Starlit Sky'

/** 盖在 js / mjs 上的署名头。`/*!` 形式可被压缩器保留。 */
const JS_BANNER = `/*!
 * 星芒 · 提示词一键优化（dsh-prompt-starlight）
 * Copyright (c) 2026 ${MARK} · SPDX-License-Identifier: AGPL-3.0-only
 * https://github.com/Starlit-Sky-code/dsh-prompt-starlight
 *
 * 这是 dsh-prompt-starlight 的一部分。保留本署名是使用条件：
 * 分发、修改或作为网络服务提供时必须附上完整对应源码（AGPL-3.0 第 4、5、13 条）。
 * 商业授权请联系作者。
 */
`

/** 盖在 python 上的署名头。 */
const PY_BANNER = `# 星芒 · 提示词一键优化（dsh-prompt-starlight）
# Copyright (c) 2026 ${MARK} · SPDX-License-Identifier: AGPL-3.0-only
# https://github.com/Starlit-Sky-code/dsh-prompt-starlight
# 保留本署名是使用条件（AGPL-3.0 第 4、5、13 条）。商业授权请联系作者。
`

/** 盖在 yaml / html 上的署名头。 */
const HASH_BANNER = `# 星芒 · 提示词一键优化（dsh-prompt-starlight）
# Copyright (c) 2026 ${MARK} · SPDX-License-Identifier: AGPL-3.0-only
# https://github.com/Starlit-Sky-code/dsh-prompt-starlight
# 保留本署名是使用条件（AGPL-3.0 第 4、5、13 条）。商业授权请联系作者。
`

const HTML_BANNER = `<!--
  星芒 · 提示词一键优化（dsh-prompt-starlight）
  Copyright (c) 2026 ${MARK} · SPDX-License-Identifier: AGPL-3.0-only
  https://github.com/Starlit-Sky-code/dsh-prompt-starlight
  保留本署名是使用条件（AGPL-3.0 第 4、5、13 条）。商业授权请联系作者。
-->
`

/** 需要署名的文件：按扩展名选模板。package.json 是 JSON，不能写注释，改用 author 字段。 */
const TARGETS = [
  { glob: ['lib'], ext: ['.js'], banner: JS_BANNER },
  { glob: ['tools'], ext: ['.mjs'], banner: JS_BANNER },
  { glob: ['tools'], ext: ['.py'], banner: PY_BANNER },
  { glob: ['design'], ext: ['.html'], banner: HTML_BANNER },
  { glob: [''], ext: ['.yml'], banner: HASH_BANNER },
  // GitHub Actions 工作流也是这份代码的一部分，一并署名
  { glob: [path.join('.github', 'workflows')], ext: ['.yml'], banner: HASH_BANNER },
]

function walk(dir, out) {
  let entries = []
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.tmp') continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else out.push(full)
  }
  return out
}

function stripBom(text) {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
}

/** 文件当前是否已经带署名头。 */
function hasBanner(text) {
  return stripBom(text).slice(0, 400).includes(MARK)
}

function main() {
  const checkOnly = process.argv.includes('--check')
  const files = new Set()

  for (const target of TARGETS) {
    for (const dir of target.glob) {
      const base = dir === '' ? ROOT : path.join(ROOT, dir)
      const candidates = dir === '' ? fs.readdirSync(ROOT).filter((n) => !fs.statSync(path.join(ROOT, n)).isDirectory()).map((n) => path.join(ROOT, n)) : walk(base, [])
      for (const file of candidates) {
        if (!target.ext.includes(path.extname(file))) continue
        files.add(file)
      }
    }
  }

  const missing = []
  let stamped = 0

  for (const file of [...files].sort()) {
    const relative = path.relative(ROOT, file).replace(/\\/g, '/')
    const text = fs.readFileSync(file, 'utf8')
    if (hasBanner(text)) continue

    missing.push(relative)
    if (checkOnly) continue

    const banner = TARGETS.find((t) => t.ext.includes(path.extname(file))).banner
    const body = stripBom(text)
    // 原文件若以 shebang 开头，署名头要放在 shebang 之后
    if (body.startsWith('#!')) {
      const newline = body.indexOf('\n')
      const head = body.slice(0, newline + 1)
      fs.writeFileSync(file, `${head}${banner}${body.slice(newline + 1)}`, 'utf8')
    } else {
      fs.writeFileSync(file, `${banner}${body}`, 'utf8')
    }
    stamped += 1
    console.log(`  已署名 ${relative}`)
  }

  console.log(
    checkOnly
      ? missing.length === 0
        ? `署名检查：${files.size} 个文件全部带署名`
        : `署名检查：${missing.length} 个文件缺少署名\n  ${missing.join('\n  ')}`
      : `署名完成：新增 ${stamped} 个，跳过 ${files.size - stamped} 个已有署名`,
  )

  if (checkOnly && missing.length > 0) process.exit(1)
}

main()

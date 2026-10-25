/*!
 * 星芒 · 提示词一键优化（dsh-prompt-starlight）
 * Copyright (c) 2026 Starlit Sky · SPDX-License-Identifier: AGPL-3.0-only
 * https://github.com/Starlit-Sky-code/dsh-prompt-starlight
 *
 * 这是 dsh-prompt-starlight 的一部分。保留本署名是使用条件：
 * 分发、修改或作为网络服务提供时必须附上完整对应源码（AGPL-3.0 第 4、5、13 条）。
 * 商业授权请联系作者。
 */
// Minimal ASAR reader: list entries or extract files.
import fs from 'node:fs'
import path from 'node:path'

const asarPath = process.argv[2]
const mode = process.argv[3] || 'list' // list | extract
const outDir = process.argv[4]
const filter = mode === 'list' ? (process.argv[4] || '') : (process.argv[5] || '')

const fd = fs.openSync(asarPath, 'r')
const sizeBuf = Buffer.alloc(16)
fs.readSync(fd, sizeBuf, 0, 16, 0)
// asar 头部：u32=4 | u32=headerBlockSize | u32=jsonPaddedSize | u32=jsonLength | json...
// 数据区从「8 + headerBlockSize」开始（headerBlock 自己含 4 字节长度前缀）。
const headerJsonSize = sizeBuf.readUInt32LE(12)
const headerBlockSize = sizeBuf.readUInt32LE(4)
const headerBuf = Buffer.alloc(headerJsonSize)
fs.readSync(fd, headerBuf, 0, headerJsonSize, 16)
const header = JSON.parse(headerBuf.toString('utf8'))
const dataOffset = 8 + headerBlockSize

const results = []
function walk(node, prefix) {
  for (const [name, entry] of Object.entries(node.files || {})) {
    const full = prefix ? prefix + '/' + name : name
    if (entry.link !== undefined) continue
    if (entry.files) walk(entry, full)
    else results.push({ path: full, size: entry.size, offset: entry.offset })
  }
}
walk(header, '')

if (mode === 'list') {
  const re = filter ? new RegExp(filter, 'i') : null
  for (const r of results) {
    if (re && !re.test(r.path)) continue
    console.log(r.size.toString().padStart(9), r.path)
  }
  console.error('[total files]', results.length)
} else if (mode === 'extract') {
  const re = filter ? new RegExp(filter, 'i') : null
  const picked = results.filter((r) => !re || re.test(r.path))
  const buf = fs.readFileSync(asarPath)
  for (const r of picked) {
    const target = path.join(outDir, r.path)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, buf.subarray(dataOffset + Number(r.offset), dataOffset + Number(r.offset) + r.size))
  }
  console.log('extracted', picked.length, 'files to', outDir)
}
fs.closeSync(fd)

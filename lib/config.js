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
 * 星芒 · 配置持久化。
 *
 * 「可自定义优化规则」必须能被用户改，所以规则落在 DSH_HOME 下的独立 JSON，
 * 而不是编译进代码或塞进 profile 的 cordis.patch.yml：
 *   - profile patch 是「整段替换」语义，用界面改规则会不小心把别的字段抹掉；
 *   - DSH_HOME 在桌面端与网页端共享同一份，用户改一次两边都生效；
 *   - 文件可手工编辑、可备份、可随仓库分发。
 *
 * 写盘策略：先写临时文件再 rename（原子替换），避免半截文件把界面读崩。
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { DEFAULTS, normalizeConfig } from './rules.js'

/** DSH 数据根目录；与宿主保持一致（桌面端由 DSH_HOME 指出）。 */
export const DSH_HOME = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')

/** 配置文件路径。可用 STARLIGHT_CONFIG_FILE 覆盖，方便多开/测试。 */
export const CONFIG_FILE = (() => {
  const override = String(process.env.STARLIGHT_CONFIG_FILE || '').trim()
  if (override !== '') return path.resolve(override)
  return path.join(DSH_HOME, 'starlight-prompt.json')
})()

/** 内存缓存：文件没变就不重复读盘。 */
let cache = null // { mtimeMs, size, config }

/** 读取（带 mtime 缓存）归一化后的配置。文件缺失或损坏一律回落默认值。 */
export function readConfig() {
  let stat = null
  try {
    stat = fs.statSync(CONFIG_FILE)
  } catch {
    // 文件还不存在：返回默认配置，但**不**写盘（首次保存时才创建）。
    if (cache === null || cache.config === undefined) cache = { mtimeMs: -1, size: -1, config: normalizeConfig(DEFAULTS) }
    return cache.config
  }
  if (cache !== null && cache.mtimeMs === stat.mtimeMs && cache.size === stat.size) return cache.config

  let config = normalizeConfig(DEFAULTS)
  try {
    const parsed = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'))
    config = normalizeConfig(parsed)
  } catch (err) {
    try {
      console.warn(`[starlight] 配置文件无法解析，已回落默认规则：${CONFIG_FILE} — ${String(err && err.message)}`)
    } catch {}
  }
  cache = { mtimeMs: stat.mtimeMs, size: stat.size, config }
  return config
}

/**
 * 合并并保存配置。
 * @param {object} patch 只包含要修改的字段
 * @returns {object} 保存后的完整配置
 */
export function writeConfig(patch) {
  const current = readConfig()
  const merged = normalizeConfig({ ...current, ...(patch && typeof patch === 'object' ? patch : {}) })
  const dir = path.dirname(CONFIG_FILE)
  fs.mkdirSync(dir, { recursive: true })
  const body = `${JSON.stringify({ ...merged, updatedAt: new Date().toISOString() }, null, 2)}\n`
  const temp = `${CONFIG_FILE}.${process.pid}.${Date.now()}.tmp`
  fs.writeFileSync(temp, body, 'utf8')
  fs.renameSync(temp, CONFIG_FILE)
  let stat = null
  try {
    stat = fs.statSync(CONFIG_FILE)
  } catch {}
  cache = { mtimeMs: stat ? stat.mtimeMs : -1, size: stat ? stat.size : -1, config: merged }
  return merged
}

/** 恢复默认配置（保留文件位置）。 */
export function resetConfig() {
  return writeConfig(normalizeConfig(DEFAULTS))
}

/*!
 * 星芒 · 提示词一键优化（dsh-prompt-starlight）
 * Copyright (c) 2026 Starlit Sky · SPDX-License-Identifier: AGPL-3.0-only
 * https://github.com/Starlit-Sky-code/dsh-prompt-starlight
 *
 * 这是 dsh-prompt-starlight 的一部分。保留本署名是使用条件：
 * 分发、修改或作为网络服务提供时必须附上完整对应源码（AGPL-3.0 第 4、5、13 条）。
 * 商业授权请联系作者。
 */
import fs from 'node:fs'

const h = fs.readFileSync('tools/preview.html', 'utf8')
const tests = {
  真实按钮标记: h.includes('data-dsh-starlight="button"'),
  设置页有hero: h.includes('dshsl-hero-badge'),
  设置页有模型选择行: h.includes('dshsl-picker-row'),
  设置页有规则紧凑标记: h.includes('data-compact'),
  设置页有规则分组: h.includes('dshsl-group-name'),
  设置页有分组网格: h.includes('dshsl-rules-grid'),
  设置页有状态徽标: h.includes('dshsl-pill'),
  档位说明: h.includes('dshsl-seg-note'),
  浮层已内联: h.includes('dshsl-panel'),
  真实CSS注入: h.includes('.dshsl-btn{position:relative'),
  无未解析占位: !h.includes('未安装 tools/fixture'),
  暗色主题可用: h.includes('data-theme=dark'),
}
let bad = 0
for (const [key, value] of Object.entries(tests)) {
  if (!value) bad += 1
  console.log((value ? 'ok   ' : 'FAIL ') + key)
}
process.exit(bad === 0 ? 0 : 1)

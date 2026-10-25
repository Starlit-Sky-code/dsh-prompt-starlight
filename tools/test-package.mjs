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
 * 包形状自检：确认 package.json 的 dsh / exports / files 声明与磁盘上的文件一致。
 *
 * 这些字段是 DSH 加载插件的唯一依据，写错时的表现是「插件装了但什么都没发生」，
 * 所以单独用机械断言守住：
 *   - client-modules 要求 exports["./client"] 能解析出**字符串**路径，且 dsh.client.platform 是字符串；
 *   - bundle 要求 dsh.bundle.patch 指向的 patch 文件真的存在、且 files[] 会把它发出去；
 *   - 浏览器半部是 classic script（由 __ModuleLoader__ 包装），不能出现 ESM 语法。
 *
 * 跑法：node tools/test-package.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

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

const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8')
const exists = (relative) => fs.existsSync(path.join(root, relative))

console.log('\n[1] package.json')

const pkg = JSON.parse(read('package.json'))

check('name 正确', pkg.name === 'dsh-prompt-starlight', pkg.name)
check('type 为 module', pkg.type === 'module', pkg.type)
check('license 存在', typeof pkg.license === 'string' && pkg.license !== '')
check('version 为 semver', /^\d+\.\d+\.\d+/.test(String(pkg.version)), pkg.version)

console.log('\n[2] 双入口')

check('main 指向宿主入口', typeof pkg.main === 'string' && exists(pkg.main), pkg.main)
const hostExport = pkg.exports?.['.']
check('exports["."] 可解析', typeof (hostExport?.default ?? hostExport) === 'string')
const clientExport = pkg.exports?.['./client']
const clientPath = typeof clientExport === 'string' ? clientExport : clientExport?.default
check('exports["./client"] 是字符串路径', typeof clientPath === 'string', JSON.stringify(clientExport))
check('客户端入口文件存在', typeof clientPath === 'string' && exists(clientPath), clientPath)
check('exports 暴露 package.json', pkg.exports?.['./package.json'] !== undefined)

console.log('\n[3] dsh 声明')

check('dsh.client.platform 为字符串', typeof pkg.dsh?.client?.platform === 'string', JSON.stringify(pkg.dsh?.client))
check('dsh.client.platform 是 web', pkg.dsh?.client?.platform === 'web', pkg.dsh?.client?.platform)
check('dsh.bundle.patch 指向存在的文件', typeof pkg.dsh?.bundle?.patch === 'string' && exists(pkg.dsh.bundle.patch), pkg.dsh?.bundle?.patch)
check('files[] 包含 lib', Array.isArray(pkg.files) && pkg.files.includes('lib'))
check('files[] 包含 patch 文件', Array.isArray(pkg.files) && pkg.files.includes('cordis.patch.yml'))

console.log('\n[4] cordis patch')

const patch = read('cordis.patch.yml')
check('patch 含 insert 段', /^-\s*insert:/m.test(patch), patch.split('\n')[0])
check('patch 插入本包', patch.includes('name: dsh-prompt-starlight'))
const patchId = /-\s*id:\s*(\S+)/.exec(patch)
check('patch 行 id 与本包一致', patchId !== null && patchId[1] === 'dsh-prompt-starlight', patchId?.[1])
check('patch 无 tab 缩进（YAML 禁用 tab）', !/\t/.test(patch))

console.log('\n[5] 宿主半部')

const host = read('lib/index.js')
check('宿主入口导出默认对象', /export default \{/.test(host))
check('宿主导出了 apply', /apply\(root\)/.test(host))
check('宿主没有引入浏览器 API', !/\bdocument\.|\bwindow\./.test(host))
check('宿主提供模型目录路由', host.includes('${ROUTE}/models'))
check('模型目录有缓存与超时保护', host.includes('MODELS_CACHE_MS') && host.includes('MODELS_QUERY_TIMEOUT_MS'))

console.log('\n[6] 浏览器半部')

const client = read(clientPath)
check('通过 __ModuleLoader__.load 注册', client.includes('__ModuleLoader__') && client.includes('.load({'))
check('模块 id 为包名', /id:\s*'dsh-prompt-starlight'/.test(client), 'id 未匹配')
check('没有 ESM import 语句', !/^\s*import\s+[\w{*]/m.test(client))
check('没有 ESM export 语句', !/^\s*export\s+/m.test(client))
check('导出 apply', /exports\.apply = apply/.test(client))
check('导出 inject', /exports\.inject = inject/.test(client))
check('注入的样式带 data-plugin（可随卸载回收）', client.includes("tag.dataset.plugin = PKG"))
check('注册进 conversation.input.left 槽位（左侧席位）', client.includes("'conversation.input.left'"))
check('不再使用 conversation.input.right 槽位', !client.includes("'conversation.input.right'"))
check('注册进 settings.section 槽位（独立设置页）', client.includes("'settings.section'"))
check('按钮带外圈描边/光晕（box-shadow 环）', /\.dshsl-btn\{[^}]*box-shadow:0 0 0 1px/.test(client))
check('使用 useSyncExternalStore 订阅草稿', client.includes('useSyncExternalStore'))
check('使用 createPortal 挂载浮层', client.includes('createPortal'))
check('有模型切换组件（模型下拉）', client.includes('function ModelPicker') && client.includes("className: 'dshsl-select'"))
check('拉取模型目录接口', client.includes("requestJson('/models'"))
check('规则按分组渲染', client.includes('dshsl-rules-grid') && client.includes('ruleGroups'))
check('尊重 prefers-reduced-motion', client.includes('prefers-reduced-motion: reduce'))
check('骨架屏占位', client.includes('function Skeleton') && client.includes('dshsl-skel-bar'))

console.log('\n[7] 文件清单')

for (const relative of [
  'lib/index.js',
  'lib/client.js',
  'lib/rules.js',
  'lib/config.js',
  'README.md',
  'README.zh.md',
  'LICENSE',
  'NOTICE',
  'assets/icon.png',
  'assets/icon-640.png',
  'assets/icon-180.png',
  'assets/icon-ui.png',
  'assets/social-preview.png',
  'market/index.json',
  'market/awesome-entry.yml',
  'docs/screenshots/popover.zh.png',
  'docs/screenshots/settings.zh.png',
]) {
  check(`存在 ${relative}`, exists(relative))
}
check('没有把 node_modules 打进包', !exists('node_modules'))

console.log('\n[9] 插件市场索引')

// DSH 没有官方市场：市场就是一个 format 1 的 JSON 索引。
// 这里只做结构断言；完整校验用官方校验器（npm run market:validate）。
const marketIndex = (() => {
  try {
    return JSON.parse(read('market/index.json'))
  } catch {
    return null
  }
})()

check('index.json 可解析', marketIndex !== null)
check('format 为 1', marketIndex?.format === 1, String(marketIndex?.format))
check('有标题与描述', typeof marketIndex?.title?.en === 'string' && typeof marketIndex?.description?.en === 'string')
check('声明了分类', Object.keys(marketIndex?.metadata?.categories ?? {}).length > 0)

const marketPlugin = marketIndex?.plugins?.[0]
check('列出的就是本包', marketPlugin?.name === pkg.name, marketPlugin?.name)
check('插件版本与 package.json 一致', marketPlugin?.versions?.[0]?.version === pkg.version, `${marketPlugin?.versions?.[0]?.version} vs ${pkg.version}`)
check(
  '版本钉死 40 位 commit',
  /^[0-9a-f]{40}$/.test(String(marketPlugin?.versions?.[0]?.source?.commit)),
  String(marketPlugin?.versions?.[0]?.source?.commit),
)
check('来源类型为 git', marketPlugin?.versions?.[0]?.source?.type === 'git')
check(
  'git 地址指向本仓库',
  String(marketPlugin?.versions?.[0]?.source?.url).includes('Starlit-Sky-code/dsh-prompt-starlight'),
  String(marketPlugin?.versions?.[0]?.source?.url),
)
check('图标是内联 data URL（不依赖第二个文件可达）', String(marketPlugin?.icon).startsWith('data:image/png;base64,'))
check(
  '内联图标解码后不超过 32 KiB',
  Math.round(((marketPlugin?.icon?.length ?? 0) * 3) / 4) <= 32 * 1024,
  String(Math.round(((marketPlugin?.icon?.length ?? 0) * 3) / 4)),
)
check('分类已在 metadata 里声明', (marketIndex?.metadata?.categories ?? {})[marketPlugin?.metadata?.category] !== undefined)
check(
  '每个 label 都已声明',
  (marketPlugin?.metadata?.labels ?? []).every((label) => (marketIndex?.metadata?.labels ?? {})[label] !== undefined),
  JSON.stringify(marketPlugin?.metadata?.labels),
)

const awesomeEntry = exists('market/awesome-entry.yml') ? read('market/awesome-entry.yml') : ''
check('awesome 条目含仓库 url', awesomeEntry.includes('url: https://github.com/Starlit-Sky-code/dsh-prompt-starlight'))
check('awesome 条目含 category', /^category: \w+$/m.test(awesomeEntry))
check('awesome 条目含英文描述（以句号结尾）', /^\s{2}en: .*\.$/m.test(awesomeEntry))
check('awesome 条目声明了 dsh.bundle 前置条件的备注', awesomeEntry.includes('dsh.bundle.patch'))

console.log('\n[8] 署名与版权')

const MARK = 'Starlit Sky'

// 所有需要署名的源文件：lib/*.js、tools/*.mjs、tools/*.py、cordis.patch.yml
const signedFiles = [
  ...fs.readdirSync(path.join(root, 'lib')).filter((n) => n.endsWith('.js')).map((n) => `lib/${n}`),
  ...fs.readdirSync(path.join(root, 'tools')).filter((n) => n.endsWith('.mjs') || n.endsWith('.py')).map((n) => `tools/${n}`),
  'cordis.patch.yml',

]

const unsigned = signedFiles.filter((relative) => !read(relative).slice(0, 400).includes(MARK))
check(`全部 ${signedFiles.length} 个源文件都带署名头`, unsigned.length === 0, unsigned.join(', '))

const clientHead = read('lib/client.js').slice(0, 400)
check('客户端半部署名用 /*! 形式（可被压缩器保留）', clientHead.startsWith('/*!'))
check('署名含 SPDX 许可标识', clientHead.includes('SPDX-License-Identifier: AGPL-3.0-only'))
check('署名含仓库地址', clientHead.includes('github.com/Starlit-Sky-code/dsh-prompt-starlight'))
check('客户端有运行时署名水印', client.includes('__starlightSigned'))
check('宿主有启动署名日志', read('lib/index.js').includes('[dsh-prompt-starlight] 星芒 · Starlit Sky'))

check('package.json author 为 Starlit Sky', pkg.author?.name === MARK, JSON.stringify(pkg.author))
check('package.json license 为 AGPL-3.0-only', pkg.license === 'AGPL-3.0-only', pkg.license)
check(
  'package.json repository 指向正确仓库',
  String(pkg.repository?.url || '').includes('Starlit-Sky-code/dsh-prompt-starlight'),
  String(pkg.repository?.url || ''),
)
check('NOTICE 提到版权人', read('NOTICE').includes(MARK))
check('NOTICE 说明 AGPL 网络条款', read('NOTICE').includes('第 13 条'))
check('LICENSE 是 AGPL 原文', read('LICENSE').startsWith('                    GNU AFFERO GENERAL PUBLIC LICENSE'))
check('README 引用图标', read('README.md').includes('assets/icon.png') && read('README.zh.md').includes('assets/icon.png'))
check('README 标注 by Starlit Sky', read('README.md').includes(MARK) && read('README.zh.md').includes(MARK))

console.log(`\n结果：${passes} 通过 / ${failures} 失败`)
process.exit(failures === 0 ? 0 : 1)

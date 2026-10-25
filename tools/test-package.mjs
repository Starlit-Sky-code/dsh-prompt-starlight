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
import { execFileSync } from 'node:child_process'
import os from 'node:os'
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

console.log('\n[2c] 兼容范围与变更记录')

// 声明了 engines.node 就必须真的在那个版本上跑过（CI 矩阵 20/22/24）。
check('engines.node 已声明', typeof pkg.engines?.node === 'string', JSON.stringify(pkg.engines))
check('engines.dsh 已声明', typeof pkg.engines?.dsh === 'string', JSON.stringify(pkg.engines))
// 预发布版本必须靠带预发布比较符的范围才放行，否则 0.2.0-rc.x 会被静默排除
check(
  'engines.dsh 范围包含 DSH 的预发布版本',
  /\d+\.\d+\.\d+-[0-9A-Za-z.-]+/.test(String(pkg.engines?.dsh)),
  String(pkg.engines?.dsh),
)

check('存在 CHANGELOG.md', exists('CHANGELOG.md'))
check('存在 CHANGELOG.zh-CN.md', exists('CHANGELOG.zh-CN.md'))
for (const file of ['CHANGELOG.md', 'CHANGELOG.zh-CN.md']) {
  if (!exists(file)) continue
  const text = read(file)
  check(`${file} 含当前版本 ${pkg.version} 的小节`, text.includes(`[${pkg.version}]`), pkg.version)
  check(`${file} 有「未发布」小节`, /^## \[Unreleased\]|^## \[未发布\]/m.test(text))
  check(`${file} 按 Keep a Changelog 分组`, /^### (Added|Changed|Fixed|Removed|新增|变更|修复|移除)/m.test(text))
}
check('files[] 包含 CHANGELOG', Array.isArray(pkg.files) && pkg.files.includes('CHANGELOG.md'))

// 版本说明必须能从 CHANGELOG 里抽取出来，否则 Release 会是空的
let notes = ''
try {
  notes = execFileSync(process.execPath, ['tools/extract-release-notes.mjs', '--current'], { cwd: root, encoding: 'utf8' })
} catch (error) {
  notes = ''
}
check('能生成当前版本的 Release 说明', notes.length > 80, `${notes.length} 字符`)
check('Release 说明是中英双语', notes.includes('###') && notes.includes('<details>'), notes.slice(0, 40))

// CI 用的是「--current + 输出文件」这个组合，而它曾经把输出路径当成 tag
// （位置参数含义随 --current 变化），发版时会把 Release 说明这一步打挂。
const notesFile = path.join(os.tmpdir(), `starlight-notes-${process.pid}.md`)
let notesFileOk = false
try {
  execFileSync(process.execPath, ['tools/extract-release-notes.mjs', '--current', notesFile], { cwd: root, stdio: 'ignore' })
  notesFileOk = fs.existsSync(notesFile) && fs.readFileSync(notesFile, 'utf8').includes('###')
} catch {
  notesFileOk = false
}
check('--current 加输出文件可用（CI 用的就是这个组合）', notesFileOk, notesFile)
try {
  fs.rmSync(notesFile, { force: true })
} catch {}

// 不存在的版本必须失败，否则会发出空 Release
let missingFails = false
try {
  execFileSync(process.execPath, ['tools/extract-release-notes.mjs', 'v999.0.0', '--quiet'], { cwd: root, stdio: 'ignore' })
} catch {
  missingFails = true
}
check('缺版本小节时抽取失败（不会产出空 Release）', missingFails)

check('package.json 有 verify 脚本', typeof pkg.scripts?.verify === 'string')
check('package.json 有 prepublishOnly（没验过不发）', typeof pkg.scripts?.prepublishOnly === 'string', JSON.stringify(pkg.scripts?.prepublishOnly))
check('keywords 含 cordis', Array.isArray(pkg.keywords) && pkg.keywords.includes('cordis'))

console.log('\n[3] dsh 声明')

check('dsh.client.platform 为字符串', typeof pkg.dsh?.client?.platform === 'string', JSON.stringify(pkg.dsh?.client))
check('dsh.client.platform 是 web', pkg.dsh?.client?.platform === 'web', pkg.dsh?.client?.platform)
check('dsh.bundle.patch 指向存在的文件', typeof pkg.dsh?.bundle?.patch === 'string' && exists(pkg.dsh.bundle.patch), pkg.dsh?.bundle?.patch)
check('files[] 包含 lib', Array.isArray(pkg.files) && pkg.files.includes('lib'))
check('files[] 包含 patch 文件', Array.isArray(pkg.files) && pkg.files.includes('cordis.patch.yml'))
check(
  'files[] 包含运行时图标（/icon.png 路由要读它）',
  Array.isArray(pkg.files) && pkg.files.includes('assets/icon-ui.png'),
  JSON.stringify(pkg.files),
)
check('files[] 包含市场索引', Array.isArray(pkg.files) && pkg.files.includes('market/index.json'))

// 发布目标必须钉死官方源。反面案例：publishConfig.registry 被写成
// npm.pkg.github.com 时，即使已经 npm login 也会一直报 ENEEDAUTH。
check(
  'publishConfig.registry 钉在官方源',
  pkg.publishConfig?.registry === 'https://registry.npmjs.org/',
  JSON.stringify(pkg.publishConfig),
)
check('未把 private 设为 true（否则无法发布）', pkg.private !== true)

console.log('\n[2b] 插件卡片元数据（宿主 readPluginMeta 规则）')

// 面板卡片上的图标来自 package.json.icon，宿主会校验并内联成 data URL。
// 规则：相对路径、留在清单目录内、扩展名 svg/png/jpeg/webp、≤256 KiB、普通文件。
const ICON_EXT = ['.svg', '.png', '.jpg', '.jpeg', '.webp']
check('声明了 icon 字段', typeof pkg.icon === 'string' && pkg.icon !== '', JSON.stringify(pkg.icon))
check('icon 是相对路径（data: 会被宿主协议正则拒绝）', typeof pkg.icon === 'string' && !/^[A-Za-z][A-Za-z\d+.-]*:/.test(pkg.icon) && !pkg.icon.startsWith('/'))
check('icon 扩展名可用', ICON_EXT.includes(path.extname(String(pkg.icon)).toLowerCase()), String(pkg.icon))
check('icon 文件存在', exists(String(pkg.icon)) && fs.statSync(path.join(root, String(pkg.icon))).isFile())
check('icon 不超过 256 KiB', exists(String(pkg.icon)) && fs.statSync(path.join(root, String(pkg.icon))).size <= 256 * 1024, String(fs.existsSync(path.join(root, String(pkg.icon))) ? fs.statSync(path.join(root, String(pkg.icon))).size : -1))
check('files[] 包含 icon（否则安装后缺文件）', Array.isArray(pkg.files) && pkg.files.includes(String(pkg.icon)))

// 标题与描述的本地化走 <包名>/locale/<lang>.json，且必须被 exports 放行。
check('exports 放行 ./locale/*', pkg.exports?.['./locale/*'] === './locale/*', JSON.stringify(pkg.exports?.['./locale/*'] ?? null))
check('files[] 包含 locale', Array.isArray(pkg.files) && pkg.files.includes('locale'))
check('存在 locale/en.json（宿主以它为锚点）', exists('locale/en.json'))
check('存在 locale/zh.json', exists('locale/zh.json'))

for (const language of ['en', 'zh']) {
  const file = `locale/${language}.json`
  if (!exists(file)) continue
  let parsed = null
  try {
    parsed = JSON.parse(read(file))
  } catch {}
  check(`${file} 可解析且有 meta 对象`, parsed !== null && typeof parsed.meta === 'object' && parsed.meta !== null)
  check(`${file} 的 meta.title 是非空字符串`, typeof parsed?.meta?.title === 'string' && parsed.meta.title.trim() !== '')
  check(`${file} 的 meta.description 是非空字符串`, typeof parsed?.meta?.description === 'string' && parsed.meta.description.trim() !== '')
  check(`${file} 的描述不超过 200 字符（卡片会截断）`, String(parsed?.meta?.description ?? '').length <= 200, String(String(parsed?.meta?.description ?? '').length))
}

// 描述必须如实：不能写已经不存在的 3 档强度 / 7 档风格
const zhDescription = exists('locale/zh.json') ? JSON.parse(read('locale/zh.json')).meta.description : ''
check('描述不再宣称旧的「风格」体系', !/7 档风格|七档风格/.test(zhDescription), zhDescription.slice(0, 30))
check('描述的规则数量与实现一致（11 条）', zhDescription.includes('11 条') && read('lib/rules.js').includes('RULE_CATALOG'))
check('描述提到的滑块在实现里存在', /滑块/.test(zhDescription) && read('lib/client.js').includes('dshsl-range'))
check(
  '没有指向 GitHub Packages 的 registry 残留',
  !JSON.stringify(pkg).includes('npm.pkg.github.com'),
)

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
check('有模型切换组件', client.includes('function ModelPicker'))
check('模型选择用原生形态的行 + 列表，不用 <select>', client.includes("className: 'dshsl-picker-row'") && client.includes("role: 'listbox'"))
check('代码里不再有 select 元素', !client.includes("className: 'dshsl-select'") && !client.includes("'select',"))
check('浮层有弹出 / 收回动画', client.includes('dshsl-pop-in') && client.includes('dshsl-pop-out'))
check('收回动画结束后才卸载', client.includes('CLOSE_ANIMATION_MS') && client.includes('data-closing'))
check('减少动效时关闭动画', client.includes('prefers-reduced-motion') && client.includes('.dshsl-picker-list{animation:none}'))

// 规则列表的列数必须由容器决定，不能按视口宽度（曾经用 @media 导致浮层被挤成两列）
check(
  '规则列数按容器决定（不再有按视口的 media 查询）',
  client.includes("'data-columns': props.columns === 2") && !client.includes('@media (min-width:560px){.dshsl-rules-grid'),
)
check('浮层里规则用紧凑形态（只留标题）', client.includes('compact: true') && client.includes('data-compact'))
check('浮层里的自定义规则是二级折叠', client.includes("title: t('自定义规则', 'Custom rules')"))
check(
  '截图有量化步骤（控制包体）',
  fs.existsSync('tools/optimize-shots.py') && fs.readFileSync('tools/make-shots.mjs', 'utf8').includes('optimize-shots.py'),
)
const shots = fs.existsSync('docs/screenshots') ? fs.readdirSync('docs/screenshots').filter((n) => n.endsWith('.png')) : []
check('截图齐全（收起 / 模型列表 / 更多设置 × 中英）', shots.length >= 6, shots.join(', '))
check('README 引用了展开态截图', read('README.zh.md').includes('popover-more.zh.png') || read('README.zh.md').includes('popover-open.zh.png'))
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
/** git 跟踪的文件列表；不是 git 仓库（例如从 tarball 安装）时返回空串。 */
function gitTracked(pattern) {
  try {
    return execFileSync('git', ['ls-files', pattern], { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  } catch {
    return ''
  }
}

// 真正要防的是「把 node_modules 提交进仓库」和「把它发进包」，
// 而不是「本机装过依赖」——CI 里 npm install 必然会创建这个目录。
check('node_modules 没有被 git 跟踪', gitTracked('node_modules') === '', gitTracked('node_modules').split('\n').slice(0, 3).join(', '))
// 源头上防住：.gitignore 必须忽略 node_modules，否则一次 git add -A 就会把它整包提交
const gitignore = exists('.gitignore') ? read('.gitignore') : ''
check(
  '.gitignore 忽略根 node_modules',
  gitignore.split('\n').some((line) => line.trim() === 'node_modules/' || line.trim() === 'node_modules'),
  JSON.stringify(gitignore.split('\n').filter((line) => line.includes('node_modules'))),
)
check(
  'files[] 不含 node_modules 与测试夹具',
  Array.isArray(pkg.files) && !pkg.files.some((entry) => /node_modules|^tools/.test(entry)),
  JSON.stringify(pkg.files),
)

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
check(
  'awesome 条目挂了 Release tarball（免构建授权）',
  /^tarball: https:\/\/github\.com\/Starlit-Sky-code\/dsh-prompt-starlight\/releases\/download\/v[0-9.]+\//m.test(awesomeEntry),
)

console.log('\n[8] 署名与版权')

const MARK = 'Starlit Sky'

// 所有需要署名的源文件：lib/*.js、tools/*.mjs、tools/*.py、cordis.patch.yml、
// 以及 .github/workflows/*.yml（工作流也是这份代码的一部分）
const workflowsDir = path.join(root, '.github', 'workflows')
const workflowFiles = fs.existsSync(workflowsDir)
  ? fs.readdirSync(workflowsDir).filter((n) => n.endsWith('.yml')).map((n) => `.github/workflows/${n}`)
  : []

const signedFiles = [
  ...fs.readdirSync(path.join(root, 'lib')).filter((n) => n.endsWith('.js')).map((n) => `lib/${n}`),
  ...fs.readdirSync(path.join(root, 'tools')).filter((n) => n.endsWith('.mjs') || n.endsWith('.py')).map((n) => `tools/${n}`),
  'cordis.patch.yml',
  ...workflowFiles,
]

const unsigned = signedFiles.filter((relative) => !read(relative).slice(0, 400).includes(MARK))
check(`全部 ${signedFiles.length} 个源文件都带署名头`, unsigned.length === 0, unsigned.join(', '))

const clientHead = read('lib/client.js').slice(0, 400)
check('客户端半部署名用 /*! 形式（可被压缩器保留）', clientHead.startsWith('/*!'))
check('署名含 SPDX 许可标识', clientHead.includes('SPDX-License-Identifier: AGPL-3.0-only'))
check('署名含仓库地址', clientHead.includes('github.com/Starlit-Sky-code/dsh-prompt-starlight'))
check('客户端有运行时署名水印', client.includes('__starlightSigned'))
check('宿主有启动署名日志', read('lib/index.js').includes('[dsh-prompt-starlight] 星芒 · Starlit Sky'))

check('工作流文件存在且带署名', workflowFiles.length >= 2 && workflowFiles.every((f) => read(f).includes(MARK)), workflowFiles.join(', '))
check('CI 工作流在 main push 与 PR 上触发', read('.github/workflows/ci.yml').includes('branches: [main]') && read('.github/workflows/ci.yml').includes('pull_request'))
check('Release 工作流由 v* tag 触发', read('.github/workflows/release.yml').includes("tags: ['v*']"))
check('Release 工作流会重钉市场索引', read('.github/workflows/release.yml').includes('pin-market.mjs'))
check('Release 工作流申请了 OIDC 权限（Trusted Publishing 必需）', /^\s{2}id-token:\s*write$/m.test(read('.github/workflows/release.yml')))
check('Release 工作流不再依赖长期 NPM_TOKEN 发布', !read('.github/workflows/release.yml').includes('secrets.NPM_TOKEN'))
check('npm 发布由仓库变量 NPM_PUBLISH 控制', read('.github/workflows/release.yml').includes("vars.NPM_PUBLISH == 'true'"))

// 文档必须说清引导顺序：Trusted Publishing 只能配在已存在的包上，
// 首版必须先用一次 token 发出来，然后立刻吊销。
const zhReadme = read('README.zh.md')
check('README 说明 TP 需要包已存在才能配置', zhReadme.includes('包还没发布时账号里找不到这个入口'))
check('README 要求吊销引导用的 token', zhReadme.includes('**吊销那个 token**'))
check('README 要求发布后禁止 token 发布', zhReadme.includes('disallow tokens') || zhReadme.includes('禁止'))
check('Release 工作流发布前跑测试', read('.github/workflows/release.yml').includes('test-host.mjs') && read('.github/workflows/release.yml').includes('test-client.mjs'))

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

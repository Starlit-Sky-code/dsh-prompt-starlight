/**
 * 把本插件 link 进指定的 DSH profile（改 package.json + 装依赖）。
 * 幂等：重复执行只会有一次改动。rollback 走 --remove。
 *
 * 用法：
 *   node tools/install-profile.mjs            # 装入 $DSH_HOME/profiles/desktop
 *   node tools/install-profile.mjs --remove   # 回滚
 *   node tools/install-profile.mjs --profile web
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const PKG = 'dsh-prompt-starlight'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const home = process.env.DSH_HOME || 'C:\\DSH'

const argv = process.argv.slice(2)
const remove = argv.includes('--remove')
const profileIndex = argv.indexOf('--profile')
const profileName = profileIndex >= 0 ? argv[profileIndex + 1] : 'desktop'
const profileDir = path.join(home, 'profiles', profileName)
const manifestPath = path.join(profileDir, 'package.json')

if (!fs.existsSync(manifestPath)) {
  console.error(`找不到 profile：${manifestPath}`)
  process.exit(1)
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
manifest.dependencies = manifest.dependencies ?? {}
manifest.dsh = manifest.dsh ?? {}
manifest.dsh.profile = manifest.dsh.profile ?? {}
manifest.dsh.profile.bundles = manifest.dsh.profile.bundles ?? []

if (remove) {
  delete manifest.dependencies[PKG]
  manifest.dsh.profile.bundles = manifest.dsh.profile.bundles.filter((name) => name !== PKG)
  console.log(`回滚：从 ${profileName} 移除 ${PKG}`)
} else {
  const specifier = `link:${root}`
  manifest.dependencies[PKG] = specifier
  if (!manifest.dsh.profile.bundles.includes(PKG)) manifest.dsh.profile.bundles.push(PKG)
  console.log(`装入 ${profileName}：${PKG} -> ${specifier}`)
}

fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')

// DSH 随包附带的 pnpm 是 pnpm.cjs（没有 .cmd 外壳），直接用当前 node 跑它。
const pnpmScript = path.join(home, 'resources', 'runtime', 'pnpm', 'bin', 'pnpm.cjs')
if (!fs.existsSync(pnpmScript)) {
  console.error(`找不到 DSH 自带的 pnpm：${pnpmScript}`)
  process.exit(1)
}
const args = [pnpmScript, 'install', '--dir', profileDir, '--no-frozen-lockfile']
console.log(`执行：${process.execPath} ${args.join(' ')}`)
execFileSync(process.execPath, args, { stdio: 'inherit' })

const installed = path.join(profileDir, 'node_modules', PKG)
const ok = fs.existsSync(path.join(installed, 'package.json'))
console.log(ok ? `已链接：${installed}` : `警告：${installed} 不存在，请检查 pnpm 输出`)
if (ok) {
  const linked = JSON.parse(fs.readFileSync(path.join(installed, 'package.json'), 'utf8'))
  console.log(`解析到包：${linked.name}@${linked.version}`)
  console.log(`客户端入口存在：${fs.existsSync(path.join(installed, 'lib', 'client.js'))}`)
}

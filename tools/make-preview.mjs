/**
 * 生成 tools/preview.html：用 lib/client.js 里**真实的 CSS** 渲染按钮样式样本。
 *
 * 为什么需要它：改动要重启 DSH 才生效，而「外圈光环」这种东西光看代码没法验收。
 * 这个脚本把 CSS 原样抽出来（不是手抄），配上真实的四角星 path 与槽位位置示意，
 * 打开就能看亮/暗两种主题下的实际效果。
 *
 * 跑法：node tools/make-preview.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const source = fs.readFileSync(path.join(root, 'lib', 'client.js'), 'utf8')

/* ---- 从源码里抽出 CSS 数组（去掉行注释后求值，保证与产物完全一致） ---- */
const block = /var CSS = \[\n([\s\S]*?)\n\s*\]\.join\(''\)/.exec(source)
if (block === null) {
  console.error('没能从 lib/client.js 里定位到 CSS 数组')
  process.exit(1)
}
const body = block[1]
  .split('\n')
  .filter((line) => !line.trim().startsWith('//'))
  .join('\n')
let CSS
try {
  CSS = new Function(`return [${body}].join('')`)()
} catch (error) {
  console.error('CSS 数组求值失败：', error.message)
  process.exit(1)
}

const STAR = 'M12 1.6 14.34 9.66 22.4 12 14.34 14.34 12 22.4 9.66 14.34 1.6 12 9.66 9.66Z'

const button = (attrs, size) =>
  `<button type="button" class="dshsl-btn" ${attrs}>` +
  `<svg class="dshsl-star" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true">` +
  `<path fill="currentColor" d="${STAR}"/></svg>` +
  `</button>`

const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<title>星芒按钮 · 样式预览</title>
<style>
  /* 只放预览页面自己的排版；按钮相关样式全部来自 lib/client.js 的真实 CSS */
  :root{--dsw-alias-bg-base:#fff;--dsw-alias-bg-layer-1:#f6f7f9;--dsw-alias-bg-layer-2:#fff;--dsw-alias-border-l2:rgba(20,24,30,.10);--dsw-alias-border-l3:rgba(20,24,30,.18);--dsw-alias-border-l4:rgba(20,24,30,.26);--dsw-alias-label-primary:#14181e;--dsw-alias-label-secondary:#5f6570;--dsw-alias-label-tertiary:#8a8f98;--dsw-alias-label-caption:#9aa0a6;--dsw-alias-label-dimmed:#b3b7bd;--dsw-alias-interactive-bg-hover:rgba(20,24,30,.06);--dsw-alias-state-business-primary:#4d6bfe;--dsw-alias-state-error-primary:#e5484d;--dsw-alias-state-success-primary:#2f9e44;--dsw-alias-state-warn-primary:#d17a00;--dsw-alias-menu-surface-fill:#fff;--dsw-elevation-panel:0 12px 40px rgba(0,0,0,.22);--dsw-radius-panel:14px;--dsw-alias-toast-bg:rgba(28,30,34,.94);--dsw-alias-toast-label:#fff;--dsw-elevation-prominent:0 8px 24px rgba(0,0,0,.28)}
  html[data-theme=dark]{--dsw-alias-bg-base:#14161a;--dsw-alias-bg-layer-1:#191c21;--dsw-alias-bg-layer-2:#20242b;--dsw-alias-border-l2:rgba(255,255,255,.10);--dsw-alias-border-l3:rgba(255,255,255,.20);--dsw-alias-border-l4:rgba(255,255,255,.28);--dsw-alias-label-primary:#e8eaee;--dsw-alias-label-secondary:#a8aeb8;--dsw-alias-label-tertiary:#8a8f98;--dsw-alias-label-caption:#767c86;--dsw-alias-label-dimmed:#5b616b;--dsw-alias-interactive-bg-hover:rgba(255,255,255,.08);--dsw-alias-state-business-primary:#7f95ff;--dsw-alias-state-error-primary:#ff6b6f;--dsw-alias-state-success-primary:#57c76b;--dsw-alias-state-warn-primary:#e2a03f;--dsw-alias-menu-surface-fill:#20242b}
  body{margin:0;padding:32px;font:14px/1.6 -apple-system,"Segoe UI",system-ui,"Microsoft YaHei",sans-serif;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary)}
  h1{font-size:18px;margin:0 0 4px}
  p.sub{margin:0 0 24px;color:var(--dsw-alias-label-secondary);font-size:12.5px}
  h2{font-size:13px;font-weight:600;margin:28px 0 10px;color:var(--dsw-alias-label-secondary)}
  .row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
  .stage{background:var(--dsw-alias-bg-base);border:.5px solid var(--dsw-alias-border-l2);border-radius:14px;padding:18px 20px}
  /* 模拟 composer 工具行：左侧簇 → …… → 右侧簇 */
  .toolbar{display:flex;align-items:center;gap:6px;border:.5px solid var(--dsw-alias-border-l3);border-radius:14px;padding:8px 10px;margin-top:10px}
  .spacer{flex:1}
  .chip{height:26px;padding:0 10px;display:inline-flex;align-items:center;border-radius:999px;font-size:12px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-interactive-bg-hover)}
  .caption{font-size:11.5px;color:var(--dsw-alias-label-caption);margin:6px 0 0}
  .toggle{position:fixed;top:20px;right:24px;font-size:12px;padding:5px 12px;border-radius:999px;border:.5px solid var(--dsw-alias-border-l3);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);cursor:pointer}
  /* 悬停效果无法静态呈现，用一层额外的光晕示意 */
  .hover-demo{display:inline-flex;border-radius:999px}
  .hover-demo .dshsl-btn{color:var(--dsw-alias-state-business-primary);box-shadow:0 0 0 1px var(--dsw-alias-state-business-primary),0 0 0 4px color-mix(in srgb,var(--dsw-alias-state-business-primary) 16%,transparent),0 4px 16px -6px color-mix(in srgb,var(--dsw-alias-state-business-primary) 55%,transparent)}
</style>
<style data-preview="real-css">${CSS}</style>
</head>
<body>
  <button class="toggle" type="button" onclick="var h=document.documentElement;h.dataset.theme=h.dataset.theme==='dark'?'light':'dark';this.textContent=h.dataset.theme==='dark'?'切换到亮色':'切换到暗色'">切换到暗色</button>

  <h1>星芒按钮 · 样式预览</h1>
  <p class="sub">按钮样式直接取自 <code>lib/client.js</code> 的 CSS 数组（脚本抽取，非手抄）。改动需重启 DSH 后才会出现在真实界面里。</p>

  <h2>它在输入框里的位置（工具行左侧簇首位）</h2>
  <div class="stage">
    <div class="toolbar">
      ${button('data-state="idle"', 16)}
      <span class="chip">＋</span>
      <span class="chip">权限</span>
      <span class="spacer"></span>
      <span class="chip">模型选择</span>
      <span class="spot" style="width:26px;height:26px;border-radius:999px;background:var(--dsw-alias-state-business-primary)"></span>
    </div>
    <p class="caption">order: 10 —— 排在官方附件与权限按钮之前；右侧圆点是「发送」占位。</p>
  </div>

  <h2>四种状态</h2>
  <div class="row">
    <div class="stage" style="text-align:center;min-width:112px">${button('data-state="idle"', 16)}<p class="caption">idle（有草稿）</p></div>
    <div class="stage" style="text-align:center;min-width:112px">${button('data-state="idle" disabled', 16)}<p class="caption">disabled（空草稿）</p></div>
    <div class="stage" style="text-align:center;min-width:112px">${button('data-state="busy"', 16)}<p class="caption">busy（四角星旋转）</p></div>
    <div class="stage" style="text-align:center;min-width:112px">${button('data-state="error"', 16)}<p class="caption">error</p></div>
    <div class="stage" style="text-align:center;min-width:112px">${button('data-state="done"', 16)}<p class="caption">done</p></div>
    <div class="stage" style="text-align:center;min-width:112px"><span class="hover-demo">${button('data-state="idle"', 16)}</span><p class="caption">hover（示意）</p></div>
  </div>

  <h2>放大看外圈</h2>
  <div class="row">
    <div class="stage" style="transform:scale(3);transform-origin:left center;margin:26px 0 26px 26px">${button('data-state="idle"', 16)}</div>
    <p class="caption" style="max-width:420px">外圈是三层 <code>box-shadow</code>：1px 描边圈（<code>--dsw-alias-border-l3</code>）+ 1px 近距投影 + 14px 远距扩散。<br>刻意不用 <code>border</code>——按钮恒为 28×28，不会把工具行撑高。</p>
  </div>

  <script>
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.dataset.theme = 'dark'
      document.querySelector('.toggle').textContent = '切换到亮色'
    }
  </script>
</body>
</html>
`

const target = path.join(root, 'tools', 'preview.html')
fs.writeFileSync(target, html, 'utf8')
console.log(`已生成 ${path.relative(root, target)}（${Buffer.byteLength(html)} 字节）`)
console.log(`按钮 CSS 规则数：${(CSS.match(/\.dshsl-btn/g) ?? []).length}`)

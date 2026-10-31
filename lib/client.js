/*!
 * 星芒 · 提示词一键优化（dsh-prompt-starlight）
 * Copyright (c) 2026 Starlit Sky · SPDX-License-Identifier: AGPL-3.0-only
 * https://github.com/Starlit-Sky-code/dsh-prompt-starlight
 *
 * 这是 dsh-prompt-starlight 的一部分。保留本署名是使用条件：
 * 分发、修改或作为网络服务提供时必须附上完整对应源码（AGPL-3.0 第 4、5、13 条）。
 * 商业授权请联系作者。
 */
(function () {
  var loader = typeof window !== 'undefined' ? window.__ModuleLoader__ : undefined
  if (loader === undefined || typeof loader.load !== 'function') {
    // 没有 DSH 模块加载器时静默退出：绝不让一次插件加载失败拖垮整个页面启动。
    try {
      console.warn('[dsh-prompt-starlight] window.__ModuleLoader__ 缺失，客户端半部未加载')
    } catch (err) {}
    return
  }

  loader.load({
    id: 'dsh-prompt-starlight',
    factory: function (require) {
      var module = { exports: {} }
      var exports = module.exports
      Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

      var React = require('react')
      var reactDom = require('react-dom')
      var e = React.createElement

      // 署名水印：原样下发的客户端半部会出现在开发者工具里，fork 掉署名一眼可见。
      // 只打一次（HMR 重新物化模块时不重复），出错也绝不阻断加载。
      try {
        var globalScope = typeof globalThis !== 'undefined' ? globalThis : window
        if (globalScope.__starlightSigned !== true) {
          globalScope.__starlightSigned = true
          console.info(
            '%c星芒 · Starlit Sky%c  dsh-prompt-starlight 0.4.1 · AGPL-3.0 · github.com/Starlit-Sky-code/dsh-prompt-starlight',
            'color:#ff9d32;font-weight:600',
            'color:#8a8f98',
          )
        }
      } catch (err) {}

      /** 模块身份：样式回收、日志前缀都用它。 */
      var PKG = 'dsh-prompt-starlight'
      /** 宿主路由前缀，与 lib/index.js 保持一致。 */
      var ROUTE = '/dsh-starlight'
      /** composer 槽位条目 id。 */
      var ENTRY_ID = 'dsh-starlight'
      /** 设置页 section id（同时是导航项 id）。 */
      var SECTION_ID = 'starlight'
      /** 浮层宽度（用于贴边钳制）。 */
      var PANEL_WIDTH = 360
      /** 插件图标：由宿主路由下发（浏览器半部读不到本地文件）。 */
      var ICON_SRC = ROUTE + '/icon.png'
      /** 浮层收回动画的时长（与 CSS 里 dshsl-pop-out 对齐，留一点余量）。 */
      var CLOSE_ANIMATION_MS = 130

      /** 用户是否要求减少动效。 */
      function prefersReducedMotion() {
        try {
          return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
            ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
            : false
        } catch (error) {
          return false
        }
      }

      /* -------------------------------------------------------------- *
       * 语言
       * -------------------------------------------------------------- */

      function detectLocale() {
        try {
          var nav = String((typeof navigator !== 'undefined' && navigator.language) || '')
          if (/^zh/i.test(nav)) return 'zh'
          if (/^en/i.test(nav)) return 'en'
        } catch (err) {}
        try {
          var lang = String(document.documentElement.getAttribute('lang') || '')
          if (/^zh/i.test(lang)) return 'zh'
        } catch (err) {}
        return 'en'
      }

      var LOCALE = detectLocale()

      /**
       * 中英双语文案。
       * @param {string} zh 中文
       * @param {string} en 英文
       * @returns {string}
       */
      function t(zh, en) {
        return LOCALE === 'zh' ? zh : en
      }

      /** 取目录里 {zh,en} 形式的双语字段。 */
      function pick(value) {
        if (value == null) return ''
        if (typeof value === 'string') return value
        return LOCALE === 'zh' ? value.zh || value.en || '' : value.en || value.zh || ''
      }

      /* -------------------------------------------------------------- *
       * 样式
       * -------------------------------------------------------------- */

      var CSS = [
        '.dshsl-root{display:inline-flex;align-items:center;justify-content:center;flex:none}',
        // 圆形按钮：自带 1px 描边圈 + 柔和投影，把按钮从工具行里「托」出来
        '.dshsl-btn{position:relative;box-sizing:border-box;width:28px;height:28px;padding:0;border:none;border-radius:999px;',
        'display:inline-flex;align-items:center;justify-content:center;',
        'background:var(--dsw-alias-bg-layer-2,var(--dsw-alias-bg-base,#fff));',
        'color:var(--dsw-alias-label-secondary,#5f6570);',
        'cursor:pointer;outline:none;-webkit-tap-highlight-color:transparent;',
        // 外层三层：1px 描边圈 + 近距投影 + 远距扩散 = 「外包一圈」的浮起感
        'box-shadow:0 0 0 1px var(--dsw-alias-border-l3,rgba(127,127,127,.30)),',
        '0 1px 3px rgba(0,0,0,.10),0 4px 14px -6px rgba(0,0,0,.18);',
        'transition:box-shadow .18s ease,color .15s ease,transform .12s ease,background .15s ease}',
        '.dshsl-btn:hover:not(:disabled){color:var(--dsw-alias-state-business-primary,#4d6bfe);',
        // 悬停：描边圈变强调色，并向外扩出一圈 4px 光晕
        'box-shadow:0 0 0 1px var(--dsw-alias-state-business-primary,#4d6bfe),',
        '0 0 0 4px color-mix(in srgb,var(--dsw-alias-state-business-primary,#4d6bfe) 16%,transparent),',
        '0 4px 16px -6px color-mix(in srgb,var(--dsw-alias-state-business-primary,#4d6bfe) 55%,transparent)}',
        '.dshsl-btn:active:not(:disabled){transform:scale(.92)}',
        '.dshsl-btn:focus-visible{box-shadow:0 0 0 1px var(--dsw-alias-state-business-primary,#4d6bfe),',
        '0 0 0 4px color-mix(in srgb,var(--dsw-alias-state-business-primary,#4d6bfe) 22%,transparent)}',
        '.dshsl-btn:disabled{cursor:default;color:var(--dsw-alias-label-dimmed,#b3b7bd);',
        'box-shadow:0 0 0 1px var(--dsw-alias-border-l2,rgba(127,127,127,.18))}',
        '.dshsl-btn[data-state=busy]{color:var(--dsw-alias-state-business-primary,#4d6bfe);cursor:progress;',
        'box-shadow:0 0 0 1px var(--dsw-alias-state-business-primary,#4d6bfe),',
        '0 0 0 4px color-mix(in srgb,var(--dsw-alias-state-business-primary,#4d6bfe) 14%,transparent),',
        '0 4px 16px -6px color-mix(in srgb,var(--dsw-alias-state-business-primary,#4d6bfe) 45%,transparent)}',
        '.dshsl-btn[data-state=busy] .dshsl-star{animation:dshsl-spin 1.1s linear infinite}',
        '.dshsl-btn[data-state=error]{color:var(--dsw-alias-state-error-primary,#e5484d);',
        'box-shadow:0 0 0 1px color-mix(in srgb,var(--dsw-alias-state-error-primary,#e5484d) 70%,transparent),',
        '0 0 0 4px color-mix(in srgb,var(--dsw-alias-state-error-primary,#e5484d) 14%,transparent)}',
        '.dshsl-btn[data-state=done]{color:var(--dsw-alias-state-success-primary,#2f9e44);',
        'box-shadow:0 0 0 1px color-mix(in srgb,var(--dsw-alias-state-success-primary,#2f9e44) 70%,transparent),',
        '0 0 0 4px color-mix(in srgb,var(--dsw-alias-state-success-primary,#2f9e44) 14%,transparent)}',
        '@keyframes dshsl-spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}',
        '.dshsl-star{display:block;width:16px;height:16px;pointer-events:none}',
        // —— 浮层面板 ——
        '.dshsl-panel{position:fixed;z-index:2147400000;width:344px;max-height:min(620px,calc(100vh - 32px));overflow:hidden;',
        'display:flex;flex-direction:column;box-sizing:border-box;border-radius:var(--dsw-radius-panel,14px);',
        'background:var(--dsw-alias-menu-surface-fill,var(--dsw-alias-bg-layer-2,#fff));',
        'border:.5px solid var(--dsw-alias-border-l3,rgba(127,127,127,.22));',
        'box-shadow:var(--dsw-elevation-panel,0 12px 40px rgba(0,0,0,.22));',
        'color:var(--dsw-alias-label-primary,#111);font-size:13px;line-height:1.5;',
        'backdrop-filter:var(--dsw-menu-backdrop-filter,none)}',
        // 弹出 / 收回：transform-origin 落在按钮那侧（右下），像从按钮里长出来
        '.dshsl-panel{transform-origin:bottom right;animation:dshsl-pop-in .17s cubic-bezier(.2,.8,.3,1);',
        // 深色主题里面板底色与页面底色很接近，光靠阴影分不开：
        // 再叠一圈 1px 的亮/m暗内描边，把边界画出来
        'box-shadow:var(--dsw-elevation-panel,0 12px 40px rgba(0,0,0,.22)),',
        'inset 0 0 0 .5px var(--dsw-alias-border-l3,rgba(127,127,127,.24))}',
        '.dshsl-dialog-panel{box-shadow:var(--dsw-elevation-panel,0 18px 60px rgba(0,0,0,.32)),',
        'inset 0 0 0 .5px var(--dsw-alias-border-l3,rgba(127,127,127,.24))}',
        '.dshsl-panel[data-closing="1"]{animation:dshsl-pop-out .12s ease forwards;pointer-events:none}',
        '.dshsl-head{display:flex;align-items:center;gap:8px;padding:12px 14px 8px;flex:none}',
        '.dshsl-title{font-size:13px;font-weight:600;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
        '.dshsl-x{width:22px;height:22px;border:none;border-radius:6px;background:transparent;cursor:pointer;',
        'color:var(--dsw-alias-label-tertiary,#8a8f98);font-size:15px;line-height:1;padding:0;flex:none}',
        '.dshsl-x:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.14));color:var(--dsw-alias-label-primary,#111)}',
        '.dshsl-x{display:inline-flex;align-items:center;justify-content:center}',
        '.dshsl-gear{display:block;pointer-events:none}',
        '.dshsl-x[data-on="1"]{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.14));color:var(--dsw-alias-state-business-primary,#4d6bfe)}',
        '.dshsl-body{padding:0 14px 4px;overflow-y:auto;overscroll-behavior:contain;flex:1;min-height:0}',
        '.dshsl-row{margin:0 0 12px}',
        '.dshsl-label{display:block;font-size:11px;font-weight:600;letter-spacing:.02em;text-transform:uppercase;',
        'color:var(--dsw-alias-label-caption,#9aa0a6);margin:0 0 6px}',
        '.dshsl-seg{display:flex;flex-wrap:wrap;gap:4px}',
        '.dshsl-seg-item{border:.5px solid var(--dsw-alias-border-l3,rgba(127,127,127,.25));background:transparent;cursor:pointer;',
        'color:var(--dsw-alias-label-secondary,#5f6570);border-radius:999px;padding:3px 10px;font-size:12px;line-height:18px;',
        'transition:background .12s ease,color .12s ease,border-color .12s ease}',
        '.dshsl-seg-item:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.14))}',
        '.dshsl-seg-item[data-on="1"]{background:var(--dsw-alias-state-business-primary,#4d6bfe);border-color:transparent;color:#fff;font-weight:500}',
        '.dshsl-rules{display:flex;flex-direction:column;gap:2px}',
        '.dshsl-rule{display:flex;align-items:flex-start;gap:8px;padding:4px 6px;border-radius:7px;cursor:pointer}',
        '.dshsl-rule:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.1))}',
        // 复选框自绘：原生 checkbox 只有 accent-color 可调，
        // 未选中态在深色主题里会渲染成一块刺眼的白方，且两个主题观感不一致。
        '.dshsl-rule input[type=checkbox]{-webkit-appearance:none;appearance:none;box-sizing:border-box;',
        'width:14px;height:14px;margin:3px 0 0;border-radius:4px;cursor:pointer;flex:none;',
        'border:1.5px solid var(--dsw-alias-border-l3,rgba(127,127,127,.45));background:transparent;',
        'display:inline-grid;place-content:center;transition:background .12s,border-color .12s}',
        '.dshsl-rule input[type=checkbox]:hover{border-color:var(--dsw-alias-state-business-primary,#4d6bfe)}',
        '.dshsl-rule input[type=checkbox]:checked{background:var(--dsw-alias-state-business-primary,#4d6bfe);',
        'border-color:var(--dsw-alias-state-business-primary,#4d6bfe)}',
        '.dshsl-rule input[type=checkbox]:checked::after{content:"";width:7px;height:3.5px;',
        'border-left:1.8px solid #fff;border-bottom:1.8px solid #fff;transform:translateY(-1px) rotate(-45deg)}',
        '.dshsl-rule input[type=checkbox]:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,#4d6bfe);outline-offset:1px}',
        '.dshsl-rule-text{min-width:0;flex:1}',
        '.dshsl-rule-title{font-size:12.5px;line-height:18px}',
        '.dshsl-rule-note{font-size:11px;line-height:15px;color:var(--dsw-alias-label-caption,#9aa0a6)}',
        '.dshsl-ta{box-sizing:border-box;width:100%;min-height:54px;max-height:132px;resize:vertical;border-radius:8px;',
        'border:.5px solid var(--dsw-alias-border-l3,rgba(127,127,127,.25));background:var(--dsw-alias-bg-layer-1,transparent);',
        'color:var(--dsw-alias-label-primary,#111);font:inherit;font-size:12px;line-height:18px;padding:7px 9px;outline:none}',
        '.dshsl-ta:focus{border-color:var(--dsw-alias-state-business-primary,#4d6bfe)}',
        '.dshsl-foot{display:flex;align-items:center;gap:8px;padding:10px 14px 12px;flex:none;',
        'border-top:.5px solid var(--dsw-alias-border-l3,rgba(127,127,127,.18))}',
        '.dshsl-hint{flex:1;min-width:0;font-size:11px;line-height:15px;color:var(--dsw-alias-label-caption,#9aa0a6);overflow:hidden;text-overflow:ellipsis}',
        '.dshsl-btn2{border:.5px solid var(--dsw-alias-border-l3,rgba(127,127,127,.25));background:transparent;border-radius:7px;',
        'padding:5px 11px;font-size:12px;line-height:16px;cursor:pointer;color:var(--dsw-alias-label-secondary,#5f6570);white-space:nowrap}',
        '.dshsl-btn2:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.14))}',
        '.dshsl-btn2[data-primary="1"]{background:var(--dsw-alias-button-primary-fill,var(--dsw-alias-state-business-primary,#4d6bfe));',
        'border-color:transparent;color:var(--dsw-alias-label-primary-foreground,#fff);font-weight:500}',
        '.dshsl-btn2[data-primary="1"]:hover{filter:brightness(1.06)}',
        '.dshsl-btn2:disabled{opacity:.45;cursor:default}',
        '.dshsl-btn3{border:none;background:transparent;color:var(--dsw-alias-link,#4d6bfe);font:inherit;font-size:11px;',
        'line-height:16px;cursor:pointer;padding:0 4px;border-radius:4px}',
        '.dshsl-btn3:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.14))}',
        // 撤销提示条
        '.dshsl-toast{position:fixed;z-index:2147400001;display:flex;align-items:center;gap:10px;max-width:320px;',
        'padding:7px 10px;border-radius:10px;font-size:12px;line-height:17px;',
        'background:var(--dsw-alias-toast-bg,rgba(28,30,34,.94));color:var(--dsw-alias-toast-label,#fff);',
        'box-shadow:var(--dsw-elevation-prominent,0 8px 24px rgba(0,0,0,.28));animation:dshsl-in .16s ease}',
        '@keyframes dshsl-in{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}',
        '.dshsl-toast-text{flex:1;min-width:0;overflow-wrap:anywhere}',
        '.dshsl-toast-btn{border:none;background:transparent;color:var(--dsw-alias-state-business-primary,#8aa4ff);',
        'font:inherit;font-weight:600;cursor:pointer;padding:0;flex:none;text-decoration:underline}',
        '.dshsl-warn{color:var(--dsw-alias-state-warn-primary,#d17a00);font-size:11px;line-height:15px;margin:4px 0 0}',
        // —— 独立设置页 ——
        '.dshsl-page{display:flex;flex-direction:column;color:var(--dsw-alias-label-primary,#111);font-size:14px;line-height:22px;padding:2px 0 12px}',
        '.dshsl-page>section:last-of-type{margin-bottom:4px}',
        '.dshsl-page-h1{font-size:16px;font-weight:600;line-height:24px;margin:0}',
        '.dshsl-page-sub{color:var(--dsw-alias-label-secondary,#5f6570);font-size:12px;line-height:18px;margin:4px 0 8px}',
        '.dshsl-card{border-bottom:.5px solid var(--dsw-alias-border-l2,rgba(127,127,127,.18));padding:16px 0}',
        '.dshsl-card:last-of-type{border-bottom:none}',
        '.dshsl-card-head{display:flex;align-items:baseline;gap:10px;margin:0 0 2px}',
        '.dshsl-card-title{font-size:14px;font-weight:600;line-height:20px;margin:0;flex:1;min-width:0}',
        '.dshsl-card-desc{color:var(--dsw-alias-label-secondary,#5f6570);font-size:12px;line-height:18px;margin:0 0 10px}',
        '.dshsl-fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px 12px}',
        '.dshsl-field{min-width:0}',
        '.dshsl-field-label{display:block;font-size:11px;line-height:15px;color:var(--dsw-alias-label-caption,#9aa0a6);margin:0 0 4px}',
        '.dshsl-input{box-sizing:border-box;width:100%;height:30px;padding:0 9px;border-radius:8px;font:inherit;font-size:12px;',
        'border:.5px solid var(--dsw-alias-border-l3,rgba(127,127,127,.25));background:var(--dsw-alias-bg-layer-1,transparent);',
        'color:var(--dsw-alias-label-primary,#111);outline:none}',
        '.dshsl-input:focus{border-color:var(--dsw-alias-state-business-primary,#4d6bfe)}',
        '.dshsl-page .dshsl-rule-title{font-size:13px}',
        '.dshsl-page .dshsl-rule-note{font-size:11.5px}',
        '.dshsl-page .dshsl-ta{min-height:88px;font-size:12.5px}',
        // 页脚原来是「从透明渐变到 bg-base」：上半段全透明，滚动的正文会直接透出来
        // （深色主题下还和面板底色不一致）。改成近乎不透明 + 磨砂，内容不再露字。
        '.dshsl-page-foot{position:sticky;bottom:0;z-index:2;display:flex;align-items:center;gap:8px;padding:12px 0 6px;',
        'background:color-mix(in srgb,var(--dsw-alias-menu-surface-fill,var(--dsw-alias-bg-layer-2,#fff)) 96%,transparent);',
        'backdrop-filter:blur(10px);',
        'box-shadow:0 -1px 0 var(--dsw-alias-border-l2,rgba(127,127,127,.16))}',
        '.dshsl-status{flex:1;min-width:0;font-size:11.5px;line-height:16px;color:var(--dsw-alias-label-caption,#9aa0a6);',
        'overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
        '.dshsl-status[data-dirty="1"]{color:var(--dsw-alias-state-warn-primary,#d17a00)}',
        '.dshsl-path{font-family:var(--dsw-font-markdown-code-font-family,ui-monospace,monospace);font-size:11px;',
        'color:var(--dsw-alias-label-tertiary,#8a8f98);overflow-wrap:anywhere;margin:2px 0 0}',
        '.dshsl-badge{display:inline-block;margin-left:6px;padding:1px 6px;border-radius:999px;font-size:10px;line-height:14px;',
        'background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#2f9e44) 16%,transparent);',
        'color:var(--dsw-alias-state-success-primary,#2f9e44);vertical-align:1px}',
        // —— 界面细节：分组、选中项说明、骨架屏、头部、下拉框 ——
        '.dshsl-rules-grid{display:grid;grid-template-columns:1fr;gap:2px 18px}',
        '.dshsl-rules-grid[data-columns="2"]{grid-template-columns:1fr 1fr}',
        '.dshsl-rules-grid[data-compact="1"] .dshsl-rule{padding:3px 5px}',
        '.dshsl-rules-grid[data-compact="1"] .dshsl-rule-title{line-height:17px;font-size:12px}',
        '.dshsl-rules-grid[data-compact="1"] .dshsl-group-note{display:none}',
        '.dshsl-rules-grid[data-compact="1"] .dshsl-group{margin-top:7px}',
        '.dshsl-rules-grid[data-compact="1"] .dshsl-group:first-child{margin-top:0}',
        '.dshsl-group{grid-column:1/-1;display:flex;align-items:baseline;gap:8px;',
        'margin:10px 0 2px;padding:0 6px}',
        '.dshsl-group:first-child{margin-top:0}',
        '.dshsl-group-name{font-size:11px;font-weight:600;letter-spacing:.03em;text-transform:uppercase;',
        'color:var(--dsw-alias-label-caption,#9aa0a6)}',
        '.dshsl-group-note{font-size:11px;line-height:15px;color:var(--dsw-alias-label-tertiary,#8a8f98);',
        'min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
        '.dshsl-group-count{margin-left:auto;font-size:10.5px;line-height:14px;color:var(--dsw-alias-label-caption,#9aa0a6);flex:none}',
        '.dshsl-seg-note{margin:6px 0 0;min-height:15px;font-size:11.5px;line-height:15px;color:var(--dsw-alias-label-caption,#9aa0a6)}',
        // —— 模型选择：形态对齐 DSH 原生设置行（左标签 / 右值 / 箭头，点开在下方展开）——
        '.dshsl-field{margin:0 0 10px}',
        '.dshsl-picker{border-radius:10px;background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.08)));',
        'box-shadow:inset 0 0 0 .5px var(--dsw-alias-border-l2,rgba(127,127,127,.16));overflow:hidden}',
        '.dshsl-picker-row{display:flex;align-items:center;gap:8px;width:100%;box-sizing:border-box;',
        'border:none;background:transparent;cursor:pointer;font:inherit;font-size:12.5px;color:var(--dsw-alias-label-primary,#111);',
        'padding:9px 10px;text-align:left}',
        '.dshsl-picker-row:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.14))}',
        '.dshsl-picker-row:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,#4d6bfe);outline-offset:-2px}',
        '.dshsl-picker-label{flex:none;font-weight:600}',
        '.dshsl-picker-row[data-bare="1"] .dshsl-picker-value{text-align:left;color:var(--dsw-alias-label-primary,#111)}',
        '.dshsl-picker-value{flex:1;min-width:0;text-align:right;color:var(--dsw-alias-label-secondary,#5f6570);',
        'overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
        '.dshsl-picker-caret{flex:none;font-size:12px;line-height:1;color:var(--dsw-alias-label-tertiary,#8a8f98);',
        'transition:transform .16s ease}',
        '.dshsl-picker[data-open="1"] .dshsl-picker-caret{transform:rotate(90deg)}',
        '.dshsl-picker-list{border-top:.5px solid var(--dsw-alias-border-l2,rgba(127,127,127,.16));',
        'max-height:214px;overflow-y:auto;overscroll-behavior:contain;animation:dshsl-expand .16s ease}',
        '@keyframes dshsl-expand{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}',
        '.dshsl-option{display:flex;align-items:center;gap:8px;width:100%;box-sizing:border-box;',
        'border:none;background:transparent;cursor:pointer;font:inherit;font-size:12.5px;line-height:17px;',
        'color:var(--dsw-alias-label-primary,#111);padding:8px 10px;text-align:left}',
        '.dshsl-option:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.14))}',
        '.dshsl-option:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,#4d6bfe);outline-offset:-2px}',
        '.dshsl-option[data-on="1"]{color:var(--dsw-alias-state-business-primary,#4d6bfe);font-weight:600}',
        '.dshsl-option-check{flex:none;width:11px;font-size:11px;color:var(--dsw-alias-state-business-primary,#4d6bfe);text-align:center}',
        '.dshsl-option-main{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
        '.dshsl-option-sub{flex:none;max-width:45%;font-size:11px;color:var(--dsw-alias-label-caption,#9aa0a6);',
        'overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
        '.dshsl-link-row{display:flex;align-items:center;gap:8px;width:100%;box-sizing:border-box;',
        'border:none;background:transparent;cursor:pointer;font:inherit;font-size:12px;line-height:17px;',
        'color:var(--dsw-alias-label-secondary,#5f6570);padding:6px 6px;border-radius:7px;text-align:left;margin:0 0 8px}',
        '.dshsl-link-row:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.14));',
        'color:var(--dsw-alias-label-primary,#111)}',
        '.dshsl-link-row:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,#4d6bfe);outline-offset:-2px}',
        '.dshsl-link-row-text{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
        '.dshsl-link-row-go{flex:none;color:var(--dsw-alias-label-tertiary,#8a8f98)}',
        '.dshsl-option-reload{color:var(--dsw-alias-label-secondary,#5f6570);font-size:11.5px;padding-top:6px;padding-bottom:6px}',
        // 淡入 / 淡出：从按钮方向长出来，收回时缩回去
        '@keyframes dshsl-pop-in{from{opacity:0;transform:translateY(8px) scale(.965)}to{opacity:1;transform:none}}',
        '@keyframes dshsl-pop-out{from{opacity:1;transform:none}to{opacity:0;transform:translateY(6px) scale(.975)}}',
        // —— 标签页 ——
        '.dshsl-tabs{display:flex;gap:2px;margin:0 0 14px;padding:2px;border-radius:9px;',
        'background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.08)))}',
        '.dshsl-tab{flex:1;border:none;background:transparent;cursor:pointer;font:inherit;font-size:12.5px;',
        'line-height:24px;padding:2px 10px;border-radius:7px;color:var(--dsw-alias-label-secondary,#5f6570)}',
        '.dshsl-tab:hover{color:var(--dsw-alias-label-primary,#111)}',
        '.dshsl-tab[data-on="1"]{background:var(--dsw-alias-bg-layer-2,#fff);color:var(--dsw-alias-label-primary,#111);',
        'font-weight:600;box-shadow:0 1px 2px rgba(0,0,0,.10)}',
        '.dshsl-tab:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,#4d6bfe);outline-offset:-2px}',
        // —— 技能市场（只读）——
        '.dshsl-market-search{display:flex;gap:8px;margin:0 0 10px}',
        '.dshsl-market-search .dshsl-input{flex:1;min-width:0}',
        '.dshsl-skills{display:flex;flex-direction:column;gap:8px}',
        '.dshsl-skill{border:.5px solid var(--dsw-alias-border-l2,rgba(127,127,127,.16));border-radius:10px;padding:10px 11px;',
        'background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.06)))}',
        '.dshsl-skill-head{display:flex;align-items:center;gap:8px;margin:0 0 2px}',
        '.dshsl-skill-name{font-size:12.5px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
        '.dshsl-skill-stat{margin-left:auto;flex:none;font-size:11px;color:var(--dsw-alias-label-caption,#9aa0a6)}',
        '.dshsl-skill-author{margin:0;font-size:11px;color:var(--dsw-alias-label-caption,#9aa0a6)}',
        '.dshsl-skill-summary{margin:4px 0 0;font-size:11.5px;line-height:16px;color:var(--dsw-alias-label-secondary,#5f6570);',
        'display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}',
        '.dshsl-skill-actions{display:flex;align-items:center;gap:8px;margin:8px 0 0}',
        '.dshsl-skill-ref{flex:1;min-width:0;font-family:var(--dsw-font-markdown-code-font-family,ui-monospace,monospace);',
        'font-size:11px;color:var(--dsw-alias-label-tertiary,#8a8f98);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
        '.dshsl-skill-link{flex:none;font-size:11.5px;color:var(--dsw-alias-link,#4d6bfe);text-decoration:none}',
        '.dshsl-skill-link:hover{text-decoration:underline}',
        // —— 独立设置窗口 ——
        '.dshsl-dialog{position:fixed;inset:0;z-index:2147400100;display:flex;align-items:center;justify-content:center;',
        'padding:24px;box-sizing:border-box}',
        '.dshsl-dialog-backdrop{position:absolute;inset:0;background:rgba(0,0,0,.42);',
        'animation:dshsl-fade-in .16s ease}',
        '.dshsl-dialog-panel{position:relative;display:flex;flex-direction:column;box-sizing:border-box;',
        'width:min(760px,100%);max-height:min(84vh,860px);overflow:hidden;outline:none;',
        'border-radius:var(--dsw-radius-panel,14px);border:.5px solid var(--dsw-alias-border-l3,rgba(127,127,127,.22));',
        'background:var(--dsw-alias-menu-surface-fill,var(--dsw-alias-bg-layer-2,#fff));',
        'box-shadow:var(--dsw-elevation-panel,0 18px 60px rgba(0,0,0,.32));',
        'color:var(--dsw-alias-label-primary,#111);font-size:13px;line-height:1.5;',
        'animation:dshsl-dialog-in .18s cubic-bezier(.2,.8,.3,1)}',
        '.dshsl-dialog-body{padding:0 18px 6px;overflow-y:auto;overscroll-behavior:contain;flex:1;min-height:0}',
        '.dshsl-dialog-note{padding:6px 0 12px}',
        '@keyframes dshsl-fade-in{from{opacity:0}to{opacity:1}}',
        '@keyframes dshsl-dialog-in{from{opacity:0;transform:translateY(10px) scale(.985)}to{opacity:1;transform:none}}',
        '.dshsl-hero{display:flex;align-items:flex-start;gap:11px;margin:0 0 10px}',
        '.dshsl-hero-badge{flex:none;width:34px;height:34px;border-radius:11px;display:flex;align-items:center;justify-content:center;',
        'color:var(--dsw-alias-state-business-primary,#4d6bfe);background:color-mix(in srgb,var(--dsw-alias-state-business-primary,#4d6bfe) 12%,transparent);',
        'box-shadow:0 0 0 1px color-mix(in srgb,var(--dsw-alias-state-business-primary,#4d6bfe) 26%,transparent)}',
        '.dshsl-hero-text{min-width:0;flex:1}',
        '.dshsl-pill{display:inline-flex;align-items:center;gap:5px;margin-left:8px;padding:1px 8px;border-radius:999px;',
        'font-size:10.5px;line-height:16px;font-weight:500;vertical-align:2px;',
        'background:color-mix(in srgb,var(--dsw-alias-label-caption,#9aa0a6) 14%,transparent);color:var(--dsw-alias-label-secondary,#5f6570)}',
        '.dshsl-pill[data-tone="warn"]{background:color-mix(in srgb,var(--dsw-alias-state-warn-primary,#d17a00) 16%,transparent);',
        'color:var(--dsw-alias-state-warn-primary,#d17a00)}',
        '.dshsl-pill[data-tone="ok"]{background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#2f9e44) 16%,transparent);',
        'color:var(--dsw-alias-state-success-primary,#2f9e44)}',
        '.dshsl-skel{display:flex;flex-direction:column;gap:10px;padding:8px 0}',
        '.dshsl-skel-bar{height:12px;border-radius:6px;background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.12));',
        'animation:dshsl-pulse 1.4s ease-in-out infinite}',
        '@keyframes dshsl-pulse{0%,100%{opacity:.55}50%{opacity:1}}',
        '.dshsl-divider{height:1px;margin:10px 0;background:var(--dsw-alias-border-l2,rgba(127,127,127,.16))}',
        '.dshsl-toast-star{flex:none;color:var(--dsw-alias-state-business-primary,#8aa4ff);display:flex}',
        '.dshsl-models-note{margin:6px 0 0;font-size:11px;line-height:15px;color:var(--dsw-alias-label-caption,#9aa0a6)}',
        // —— 品牌：强调色取自作品里那颗四角星，只用在滑块与选中刻度上 ——
        '.dshsl-root,.dshsl-panel,.dshsl-page{--dshsl-accent:#ff9d32}',
        '.dshsl-icon{width:22px;height:22px;border-radius:7px;object-fit:cover;flex:none;display:block;',
        'box-shadow:0 0 0 1px var(--dsw-alias-border-l3,rgba(127,127,127,.3))}',
        '.dshsl-icon-lg{width:40px;height:40px;border-radius:13px}',
        // —— 滑块：主调节手段 ——
        '.dshsl-slider{margin:0 0 12px}',
        '.dshsl-slider:last-child{margin-bottom:0}',
        '.dshsl-slider-head{display:flex;align-items:baseline;gap:8px;margin-bottom:1px}',
        '.dshsl-slider-label{font-size:11px;font-weight:600;letter-spacing:.02em;text-transform:uppercase;',
        'color:var(--dsw-alias-label-caption,#9aa0a6)}',
        '.dshsl-slider-value{margin-left:auto;font-size:12.5px;font-weight:600;color:var(--dsw-alias-label-primary,#111)}',
        '.dshsl-range{display:block;width:100%;height:18px;margin:0;cursor:pointer;background:transparent;',
        'appearance:none;-webkit-appearance:none}',
        '.dshsl-range:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,#4d6bfe);outline-offset:2px;border-radius:6px}',
        // 轨道显式上色：已填充段用品牌色，未填充段用中性底色。
        // 不依赖 accent-color / 系统色，亮暗主题都能看；填充比例由 --dshsl-fill 传入。
        '.dshsl-range::-webkit-slider-runnable-track{height:4px;border-radius:999px;',
        'background:linear-gradient(to right,var(--dshsl-accent,#ff9d32) 0 var(--dshsl-fill,0%),',
        'var(--dsw-alias-interactive-bg-active,rgba(127,127,127,.22)) var(--dshsl-fill,0%) 100%)}',
        '.dshsl-range::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:14px;height:14px;',
        'margin-top:-5px;border-radius:999px;border:2px solid var(--dsw-alias-bg-layer-2,#fff);',
        'background:var(--dshsl-accent,#ff9d32);box-shadow:0 1px 3px rgba(0,0,0,.28);cursor:grab}',
        '.dshsl-range:active::-webkit-slider-thumb{cursor:grabbing;transform:scale(1.08)}',
        '.dshsl-ticks{display:flex;gap:2px;margin-top:-1px;font-size:9.5px;line-height:13px;',
        'color:var(--dsw-alias-label-dimmed,#b3b7bd)}',
        '.dshsl-tick{flex:1;min-width:0;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;',
        'transition:color .12s,font-weight .12s}',
        '.dshsl-tick[data-on="1"]{color:var(--dshsl-accent,#ff9d32);font-weight:700}',
        '.dshsl-slider-note{margin:3px 0 0;font-size:11px;line-height:15px;color:var(--dsw-alias-label-caption,#9aa0a6);',
        'min-height:15px}',
        // —— 折叠「更多」 ——
        '.dshsl-more{border-top:.5px solid var(--dsw-alias-border-l2,rgba(127,127,127,.16));margin-top:10px;padding-top:2px}',
        '.dshsl-more-head{display:flex;align-items:center;gap:8px;width:100%;box-sizing:border-box;text-align:left;',
        'border:none;background:transparent;cursor:pointer;font:inherit;font-size:12px;line-height:18px;',
        'color:var(--dsw-alias-label-secondary,#5f6570);padding:7px 6px;border-radius:8px}',
        '.dshsl-more-head:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.14))}',
        '.dshsl-caret{display:inline-block;width:10px;flex:none;color:var(--dsw-alias-label-tertiary,#8a8f98);',
        'transition:transform .15s;font-size:10px}',
        '.dshsl-more[data-open="1"] .dshsl-caret{transform:rotate(90deg)}',
        '.dshsl-more-sum{margin-left:auto;font-size:11px;color:var(--dsw-alias-label-caption,#9aa0a6);',
        'overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
        '.dshsl-more-body{padding:4px 0 2px}',
        '.dshsl-more-body>.dshsl-row:first-child{margin-top:2px}',
        '@media (prefers-reduced-motion: reduce){',
        '.dshsl-caret{transition:none}',
        '.dshsl-tick{transition:none}',
        '.dshsl-picker-caret{transition:none}',
        '.dshsl-panel,.dshsl-panel[data-closing="1"],.dshsl-picker-list{animation:none}',
        '.dshsl-dialog-panel,.dshsl-dialog-backdrop{animation:none}',
        '.dshsl-btn[data-state=busy] .dshsl-star{animation:none}',
        '.dshsl-skel-bar{animation:none;opacity:.7}',
        '.dshsl-toast{animation:none}}',
      ].join('')

      function injectStyle() {
        if (typeof document === 'undefined') return
        if (document.querySelector('style[data-plugin-css="' + PKG + '/client.css"]') !== null) return
        var tag = document.createElement('style')
        tag.dataset.plugin = PKG
        tag.dataset.pluginCss = PKG + '/client.css'
        tag.textContent = CSS
        document.head.appendChild(tag)
      }

      /* -------------------------------------------------------------- *
       * 宿主 API
       * -------------------------------------------------------------- */

      async function requestJson(path, init) {
        var response = await fetch(ROUTE + path, {
          method: (init && init.method) || 'GET',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: init && init.body !== undefined ? JSON.stringify(init.body) : undefined,
        })
        var payload = null
        try {
          payload = await response.json()
        } catch (err) {
          payload = null
        }
        if (payload === null) {
          throw new Error(t('宿主返回了非 JSON 响应', 'host returned a non-JSON response'))
        }
        if (payload.ok === false) {
          var message = payload.error && payload.error.message ? payload.error.message : t('请求失败', 'request failed')
          var error = new Error(message)
          error.code = (payload.error && payload.error.code) || 'failed'
          throw error
        }
        return payload
      }

      /* -------------------------------------------------------------- *
       * 草稿桥接
       * -------------------------------------------------------------- */

      /** 从输入面板 facade 里读出草稿快照存储。 */
      function snapshotOf(handle) {
        if (!handle || !handle.state) return null
        if (typeof handle.state.getSnapshot !== 'function' || typeof handle.state.subscribe !== 'function') return null
        return handle.state
      }

      function draftOf(handle) {
        var store = snapshotOf(handle)
        if (store === null) return ''
        try {
          var snapshot = store.getSnapshot()
          return snapshot && typeof snapshot.draft === 'string' ? snapshot.draft : ''
        } catch (err) {
          return ''
        }
      }

      /** 回填草稿：优先 facade 的 setDraft，再退到 actions 通道。 */
      function writeDraft(handle, text) {
        if (!handle) return false
        try {
          if (typeof handle.setDraft === 'function') {
            handle.setDraft(text)
            return true
          }
        } catch (err) {}
        try {
          if (handle.actions && typeof handle.actions.setDraft === 'function') {
            handle.actions.setDraft(text)
            return true
          }
        } catch (err) {}
        return false
      }

      function focusComposer(handle) {
        try {
          if (typeof handle.focus === 'function') handle.focus()
        } catch (err) {}
      }

      /** 订阅草稿内容。 */
      function useDraft(handle) {
        var store = snapshotOf(handle)
        var subscribe = React.useCallback(
          function (onChange) {
            if (store === null) return function () {}
            try {
              var off = store.subscribe(onChange)
              return typeof off === 'function' ? off : function () {}
            } catch (err) {
              return function () {}
            }
          },
          [store],
        )
        var getSnapshot = React.useCallback(
          function () {
            return draftOf(handle)
          },
          [handle, store],
        )
        return React.useSyncExternalStore(subscribe, getSnapshot, function () {
          return ''
        })
      }

      /* -------------------------------------------------------------- *
       * 图标
       * -------------------------------------------------------------- */

      /**
       * 齿轮图标。
       * 不用文字符号 ⚙：在很多字体里它被渲染成一个小圆圈，读者认不出那是设置。
       * 描边画法在 14–16px 下仍然清晰。
       */
      function GearIcon(props) {
        var size = props && props.size ? props.size : 15
        return e(
          'svg',
          {
            className: 'dshsl-gear',
            viewBox: '0 0 24 24',
            width: size,
            height: size,
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: 1.9,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            'aria-hidden': 'true',
            focusable: 'false',
          },
          e('circle', { cx: 12, cy: 12, r: 3.1 }),
          e('path', {
            d: 'M19.1 14.6a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.55V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1.03H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.55-1.1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1.03-1.55V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1.03 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9a1.7 1.7 0 0 0 1.55 1.03H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.55 1.03z',
          }),
        )
      }

      /** 四角星（四尖、内凹）：按钮图标，也是图片加载失败时的兜底。 */
      function StarIcon(props) {
        return e(
          'svg',
          {
            className: 'dshsl-star',
            viewBox: '0 0 24 24',
            width: props && props.size ? props.size : 16,
            height: props && props.size ? props.size : 16,
            'aria-hidden': 'true',
            focusable: 'false',
          },
          e('path', {
            fill: 'currentColor',
            d: 'M12 1.6 14.34 9.66 22.4 12 14.34 14.34 12 22.4 9.66 14.34 1.6 12 9.66 9.66Z',
          }),
        )
      }

      /**
       * 插件自己的图标（作品里的那个角色）。
       * 图片走宿主路由；拿不到就退回四角星，绝不出现破图。
       * @param {{ size?: number }} props
       */
      function ProIcon(props) {
        var size = props && props.size ? props.size : 22
        var [failed, setFailed] = React.useState(false)
        var cls = size >= 32 ? 'dshsl-icon dshsl-icon-lg' : 'dshsl-icon'
        if (failed) {
          return e('span', { className: cls, style: { display: 'grid', placeItems: 'center', color: 'var(--dshsl-accent)' } }, e(StarIcon, { size: Math.round(size * 0.6) }))
        }
        return e('img', {
          className: cls,
          src: ICON_SRC,
          width: size,
          height: size,
          alt: '',
          'aria-hidden': 'true',
          draggable: 'false',
          onError: function () {
            setFailed(true)
          },
        })
      }

      /* -------------------------------------------------------------- *
       * 配置状态（浮层与设置页共用同一套读写逻辑）
       * -------------------------------------------------------------- */

      /** 把保存请求要提交的字段整理出来（浮层与设置页同一套）。 */
      function bodyOf(config, customText) {
        return {
          enabled: config.enabled !== false,
          verbosity: config.verbosity,
          lens: config.lens,
          locale: config.locale,
          depth: config.depth,
          disabledRules: config.disabledRules || [],
          customRules: String(customText || '')
            .split('\n')
            .map(function (line) {
              return line.trim()
            })
            .filter(Boolean),
          provider: String(config.provider || '').trim(),
          model: String(config.model || '').trim(),
          maxTokens: Number(config.maxTokens),
          temperature: Number(config.temperature),
          timeoutMs: Number(config.timeoutMs),
        }
      }

      /** 比较「当前编辑稿」和「已保存稿」是否有差别。 */
      function isDirty(config, customText, saved) {
        if (!config || !saved) return false
        return JSON.stringify(bodyOf(config, customText)) !== JSON.stringify(bodyOf(saved, (saved.customRules || []).join('\n')))
      }

      /**
       * 规则配置状态机：加载 / 编辑 / 保存 / 恢复默认。
       * 浮层和设置页都调用它，因此两处的行为不会漂移。
       * @returns {object} 状态与动作
       */
      function useRulesConfig() {
        var [manifest, setManifest] = React.useState(null)
        var [saved, setSaved] = React.useState(null)
        var [config, setConfig] = React.useState(null)
        var [customText, setCustomText] = React.useState('')
        var [error, setError] = React.useState('')
        var [busy, setBusy] = React.useState(false)
        var [notice, setNotice] = React.useState('')

        var adopt = React.useCallback(function (payload) {
          setManifest(payload)
          setSaved(payload.config)
          setConfig(payload.config)
          setCustomText((payload.config.customRules || []).join('\n'))
        }, [])

        var reload = React.useCallback(
          function () {
            setError('')
            return requestJson('/manifest')
              .then(function (payload) {
                adopt(payload)
                return payload
              })
              .catch(function (err) {
                setError(String((err && err.message) || err))
                return null
              })
          },
          [adopt],
        )

        React.useEffect(
          function () {
            var alive = true
            requestJson('/manifest')
              .then(function (payload) {
                if (alive) adopt(payload)
              })
              .catch(function (err) {
                if (alive) setError(String((err && err.message) || err))
              })
            return function () {
              alive = false
            }
          },
          [adopt],
        )

        var patch = React.useCallback(function (change) {
          setConfig(function (previous) {
            return previous === null ? previous : Object.assign({}, previous, change)
          })
          setNotice('')
        }, [])

        var toggleRule = React.useCallback(
          function (id, enabled) {
            setConfig(function (previous) {
              if (previous === null) return previous
              var disabled = previous.disabledRules || []
              var next = enabled
                ? disabled.filter(function (entry) {
                    return entry !== id
                  })
                : disabled.indexOf(id) >= 0
                  ? disabled
                  : disabled.concat([id])
              return Object.assign({}, previous, { disabledRules: next })
            })
            setNotice('')
          },
          [],
        )

        /** 一次性开关某组规则（全开 / 全关）。 */
        var toggleMany = React.useCallback(function (ids, enabled) {
          setConfig(function (previous) {
            if (previous === null) return previous
            var set = {}
            ids.forEach(function (id) {
              set[id] = true
            })
            var disabled = (previous.disabledRules || []).filter(function (entry) {
              return set[entry] !== true
            })
            return Object.assign({}, previous, { disabledRules: enabled ? disabled : disabled.concat(Object.keys(set)) })
          })
          setNotice('')
        }, [])

        var save = React.useCallback(
          function () {
            if (config === null) return Promise.resolve(null)
            setBusy(true)
            setError('')
            return requestJson('/config', { method: 'POST', body: bodyOf(config, customText) })
              .then(function (payload) {
                adopt(payload)
                setNotice(t('已保存', 'Saved'))
                return payload
              })
              .catch(function (err) {
                setError(String((err && err.message) || err))
                return null
              })
              .then(function (result) {
                setBusy(false)
                return result
              })
          },
          [adopt, config, customText],
        )

        var restore = React.useCallback(
          function () {
            setBusy(true)
            setError('')
            return requestJson('/reset', { method: 'POST', body: {} })
              .then(function (payload) {
                adopt(payload)
                setNotice(t('已恢复默认规则', 'Restored defaults'))
                return payload
              })
              .catch(function (err) {
                setError(String((err && err.message) || err))
                return null
              })
              .then(function (result) {
                setBusy(false)
                return result
              })
          },
          [adopt],
        )

        var dirty = isDirty(config, customText, saved)

        return {
          manifest: manifest,
          config: config,
          customText: customText,
          setCustomText: function (value) {
            setCustomText(value)
            setNotice('')
          },
          error: error,
          busy: busy,
          notice: notice,
          dirty: dirty,
          patch: patch,
          toggleRule: toggleRule,
          toggleMany: toggleMany,
          save: save,
          restore: restore,
          reload: reload,
        }
      }

      /* -------------------------------------------------------------- *
       * 可复用的编辑器片段
       * -------------------------------------------------------------- */

      /**
       * 分段选择器。选中项的解释文字显示在下方——原来只藏在 title 里，
       * 用户得悬停才知道每档是什么意思。
       */
      function Segmented(props) {
        var selected = null
        for (var i = 0; i < props.items.length; i += 1) {
          if (props.items[i].id === props.value) {
            selected = props.items[i]
            break
          }
        }
        return e(
          'div',
          null,
          e(
            'div',
            { className: 'dshsl-seg', role: 'group', 'aria-label': props.label },
            props.items.map(function (item) {
              var on = item.id === props.value
              return e(
                'button',
                {
                  key: item.id,
                  type: 'button',
                  className: 'dshsl-seg-item',
                  'data-on': on ? '1' : '0',
                  title: pick(item.note),
                  'aria-pressed': on,
                  onClick: function () {
                    props.onChange(item.id)
                  },
                },
                pick(item.label),
              )
            }),
          ),
          props.showNote === false
            ? null
            : e('p', { className: 'dshsl-seg-note' }, selected ? pick(selected.note) : ''),
        )
      }

      /**
       * 滑块：把一列有序档位映射成一根 range。
       * 用户要「用滑块直接调」——这里的档位是真的（强度 5 档、详细度 3 档），
       * 不是把 3 档硬凑成 5 格。
       * @param {{ label: string, items: Array, value: string, onChange: (id: string) => void, showNote?: boolean }} props
       */
      function Slider(props) {
        var items = props.items || []
        if (items.length === 0) return null
        var index = 0
        for (var i = 0; i < items.length; i += 1) {
          if (items[i].id === props.value) {
            index = i
            break
          }
        }
        var current = items[index] || items[0]
        var filled = items.length > 1 ? Math.round((index / (items.length - 1)) * 100) + '%' : '0%'
        return e(
          'div',
          { className: 'dshsl-slider' },
          e(
            'div',
            { className: 'dshsl-slider-head' },
            e('span', { className: 'dshsl-slider-label' }, props.label),
            e('span', { className: 'dshsl-slider-value' }, pick(current.label)),
          ),
          e('input', {
            className: 'dshsl-range',
            type: 'range',
            min: 0,
            max: items.length - 1,
            step: 1,
            value: index,
            'aria-label': props.label,
            'aria-valuetext': pick(current.label),
            'data-slider': props.name || '',
            style: { '--dshsl-fill': filled },
            onChange: function (event) {
              var next = items[Number(event.target.value)]
              if (next) props.onChange(next.id)
            },
          }),
          e(
            'div',
            { className: 'dshsl-ticks', 'aria-hidden': 'true' },
            items.map(function (item) {
              return e('span', { key: item.id, className: 'dshsl-tick', 'data-on': item.id === props.value ? '1' : '0' }, pick(item.label))
            }),
          ),
          props.showNote === false ? null : e('p', { className: 'dshsl-slider-note' }, pick(current.note)),
        )
      }

      /**
       * 折叠区：默认收起，只在需要时才展开，避免一上来就一堆设置项。
       * @param {{ title: string, summary?: string, defaultOpen?: boolean, children?: any }} props
       */
      function More(props) {
        var [open, setOpen] = React.useState(props.defaultOpen === true)
        return e(
          'div',
          { className: 'dshsl-more', 'data-open': open ? '1' : '0' },
          e(
            'button',
            {
              type: 'button',
              className: 'dshsl-more-head',
              'aria-expanded': open,
              onClick: function () {
                setOpen(function (previous) {
                  return !previous
                })
              },
            },
            e('span', { className: 'dshsl-caret', 'aria-hidden': 'true' }, '▶'),
            e('span', null, props.title),
            props.summary ? e('span', { className: 'dshsl-more-sum' }, props.summary) : null,
          ),
          open ? e('div', { className: 'dshsl-more-body' }, props.children) : null,
        )
      }

      /** 目录字段防御：宿主版本不一致时不要因为缺数组就整块崩掉。 */
      function listOf(manifest, key) {
        return manifest && Array.isArray(manifest[key]) ? manifest[key] : []
      }

      /** 从目录里取某项的显示名，取不到返回空串。 */
      function labelOf(items, id) {
        for (var i = 0; i < items.length; i += 1) {
          if (items[i].id === id) return pick(items[i].label)
        }
        return ''
      }

      /**
       * 内置规则勾选列表。
       * groups 有值时按 RULE_GROUPS 分组、宽屏两列；没有时退化成平铺单列。
       */
      function RuleList(props) {
        var disabledSet = {}
        ;((props.config && props.config.disabledRules) || []).forEach(function (id) {
          disabledSet[id] = true
        })

        // compact：只画标题，说明转为 title 提示。浮层只有 360px 宽，
        // 每条规则再挂一行说明会把展开区撑到需要滚动。
        var compact = props.compact === true

        var renderRule = function (rule) {
          return e(
            'label',
            {
              key: rule.id,
              className: 'dshsl-rule',
              'data-compact': compact ? '1' : '0',
              title: compact ? pick(rule.note) : undefined,
            },
            e('input', {
              type: 'checkbox',
              checked: !disabledSet[rule.id],
              onChange: function (event) {
                props.onToggle(rule.id, event.target.checked)
              },
            }),
            e(
              'span',
              { className: 'dshsl-rule-text' },
              e('span', { className: 'dshsl-rule-title' }, pick(rule.title)),
              compact
                ? null
                : e('span', { className: 'dshsl-rule-note', style: { display: 'block' } }, pick(rule.note)),
            ),
          )
        }

        var groups = props.groups
        if (!Array.isArray(groups) || groups.length === 0) {
          return e('div', { className: 'dshsl-rules', 'data-dshsl-rules': '' }, (props.rules || []).map(renderRule))
        }

        var children = []
        groups.forEach(function (group) {
          var members = (props.rules || []).filter(function (rule) {
            return rule.group === group.id
          })
          if (members.length === 0) return
          var on = members.filter(function (rule) {
            return !disabledSet[rule.id]
          }).length
          children.push(
            e(
              'div',
              { key: 'group:' + group.id, className: 'dshsl-group' },
              e('span', { className: 'dshsl-group-name' }, pick(group.label)),
              e('span', { className: 'dshsl-group-note', title: pick(group.note) }, pick(group.note)),
              e('span', { className: 'dshsl-group-count' }, on + '/' + members.length),
            ),
          )
          for (var index = 0; index < members.length; index += 1) {
            children.push(renderRule(members[index]))
          }
        })

        return e(
          'div',
          { className: 'dshsl-rules-grid', 'data-dshsl-rules': '', 'data-columns': props.columns === 2 ? '2' : '1', 'data-compact': compact ? '1' : '0' },
          children,
        )
      }

      /** 自定义规则文本域。 */
      function CustomRulesField(props) {
        return e('textarea', {
          className: 'dshsl-ta',
          value: props.value,
          spellCheck: false,
          placeholder: t(
            '例如：\n输出必须包含「验收标准」小节\n不要使用「请确保」这类空话',
            'e.g.\nAlways include an Acceptance section\nNever use filler like "please make sure"',
          ),
          onChange: function (event) {
            props.onChange(event.target.value)
          },
        })
      }

      /** 启用开关（浮层与设置页共用一行）。 */
      function EnabledToggle(props) {
        return e(
          'label',
          { className: 'dshsl-rule' },
          e('input', {
            type: 'checkbox',
            checked: props.config.enabled !== false,
            onChange: function (event) {
              props.onPatch({ enabled: event.target.checked })
            },
          }),
          e(
            'span',
            { className: 'dshsl-rule-text' },
            e('span', { className: 'dshsl-rule-title' }, t('启用星芒按钮', 'Enable the starlight button')),
            e(
              'span',
              { className: 'dshsl-rule-note', style: { display: 'block' } },
              t('关闭后按钮只做本地格式整理，不调用模型', 'When off, the button only tidies formatting and never calls a model'),
            ),
          ),
        )
      }

      /* -------------------------------------------------------------- *
       * 模型切换
       * -------------------------------------------------------------- */

      /** 「跟随会话」在选择值里的编码：空字符串表示不覆盖。 */
      var MODEL_FOLLOW = ''
      /** provider 与 model 之间的分隔符（两者都不可能出现这个控制字符）。 */
      var MODEL_SEP = '\u001f'

      function encodeRoute(provider, model) {
        if (!provider || !model) return MODEL_FOLLOW
        return provider + MODEL_SEP + model
      }

      function decodeRoute(value) {
        if (typeof value !== 'string' || value === '') return { provider: '', model: '' }
        var at = value.indexOf(MODEL_SEP)
        if (at < 0) return { provider: '', model: '' }
        return { provider: value.slice(0, at), model: value.slice(at + 1) }
      }

      /**
       * 拉取宿主可用模型目录。
       * 单独一条请求而不是塞进 /manifest：listModels 可能打网络，
       * 目录慢或失败不该拖住规则面板的渲染。
       */
      function useModelCatalog() {
        var [state, setState] = React.useState({
          status: 'loading', // loading | ready | error
          models: [],
          errors: [],
          fallback: null,
          message: '',
        })

        var load = React.useCallback(function (force) {
          setState(function (previous) {
            return Object.assign({}, previous, { status: 'loading' })
          })
          return requestJson('/models' + (force ? '?refresh=1' : ''))
            .then(function (payload) {
              setState({
                status: 'ready',
                models: Array.isArray(payload.models) ? payload.models : [],
                errors: Array.isArray(payload.errors) ? payload.errors : [],
                fallback: payload.default || null,
                message: '',
              })
              return payload
            })
            .catch(function (err) {
              var message = String((err && err.message) || err)
              setState(function (previous) {
                return Object.assign({}, previous, { status: 'error', message: message })
              })
              return null
            })
        }, [])

        React.useEffect(
          function () {
            var alive = true
            requestJson('/models')
              .then(function (payload) {
                if (!alive) return
                setState({
                  status: 'ready',
                  models: Array.isArray(payload.models) ? payload.models : [],
                  errors: Array.isArray(payload.errors) ? payload.errors : [],
                  fallback: payload.default || null,
                  message: '',
                })
              })
              .catch(function (err) {
                if (!alive) return
                var message = String((err && err.message) || err)
                setState(function (previous) {
                  return Object.assign({}, previous, { status: 'error', message: message })
                })
              })
            return function () {
              alive = false
            }
          },
          [],
        )

        return {
          status: state.status,
          models: state.models,
          errors: state.errors,
          fallback: state.fallback,
          message: state.message,
          reload: function () {
            return load(true)
          },
        }
      }

      /**
       * 模型选择：形态对齐 DSH 原生设置行——左边标签、右边当前值、末尾箭头，
       * 点开在下方展开一列选项。不用 <select>：那会弹出操作系统级列表，
       * 白底、字体和主题都不受控（深色主题下尤其突兀）。
       *
       * @param {object} props catalog、value({provider, model})、onChange、onReload
       */
      function ModelPicker(props) {
        var catalog = props.catalog
        var value = encodeRoute(props.value && props.value.provider, props.value && props.value.model)
        var [open, setOpen] = React.useState(false)
        var rootRef = React.useRef(null)

        // 点外面就把列表收起来；Esc 只收列表，不收整个浮层。
        React.useEffect(
          function () {
            if (!open) return undefined
            function onDown(event) {
              var node = rootRef.current
              if (node !== null && node.contains(event.target)) return
              setOpen(false)
            }
            function onKey(event) {
              if (event.key === 'Escape') {
                event.stopPropagation()
                setOpen(false)
              }
            }
            document.addEventListener('mousedown', onDown, true)
            document.addEventListener('keydown', onKey, true)
            return function () {
              document.removeEventListener('mousedown', onDown, true)
              document.removeEventListener('keydown', onKey, true)
            }
          },
          [open],
        )

        // 每一项：{ key, label, sub }。follow 永远排第一（= 不写 provider/model）。
        var items = [
          {
            key: MODEL_FOLLOW,
            label: t('跟随会话当前模型', 'Follow the session model'),
            sub: catalog.fallback ? catalog.fallback.model : '',
          },
        ]
        var known = false
        catalog.models.forEach(function (item) {
          var encoded = encodeRoute(item.provider, item.model)
          if (encoded === value) known = true
          items.push({
            key: encoded,
            label: String(item.name || item.model),
            sub: item.provider,
          })
        })
        // 配置里写了一个目录里没有的模型（手改文件、provider 暂时不可用）时也要显示出来
        if (value !== MODEL_FOLLOW && !known) {
          items.push({
            key: value,
            label: String(props.value.model),
            sub: t('已保存，目录中未列出', 'saved, not in catalog') + ' · ' + props.value.provider,
          })
        }

        var current = items[0]
        for (var i = 0; i < items.length; i += 1) {
          if (items[i].key === value) {
            current = items[i]
            break
          }
        }

        var notes = []
        if (catalog.status === 'loading') notes.push(t('正在读取可用模型…', 'Loading available models…'))
        if (catalog.status === 'error') notes.push(t('读不到模型目录：', 'Cannot read the model catalog: ') + catalog.message)
        if (catalog.status === 'ready' && catalog.models.length === 0) {
          notes.push(t('宿主没有公布任何模型，只能在配置文件里手写 provider/model。', 'The host advertises no models; provider/model must be written in the config file.'))
        }
        catalog.errors.forEach(function (item) {
          notes.push(item.provider + '：' + item.message)
        })
        if (value === MODEL_FOLLOW && catalog.fallback) {
          notes.unshift(t('当前会话模型：', 'Session model: ') + catalog.fallback.provider + ' · ' + catalog.fallback.model)
        }

        // 设置页的卡片已经有标题，传 label: null 就不再重复一遍
        var label = props.label === undefined ? t('模型', 'Model') : props.label

        return e(
          'div',
          { className: 'dshsl-field' },
          e(
          'div',
          { className: 'dshsl-picker', 'data-open': open ? '1' : '0', ref: rootRef },
          e(
            'button',
            {
              type: 'button',
              className: 'dshsl-picker-row',
              'data-bare': label === null || label === false ? '1' : '0',
              'aria-haspopup': 'listbox',
              'aria-expanded': open,
              'aria-label': t('优化使用的模型', 'Model used for optimization'),
              onClick: function () {
                setOpen(function (previous) {
                  return !previous
                })
              },
            },
            label === null || label === false ? null : e('span', { className: 'dshsl-picker-label' }, label),
            e('span', { className: 'dshsl-picker-value' }, current.label),
            e('span', { className: 'dshsl-picker-caret', 'aria-hidden': 'true' }, '›'),
          ),
          open
            ? e(
                'div',
                { className: 'dshsl-picker-list', role: 'listbox', 'aria-label': t('优化使用的模型', 'Model used for optimization') },
                items.map(function (item) {
                  var on = item.key === value
                  return e(
                    'button',
                    {
                      key: item.key,
                      type: 'button',
                      className: 'dshsl-option',
                      'data-on': on ? '1' : '0',
                      role: 'option',
                      'aria-selected': on,
                      onClick: function () {
                        setOpen(false)
                        if (!on) props.onChange(decodeRoute(item.key))
                      },
                    },
                    e('span', { className: 'dshsl-option-check', 'aria-hidden': 'true' }, on ? '✓' : ''),
                    e('span', { className: 'dshsl-option-main' }, item.label),
                    item.sub ? e('span', { className: 'dshsl-option-sub' }, item.sub) : null,
                  )
                }),
                props.onReload
                  ? e(
                      'button',
                      {
                        type: 'button',
                        className: 'dshsl-option dshsl-option-reload',
                        disabled: catalog.status === 'loading',
                        onClick: props.onReload,
                      },
                      e('span', { className: 'dshsl-option-check', 'aria-hidden': 'true' }, '⟳'),
                      e('span', { className: 'dshsl-option-main' }, t('重新读取模型目录', 'Re-read the model catalog')),
                    )
                  : null,
              )
            : null,
          ),
          notes.length === 0
            ? null
            : e('p', { className: 'dshsl-models-note' }, notes.join(' · ')),
        )
      }

      /**
       * 浮层里的「完整设置」视图。
       *
       * 为什么要有它：DSH 没有给客户端插件提供「打开设置页」的接口，
       * 设置对话框的导航是宿主内部状态（settings 壳只导出 apply/inject，
       * SPA 没有 hash/路由，场上的 dsh-ops、dsh-whale-widget 也都没有跳转用法）。
       * 所以齿轮按钮就地切到这一页，把设置页的内容原样搬进浮层——
       * 目的（从输入框直接够到全部设置）达成，且不依赖任何猜测的 API。
       *
       * @param {object} props manifest、config、rules（hooks）、catalog
       */
      function FullSettings(props) {
        var manifest = props.manifest
        var config = props.config
        var rules = props.rules
        var catalog = props.catalog
        var allRuleIds = listOf(manifest, 'rules').map(function (rule) {
          return rule.id
        })
        var offCount = (config.disabledRules || []).length

        return e(
          React.Fragment,
          null,
          // 模型与两根主滑块也放进来，这样「全部设置」是常用视图的超集，
          // 而不是切换过去反而少了东西
          e(
            'div',
            { className: 'dshsl-row' },
            e(ModelPicker, {
              catalog: catalog,
              value: config,
              onChange: function (next) {
                rules.patch({ provider: next.provider, model: next.model })
              },
              onReload: catalog.reload,
            }),
          ),
          e(Slider, {
            label: t('强度', 'Strength'),
            name: 'depth',
            items: listOf(manifest, 'depths'),
            value: config.depth,
            onChange: function (id) {
              rules.patch({ depth: id })
            },
          }),
          e(Slider, {
            label: t('详细度', 'Detail'),
            name: 'verbosity',
            items: listOf(manifest, 'verbosities'),
            value: config.verbosity,
            onChange: function (id) {
              rules.patch({ verbosity: id })
            },
          }),
          e(
            'div',
            { className: 'dshsl-row' },
            e('span', { className: 'dshsl-label' }, t('语言', 'Language')),
            e(Segmented, {
              label: t('语言', 'Language'),
              items: listOf(manifest, 'locales'),
              value: config.locale,
              showNote: false,
              onChange: function (id) {
                rules.patch({ locale: id })
              },
            }),
          ),
          e(
            'div',
            { className: 'dshsl-row' },
            e('span', { className: 'dshsl-label' }, t('场景', 'Scenario')),
            e(Segmented, {
              label: t('场景', 'Scenario'),
              items: listOf(manifest, 'lenses'),
              value: config.lens,
              showNote: false,
              onChange: function (id) {
                rules.patch({ lens: id })
              },
            }),
          ),
          e(
            'div',
            { className: 'dshsl-row' },
            e(
              'div',
              { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 } },
              e('span', { className: 'dshsl-label', style: { margin: 0, flex: 1 } }, t('内置规则', 'Built-in rules')),
              e('span', { className: 'dshsl-group-count' }, allRuleIds.length - offCount + '/' + allRuleIds.length),
              e(
                'button',
                {
                  type: 'button',
                  className: 'dshsl-btn3',
                  onClick: function () {
                    rules.toggleMany(allRuleIds, true)
                  },
                },
                t('全开', 'All on'),
              ),
              e(
                'button',
                {
                  type: 'button',
                  className: 'dshsl-btn3',
                  onClick: function () {
                    rules.toggleMany(allRuleIds, false)
                  },
                },
                t('全关', 'All off'),
              ),
            ),
            e(RuleList, {
              rules: listOf(manifest, 'rules'),
              groups: listOf(manifest, 'ruleGroups'),
              config: config,
              columns: props.wide === true ? 2 : 1,
              onToggle: rules.toggleRule,
            }),
          ),
          e(
            'div',
            { className: 'dshsl-row' },
            e('span', { className: 'dshsl-label' }, t('自定义规则（每行一条）', 'Custom rules (one per line)')),
            e(CustomRulesField, { value: rules.customText, onChange: rules.setCustomText }),
          ),
          e(
            'div',
            { className: 'dshsl-row' },
            e('span', { className: 'dshsl-label' }, t('高级', 'Advanced')),
            e(NumberSlider, {
              label: t('输出上限', 'Max tokens'),
              min: 256,
              max: 8000,
              step: 64,
              value: config.maxTokens,
              onChange: function (n) {
                rules.patch({ maxTokens: n })
              },
            }),
            e(NumberSlider, {
              label: t('温度', 'Temperature'),
              min: 0,
              max: 1.5,
              step: 0.05,
              value: config.temperature,
              onChange: function (n) {
                rules.patch({ temperature: n })
              },
            }),
            e(NumberSlider, {
              label: t('超时', 'Timeout'),
              min: 5000,
              max: 300000,
              step: 1000,
              value: config.timeoutMs,
              unit: 'ms',
              onChange: function (n) {
                rules.patch({ timeoutMs: n })
              },
            }),
            e('p', { className: 'dshsl-models-note' }, t('配置文件', 'Config file') + ' · ' + String(manifest.configFile || '')),
          ),
          e(EnabledToggle, { config: config, onPatch: rules.patch }),
          e(
            'p',
            { className: 'dshsl-models-note' },
            t(
              '这一页与「设置 → 星芒提示词」是同一份配置；DSH 暂未提供从插件跳到设置页的接口，所以在这里就地展开。',
              'This page and Settings → Starlight share one config. DSH does not expose an API for plugins to open the settings page, so it unfolds in place.',
            ),
          ),
        )
      }

      /**
       * 独立的设置窗口。
       *
       * 为什么不跳 DSH 的设置页：宿主没有给客户端插件提供打开设置页的接口
       * （settings 壳只导出 apply/inject，SPA 没有 hash/路由），所以这里自己弹一个
       * 模态窗——内容与「设置 → 星芒提示词」是同一份配置，宽度够，规则还能两列展开。
       *
       * @param {object} props onClose、onSaved
       */
      function SettingsDialog(props) {
        var rules = useRulesConfig()
        var catalog = useModelCatalog()
        var [flash, setFlash] = React.useState('')
        var panelRef = React.useRef(null)
        var restoreRef = React.useRef(null)

        // Esc 关窗；打开时把焦点移进来，关闭时还给触发者（齿轮按钮）
        React.useEffect(
          function () {
            restoreRef.current = document.activeElement
            if (panelRef.current !== null) {
              try {
                panelRef.current.focus()
              } catch (error) {}
            }
            function onKey(event) {
              if (event.key === 'Escape') {
                event.stopPropagation()
                props.onClose()
                return
              }
              // Tab 陷阱：模态窗里 Tab 不该跑到背后的页面去。
              // 只在首尾两端拦截，中间交给浏览器，保持正常的 Tab 顺序。
              if (event.key !== 'Tab') return
              var panel = panelRef.current
              if (panel === null) return
              var nodes = panel.querySelectorAll('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
              var list = []
              for (var index = 0; index < nodes.length; index += 1) {
                if (nodes[index].disabled !== true) list.push(nodes[index])
              }
              if (list.length === 0) return
              var first = list[0]
              var last = list[list.length - 1]
              var active = document.activeElement
              var outside = !panel.contains(active)
              if (event.shiftKey === true) {
                if (active === first || outside) {
                  event.preventDefault()
                  last.focus()
                }
              } else if (active === last || outside) {
                event.preventDefault()
                first.focus()
              }
            }
            document.addEventListener('keydown', onKey, true)
            return function () {
              document.removeEventListener('keydown', onKey, true)
              var previous = restoreRef.current
              if (previous !== null && typeof previous.focus === 'function') {
                try {
                  previous.focus()
                } catch (error) {}
              }
            }
          },
          [props],
        )

        var manifest = rules.manifest
        var config = rules.config

        var status = rules.dirty
          ? t('有未保存的修改', 'Unsaved changes')
          : rules.notice || flash || t('已与磁盘一致', 'In sync with disk')

        var applySave = function () {
          rules.save().then(function (payload) {
            if (payload) {
              setFlash(t('已保存并立即生效', 'Saved and applied'))
              if (typeof props.onSaved === 'function') props.onSaved(payload)
            }
          })
        }
        var applyRestore = function () {
          rules.restore().then(function (payload) {
            if (payload) setFlash(t('已恢复默认规则', 'Restored defaults'))
          })
        }

        var body
        if (rules.error !== '' && manifest === null) {
          body = e(
            'div',
            { className: 'dshsl-dialog-note' },
            e('p', { className: 'dshsl-warn' }, rules.error),
            e(
              'button',
              { type: 'button', className: 'dshsl-btn2', onClick: function () { rules.reload() } },
              t('重试', 'Retry'),
            ),
          )
        } else if (manifest === null || config === null) {
          body = e(Skeleton, { widths: ['48%', '100%', '86%', '92%', '70%'] })
        } else {
          body = e(FullSettings, {
            manifest: manifest,
            config: config,
            rules: rules,
            catalog: catalog,
            wide: true,
          })
        }

        return reactDom.createPortal(
          e(
            'div',
            { className: 'dshsl-dialog' },
            e('div', {
              className: 'dshsl-dialog-backdrop',
              'aria-hidden': 'true',
              onClick: props.onClose,
            }),
            e(
              'div',
              {
                ref: panelRef,
                className: 'dshsl-dialog-panel',
                role: 'dialog',
                'aria-modal': 'true',
                'aria-label': t('星芒 · 全部设置', 'Starlight · all settings'),
                tabIndex: -1,
              },
              e(
                'div',
                { className: 'dshsl-head' },
                e(ProIcon, { size: 22 }),
                e(
                  'span',
                  { className: 'dshsl-title' },
                  t('星芒 · 全部设置', 'Starlight · all settings'),
                  rules.dirty
                    ? e('span', { className: 'dshsl-pill', 'data-tone': 'warn' }, t('未保存', 'Unsaved'))
                    : null,
                ),
                e(
                  'button',
                  {
                    type: 'button',
                    className: 'dshsl-x',
                    'aria-label': t('关闭', 'Close'),
                    onClick: props.onClose,
                  },
                  '✕',
                ),
              ),
              e('div', { className: 'dshsl-dialog-body' }, body),
              e(
                'div',
                { className: 'dshsl-page-foot' },
                e('span', { className: 'dshsl-status', 'data-dirty': rules.dirty ? '1' : '0', title: status }, status),
                e(
                  'button',
                  { type: 'button', className: 'dshsl-btn2', disabled: rules.busy, onClick: applyRestore },
                  t('恢复默认', 'Restore defaults'),
                ),
                e(
                  'button',
                  {
                    type: 'button',
                    className: 'dshsl-btn2',
                    'data-primary': '1',
                    disabled: rules.busy || !rules.dirty,
                    onClick: applySave,
                  },
                  rules.busy ? t('保存中…', 'Saving…') : t('保存', 'Save'),
                ),
              ),
            ),
          ),
          document.body,
        )
      }

      /**
       * @param {object} props anchor(getBoundingClientRect)、onClose、onSaved
       */
      function StarPanel(props) {
        var rules = useRulesConfig()
        var catalog = useModelCatalog()
        var [position, setPosition] = React.useState(null)
        var [closing, setClosing] = React.useState(false)
        // 齿轮打开独立的设置窗口（不是就地展开：那样 360px 宽塞不下）
        var [dialog, setDialog] = React.useState(false)
        var rootRef = React.useRef(null)

        // 收回时要先播完退场动画再卸载，否则面板会「啪」地消失。
        // 减少动效偏好下不等待。
        var requestClose = React.useCallback(
          function () {
            if (closing) return
            setClosing(true)
            if (prefersReducedMotion()) {
              props.onClose()
              return
            }
            setTimeout(function () {
              props.onClose()
            }, CLOSE_ANIMATION_MS)
          },
          [closing, props],
        )

        // 定位：贴在按钮上方，并钳制在视口内
        var place = React.useCallback(
          function () {
            var rect = props.anchor()
            var height = rootRef.current ? rootRef.current.getBoundingClientRect().height : 420
            var viewportW = window.innerWidth
            var viewportH = window.innerHeight
            var left = Math.min(Math.max(8, rect.right - PANEL_WIDTH), Math.max(8, viewportW - PANEL_WIDTH - 8))
            var top = rect.top - height - 10
            if (top < 8) top = Math.min(viewportH - height - 8, rect.bottom + 10)
            setPosition({ left: left, top: Math.max(8, top) })
          },
          [props],
        )

        React.useLayoutEffect(
          function () {
            place()
          },
          [place, rules.manifest],
        )

        // 点外面 / Esc 关闭
        React.useEffect(
          function () {
            function onDown(event) {
              var node = rootRef.current
              if (node === null) return
              if (node.contains(event.target)) return
              requestClose()
            }
            function onKey(event) {
              if (event.key === 'Escape') {
                event.stopPropagation()
                requestClose()
              }
            }
            document.addEventListener('mousedown', onDown, true)
            document.addEventListener('keydown', onKey, true)
            return function () {
              document.removeEventListener('mousedown', onDown, true)
              document.removeEventListener('keydown', onKey, true)
            }
          },
          [props],
        )

        var body
        if (rules.error !== '' && rules.manifest === null) {
          body = e('div', { className: 'dshsl-row dshsl-warn' }, rules.error)
        } else if (rules.manifest === null || rules.config === null) {
          body = e(Skeleton, { widths: ['54%', '100%', '88%', '70%'] })
        } else {
          var manifest = rules.manifest
          var config = rules.config
          var offCount = (config.disabledRules || []).length
          var ruleCount = listOf(manifest, 'rules').length
          var lenses = listOf(manifest, 'lenses')
          var lensLabel = labelOf(lenses, config.lens)
          body = e(
            React.Fragment,
            null,
            // ① 模型：放在第一位
            e(
              'div',
              { className: 'dshsl-row' },
              e(ModelPicker, {
                catalog: catalog,
                value: config,
                onChange: function (next) {
                  rules.patch({ provider: next.provider, model: next.model })
                },
                onReload: catalog.reload,
              }),
            ),
            // ② 两根滑块：强度 + 详细度
            e(Slider, {
              label: t('强度', 'Strength'),
              name: 'depth',
              items: listOf(manifest, 'depths'),
              value: config.depth,
              onChange: function (id) {
                rules.patch({ depth: id })
              },
            }),
            e(Slider, {
              label: t('详细度', 'Detail'),
              name: 'verbosity',
              items: listOf(manifest, 'verbosities'),
              value: config.verbosity,
              onChange: function (id) {
                rules.patch({ verbosity: id })
              },
            }),
            // ③ 语言：只有三个选项，分段比滑块更直观
            e(
              'div',
              { className: 'dshsl-row', style: { marginBottom: 0 } },
              e('span', { className: 'dshsl-label' }, t('语言', 'Language')),
              e(Segmented, {
                label: t('语言', 'Language'),
                items: listOf(manifest, 'locales'),
                value: config.locale,
                showNote: false,
                onChange: function (id) {
                  rules.patch({ locale: id })
                },
              }),
            ),
            // ④ 浮层只留「换个场景」和总开关。
            //    规则、自定义规则、高级都在设置窗口里（齿轮一点就开）——
            //    同一套东西在三处出现，浮层这一份只会把面板撑长。
            e(
              More,
              {
                title: t('更多设置', 'More'),
                // 规则已经不在这里了，摘要就别再报规则数——
                // 只报真正能在这个区块里改的那一项
                summary: t('场景 · ', 'scenario · ') + lensLabel,
              },
              e(
                'div',
                { className: 'dshsl-row' },
                e('span', { className: 'dshsl-label' }, t('场景', 'Scenario')),
                e(Segmented, {
                  label: t('场景', 'Scenario'),
                  items: listOf(manifest, 'lenses'),
                  value: config.lens,
                  showNote: false,
                  onChange: function (id) {
                    rules.patch({ lens: id })
                  },
                }),
              ),
              // 一行可点击入口，比三行说明更省地方，也更直接
              e(
                'button',
                {
                  type: 'button',
                  className: 'dshsl-link-row',
                  onClick: function () {
                    setDialog(true)
                  },
                },
                e('span', { className: 'dshsl-link-row-text' }, t('规则、自定义规则与高级参数', 'Rules, custom rules and advanced parameters')),
                e('span', { className: 'dshsl-link-row-go', 'aria-hidden': 'true' }, '›'),
              ),
              e(EnabledToggle, { config: config, onPatch: rules.patch }),
            ),
            manifest.llmAvailable === false
              ? e(
                  'p',
                  { className: 'dshsl-warn' },
                  t(
                    '本机没有可用的模型服务，点击按钮只会做本地格式整理。',
                    'No model service is available on this host; the button will only tidy formatting.',
                  ),
                )
              : null,
            rules.error !== '' ? e('p', { className: 'dshsl-warn' }, rules.error) : null,
          )
        }

        var hint = rules.manifest
          ? rules.dirty
            ? t('有未保存的修改', 'Unsaved changes')
            : t('已保存', 'Saved')
          : ''

        // 设置窗口是独立模态层：portal 到 body，层级高于浮层
        var dialogLayer =
          dialog === true
            ? e(SettingsDialog, {
                onClose: function () {
                  setDialog(false)
                  // 关窗后把浮层刷新一遍，免得它显示的是窗口保存前的旧值
                  rules.reload()
                },
              })
            : null

        return reactDom.createPortal(
          e(
            React.Fragment,
            null,
          e(
            'div',
            {
              ref: rootRef,
              className: 'dshsl-panel',
              role: 'dialog',
              'data-closing': closing ? '1' : '0',
              'aria-label': t('星芒 · 提示词优化规则', 'Starlight · prompt rules'),
              style: position === null ? { left: -9999, top: -9999 } : { left: position.left, top: position.top },
              onContextMenu: function (event) {
                event.preventDefault()
              },
            },
            e(
              'div',
              { className: 'dshsl-head' },
              e(ProIcon, { size: 22 }),
              e(
                'span',
                { className: 'dshsl-title' },
                t('星芒 · 提示词优化', 'Starlight · prompt optimizer'),
                rules.dirty
                  ? e('span', { className: 'dshsl-pill', 'data-tone': 'warn' }, t('未保存', 'Unsaved'))
                  : null,
              ),
              e(
                'button',
                {
                  type: 'button',
                  className: 'dshsl-x',
                  title: t('打开设置窗口（与设置页同一份配置）', 'Open the settings window (same config as the settings page)'),
                  'aria-label': t('打开设置窗口', 'Open the settings window'),
                  'aria-haspopup': 'dialog',
                  onClick: function () {
                    setDialog(true)
                  },
                },
                e(GearIcon, { size: 15 }),
              ),
              e(
                'button',
                { type: 'button', className: 'dshsl-x', 'aria-label': t('关闭', 'Close'), onClick: requestClose },
                '✕',
              ),
            ),
            e('div', { className: 'dshsl-body' }, body),
            e(
              'div',
              { className: 'dshsl-foot' },
              e('span', { className: 'dshsl-hint', title: rules.manifest ? rules.manifest.configFile : '' }, hint),
              e(
                'button',
                {
                  type: 'button',
                  className: 'dshsl-btn2',
                  disabled: rules.busy,
                  onClick: function () {
                    rules.restore().then(function (payload) {
                      if (payload) props.onSaved(payload.config)
                    })
                  },
                },
                t('恢复默认', 'Defaults'),
              ),
              e(
                'button',
                {
                  type: 'button',
                  className: 'dshsl-btn2',
                  'data-primary': '1',
                  disabled: rules.busy || !rules.dirty,
                  onClick: function () {
                    rules.save().then(function (payload) {
                      if (payload) props.onSaved(payload.config)
                    })
                  },
                },
                rules.busy ? t('保存中…', 'Saving…') : t('保存', 'Save'),
              ),
            ),
            ),
            dialogLayer,
          ),
          document.body,
        )
      }

      /* -------------------------------------------------------------- *
       * 独立设置页（设置 → 星芒提示词）
       * -------------------------------------------------------------- */

      /** 骨架屏：加载中的占位，比一行「读取配置…」更像成品。 */
      function Skeleton(props) {
        var widths = props.widths || ['62%', '100%', '84%']
        return e(
          'div',
          { className: 'dshsl-skel', 'aria-busy': 'true', 'aria-live': 'polite' },
          widths.map(function (width, index) {
            return e('div', { key: index, className: 'dshsl-skel-bar', style: { width: width } })
          }),
        )
      }

      /**
       * 数值滑块（高级区）：把 0.3 / 1600 / 60000 这类数字也做成可拖的。
       * 精确输入仍可用方向键微调（step 决定粒度）。
       * @param {{ label: string, min: number, max: number, step: number, value: number, unit?: string, note?: string, onChange: (n: number) => void }} props
       */
      function NumberSlider(props) {
        var value = Number(props.value)
        if (!Number.isFinite(value)) value = props.min
        return e(
          'div',
          { className: 'dshsl-slider' },
          e(
            'div',
            { className: 'dshsl-slider-head' },
            e('span', { className: 'dshsl-slider-label' }, props.label),
            e('span', { className: 'dshsl-slider-value' }, String(value) + (props.unit ? props.unit : '')),
          ),
          e('input', {
            className: 'dshsl-range',
            type: 'range',
            min: props.min,
            max: props.max,
            step: props.step,
            value: value,
            style: { '--dshsl-fill': Math.round(((value - props.min) / (props.max - props.min)) * 100) + '%' },
            'aria-label': props.label,
            'aria-valuetext': String(value) + (props.unit ? props.unit : ''),
            onChange: function (event) {
              props.onChange(Number(event.target.value))
            },
          }),
          props.note ? e('p', { className: 'dshsl-slider-note' }, props.note) : null,
        )
      }

      /* -------------------------------------------------------------- *
       * 技能目录（只读）
       * -------------------------------------------------------------- */

      /**
       * 只读技能目录的状态机：只有「查」这一个动作，从不写磁盘。
       * 目录请求走宿主代理（`/skills`），因为浏览器直连目录站会被 CORS 挡，
       * 而且宿主要能卡超时与响应体积。
       */
      function useSkillCatalog() {
        var [state, setState] = React.useState({ status: 'idle', items: [], error: '', query: '' })
        var requestRef = React.useRef(0)

        var search = React.useCallback(function (rawQuery) {
          var query = String(rawQuery || '').trim()
          if (query === '') {
            setState({ status: 'idle', items: [], error: '', query: '' })
            return Promise.resolve(null)
          }
          var ticket = requestRef.current + 1
          requestRef.current = ticket
          setState(function (previous) {
            return { status: 'loading', items: previous.items, error: '', query: query }
          })
          return requestJson('/skills?q=' + encodeURIComponent(query))
            .then(function (payload) {
              if (requestRef.current !== ticket) return null
              if (payload === null || payload.ok !== true) {
                setState({
                  status: 'error',
                  items: [],
                  error: (payload && payload.error && payload.error.message) || t('目录暂时不可用', 'The catalog is unavailable'),
                  query: query,
                })
                return null
              }
              setState({ status: 'ready', items: Array.isArray(payload.items) ? payload.items : [], error: '', query: query })
              return payload
            })
            .catch(function (error) {
              if (requestRef.current !== ticket) return null
              // requestJson 在 ok:false 时会带着服务端的原因抛错，把原因透出来，
              // 不要一律换成「不可用」让人无从判断
              setState({
                status: 'error',
                items: [],
                error: (error && error.message) || t('目录暂时不可用', 'The catalog is unavailable'),
                query: query,
              })
              return null
            })
        }, [])

        return { status: state.status, items: state.items, error: state.error, query: state.query, search: search }
      }

      /** 把引用复制到剪贴板；拿不到剪贴板 API 时退化成选中文本。 */
      function copyText(text) {
        try {
          if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            return navigator.clipboard.writeText(text).then(
              function () {
                return true
              },
              function () {
                return false
              },
            )
          }
        } catch (error) {}
        return Promise.resolve(false)
      }

      /**
       * 技能市场：只读目录。
       * 展示目录里的条目与它给出的安装引用，用户自己决定要不要装——
       * 插件不替用户往磁盘写任何东西。
       */
      function SkillsMarket() {
        var catalog = useSkillCatalog()
        var [input, setInput] = React.useState('')
        var [copied, setCopied] = React.useState('')

        var submit = function () {
          catalog.search(input)
        }

        var onCopy = function (reference) {
          copyText(reference).then(function (ok) {
            setCopied(ok ? reference : '')
            if (ok) {
              setTimeout(function () {
                setCopied('')
              }, 1600)
            }
          })
        }

        var body
        if (catalog.status === 'loading') {
          body = e(Skeleton, { widths: ['70%', '92%', '84%'] })
        } else if (catalog.status === 'error') {
          body = e(
            'p',
            { className: 'dshsl-warn' },
            catalog.error,
            ' ',
            e(
              'button',
              {
                type: 'button',
                className: 'dshsl-btn3',
                onClick: function () {
                  catalog.search(catalog.query)
                },
              },
              t('重试', 'Retry'),
            ),
          )
        } else if (catalog.status === 'ready' && catalog.items.length === 0) {
          body = e(
            'p',
            { className: 'dshsl-models-note' },
            t('没有匹配的技能，换个关键词试试。', 'No matching skills; try another keyword.'),
          )
        } else if (catalog.status === 'ready') {
          body = e(
            'div',
            { className: 'dshsl-skills', 'data-skills': '' },
            catalog.items.map(function (item) {
              return e(
                'article',
                { key: item.reference, className: 'dshsl-skill' },
                e(
                  'div',
                  { className: 'dshsl-skill-head' },
                  e('span', { className: 'dshsl-skill-name' }, item.name),
                  item.official === true ? e('span', { className: 'dshsl-pill', 'data-tone': 'ok' }, t('官方', 'Official')) : null,
                  typeof item.downloads === 'number' ? e('span', { className: 'dshsl-skill-stat' }, '↓' + item.downloads) : null,
                ),
                e('p', { className: 'dshsl-skill-author' }, item.author),
                item.summary === '' ? null : e('p', { className: 'dshsl-skill-summary' }, item.summary),
                e(
                  'div',
                  { className: 'dshsl-skill-actions' },
                  e('code', { className: 'dshsl-skill-ref' }, item.reference),
                  e(
                    'button',
                    {
                      type: 'button',
                      className: 'dshsl-btn3',
                      onClick: function () {
                        onCopy(item.reference)
                      },
                    },
                    copied === item.reference ? t('已复制', 'Copied') : t('复制引用', 'Copy reference'),
                  ),
                  typeof item.url === 'string'
                    ? e(
                        'a',
                        { className: 'dshsl-skill-link', href: item.url, target: '_blank', rel: 'noreferrer noopener' },
                        t('打开', 'Open'),
                      )
                    : null,
                ),
              )
            }),
          )
        } else {
          body = e(
            'p',
            { className: 'dshsl-models-note' },
            t(
              '输入关键词搜索公开技能目录（ClawHub）。这里只做展示，不会替你安装任何东西。',
              'Search the public skill catalog (ClawHub). This view is read-only and installs nothing for you.',
            ),
          )
        }

        return e(
          'div',
          { className: 'dshsl-market' },
          e(
            'div',
            { className: 'dshsl-market-search' },
            e('input', {
              className: 'dshsl-input',
              type: 'search',
              value: input,
              placeholder: t('搜索技能，例如 prompt / review / test', 'Search skills, e.g. prompt / review / test'),
              'aria-label': t('搜索技能目录', 'Search the skill catalog'),
              onChange: function (event) {
                setInput(event.target.value)
              },
              onKeyDown: function (event) {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  submit()
                }
              },
            }),
            e(
              'button',
              { type: 'button', className: 'dshsl-btn2', 'data-primary': '1', disabled: catalog.status === 'loading', onClick: submit },
              catalog.status === 'loading' ? t('搜索中…', 'Searching…') : t('搜索', 'Search'),
            ),
          ),
          catalog.status === 'ready'
            ? e(
                'p',
                { className: 'dshsl-models-note' },
                t('共 ', 'Found ') + catalog.items.length + t(' 条 · 来源 ClawHub · 只读', ' · from ClawHub · read-only'),
              )
            : null,
          body,
        )
      }


      /**
       * 设置页主体。settings.section 槽位的 scope 是 root，
       * 组件只依赖自己的状态与宿主 HTTP 接口，不读取会话上下文。
       *
       * 信息架构（按用户要求重排）：
       *   模型 → 强度/详细度/语言 → 折叠：规则 / 自定义规则 / 高级 / 关于
       * 默认只露出 4 个控件，其余全部折叠，避免一屏塞满设置项。
       */
      function StarlightSettingsSection() {
        var rules = useRulesConfig()
        var catalog = useModelCatalog()
        var [flash, setFlash] = React.useState('')
        // 'config' 配置 / 'market' 只读技能目录
        var [tab, setTab] = React.useState('config')

        if (rules.error !== '' && rules.manifest === null) {
          return e(
            'div',
            { className: 'dshsl-page' },
            e(
              'div',
              { className: 'dshsl-hero' },
              e(ProIcon, { size: 40 }),
              e(
                'div',
                { className: 'dshsl-hero-text' },
                e('h2', { className: 'dshsl-page-h1' }, t('星芒提示词', 'Starlight')),
                e('p', { className: 'dshsl-page-sub', style: { margin: '4px 0 0' } }, rules.error),
              ),
            ),
            e(
              'p',
              { className: 'dshsl-card-desc' },
              t(
                '宿主半部没有响应。多半是插件装好后还没重启 DSH（宿主路由需要在启动时注册）。',
                'The host half did not answer. Most likely DSH has not been restarted since installing the plugin (host routes register at boot).',
              ),
            ),
            e(
              'button',
              { type: 'button', className: 'dshsl-btn2', onClick: function () { rules.reload() } },
              t('重试', 'Retry'),
            ),
          )
        }

        if (rules.manifest === null || rules.config === null) {
          return e(
            'div',
            { className: 'dshsl-page' },
            e(
              'div',
              { className: 'dshsl-hero' },
              e(ProIcon, { size: 40 }),
              e(
                'div',
                { className: 'dshsl-hero-text' },
                e('h2', { className: 'dshsl-page-h1' }, t('星芒提示词', 'Starlight')),
                e('p', { className: 'dshsl-page-sub', style: { margin: '4px 0 0' } }, t('读取配置…', 'Loading configuration…')),
              ),
            ),
            e(Skeleton, { widths: ['48%', '100%', '76%', '92%'] }),
          )
        }

        var config = rules.config
        var manifest = rules.manifest
        var allRuleIds = listOf(manifest, 'rules').map(function (rule) {
          return rule.id
        })
        var ruleCount = allRuleIds.length
        var offCount = (config.disabledRules || []).length
        var lensLabel = ''
        var lensLabel = labelOf(listOf(manifest, 'lenses'), config.lens)

        var applySave = function () {
          rules.save().then(function (payload) {
            if (payload) setFlash(t('已保存并立即生效', 'Saved and applied'))
          })
        }
        var applyRestore = function () {
          rules.restore().then(function (payload) {
            if (payload) setFlash(t('已恢复默认规则', 'Restored defaults'))
          })
        }

        var status = rules.dirty ? t('有未保存的修改', 'Unsaved changes') : rules.notice || flash || t('已与磁盘一致', 'In sync with disk')
        var enabledPill =
          config.enabled === false
            ? e('span', { className: 'dshsl-pill', 'data-tone': 'warn' }, t('已关闭', 'Off'))
            : e('span', { className: 'dshsl-pill', 'data-tone': 'ok' }, t('已启用', 'On'))
        var modelPill =
          config.provider !== '' && config.model !== ''
            ? e('span', { className: 'dshsl-pill' }, config.provider + ' · ' + config.model)
            : e('span', { className: 'dshsl-pill' }, t('跟随会话模型', 'Session model'))

        return e(
          'div',
          { className: 'dshsl-page' },
          // —— 头部：插件图标 + 标题 + 状态 ——
          e(
            'div',
            { className: 'dshsl-hero' },
            e(ProIcon, { size: 40 }),
            e(
              'div',
              { className: 'dshsl-hero-text' },
              e('h2', { className: 'dshsl-page-h1' }, t('星芒提示词优化', 'Starlight prompt optimizer'), enabledPill, modelPill),
              e(
                'p',
                { className: 'dshsl-page-sub', style: { margin: '4px 0 0' } },
                t('三个控件就能调好；其余收在下面。改动保存后对下一次点击生效。', 'Three controls cover the normal case; the rest is folded away below.'),
              ),
            ),
          ),

          // —— 标签页：配置 / 技能市场 ——
          e(
            'div',
            { className: 'dshsl-tabs', role: 'tablist' },
            [
              { id: 'config', label: t('配置', 'Settings') },
              { id: 'market', label: t('技能市场', 'Skill market') },
            ].map(function (item) {
              var on = tab === item.id
              return e(
                'button',
                {
                  key: item.id,
                  type: 'button',
                  role: 'tab',
                  className: 'dshsl-tab',
                  'data-on': on ? '1' : '0',
                  'aria-selected': on,
                  onClick: function () {
                    setTab(item.id)
                  },
                },
                item.label,
              )
            }),
          ),

          tab === 'market' ? e(SkillsMarket, {}) : e(React.Fragment, null,

                    // —— ① 模型（第一项）——
          e(
            'section',
            { className: 'dshsl-card' },
            e('div', { className: 'dshsl-card-head' }, e('h3', { className: 'dshsl-card-title' }, t('模型', 'Model'))),
            e(
              'p',
              { className: 'dshsl-card-desc' },
              t(
                '默认跟随会话。固定一个更便宜/更快的模型只影响星芒的旁路调用，不动你的会话模型。',
                'Follows the session by default. Pinning a cheaper or faster model only affects Starlight’s side call.',
              ),
            ),
            e(ModelPicker, {
              catalog: catalog,
              value: config,
              label: null,
              onChange: function (next) {
                rules.patch({ provider: next.provider, model: next.model })
              },
              onReload: catalog.reload,
            }),
          ),

          // —— ② 三个滑块/分段 ——
          e(
            'section',
            { className: 'dshsl-card' },
            e(
              'div',
              { className: 'dshsl-card-head' },
              e('h3', { className: 'dshsl-card-title' }, t('改写力度', 'Rewrite force')),
            ),
            e(
              'p',
              { className: 'dshsl-card-desc' },
              t('强度 = 改动多少，详细度 = 写多长，两者独立。', 'Strength = how much moves; detail = how long it gets. They are independent.'),
            ),
            e(Slider, {
              label: t('强度', 'Strength'),
              name: 'depth',
              items: listOf(manifest, 'depths'),
              value: config.depth,
              onChange: function (id) {
                rules.patch({ depth: id })
              },
            }),
            e(Slider, {
              label: t('详细度', 'Detail'),
              name: 'verbosity',
              items: listOf(manifest, 'verbosities'),
              value: config.verbosity,
              onChange: function (id) {
                rules.patch({ verbosity: id })
              },
            }),
            e(
              'div',
              { className: 'dshsl-row', style: { marginBottom: 0, marginTop: 10 } },
              e('span', { className: 'dshsl-label' }, t('语言', 'Language')),
              e(Segmented, {
                label: t('语言', 'Language'),
                items: listOf(manifest, 'locales'),
                value: config.locale,
                showNote: false,
                onChange: function (id) {
                  rules.patch({ locale: id })
                },
              }),
            ),
          ),

          // —— ③ 规则（折叠）——
          e(
            More,
            {
              title: t('规则', 'Rules'),
              summary: (ruleCount - offCount) + '/' + ruleCount + ' · ' + lensLabel,
            },
            e(
              'div',
              { className: 'dshsl-row' },
              e('span', { className: 'dshsl-label' }, t('场景', 'Scenario')),
              e(Segmented, {
                label: t('场景', 'Scenario'),
                items: listOf(manifest, 'lenses'),
                value: config.lens,
                showNote: false,
                onChange: function (id) {
                  rules.patch({ lens: id })
                },
              }),
            ),
            e(
              'div',
              { className: 'dshsl-row' },
              e(
                'div',
                { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 } },
                e('span', { className: 'dshsl-label', style: { margin: 0, flex: 1 } }, t('内置规则', 'Built-in rules')),
                e(
                  'button',
                  {
                    type: 'button',
                    className: 'dshsl-btn3',
                    onClick: function () {
                      rules.toggleMany(allRuleIds, true)
                    },
                  },
                  t('全开', 'All on'),
                ),
                e(
                  'button',
                  {
                    type: 'button',
                    className: 'dshsl-btn3',
                    onClick: function () {
                      rules.toggleMany(allRuleIds, false)
                    },
                  },
                  t('全关', 'All off'),
                ),
              ),
              e(RuleList, { rules: listOf(manifest, 'rules'), groups: listOf(manifest, 'ruleGroups'), config: config, columns: 2, onToggle: rules.toggleRule }),
            ),
            e(EnabledToggle, { config: config, onPatch: rules.patch }),
          ),

          // —— ④ 自定义规则（折叠）——
          e(
            More,
            {
              title: t('自定义规则', 'Custom rules'),
              summary: (config.customRules || []).length + ' ' + t('条', 'rules'),
            },
            e(CustomRulesField, { value: rules.customText, onChange: rules.setCustomText }),
            e(
              'p',
              { className: 'dshsl-models-note' },
              t('每行一条，优先级高于内置规则（五条不可协商的护栏除外）。', 'One per line; these outrank the built-in rules except the five non-negotiables.'),
            ),
          ),

          // —— ⑤ 高级（折叠，全是滑块）——
          e(
            More,
            {
              title: t('高级', 'Advanced'),
              summary: config.maxTokens + ' · ' + config.temperature + ' · ' + Math.round(config.timeoutMs / 1000) + 's',
            },
            e(NumberSlider, {
              label: t('输出上限', 'Max tokens'),
              min: 256,
              max: 8000,
              step: 64,
              value: config.maxTokens,
              onChange: function (n) {
                rules.patch({ maxTokens: n })
              },
              note: t('会随草稿长度二次缩放，但不超过这个上限。', 'Scaled by draft length, never above this cap.'),
            }),
            e(NumberSlider, {
              label: t('温度', 'Temperature'),
              min: 0,
              max: 1.5,
              step: 0.05,
              value: config.temperature,
              onChange: function (n) {
                rules.patch({ temperature: n })
              },
              note: t('越低越稳定，越高越自由。', 'Lower is steadier, higher drifts more.'),
            }),
            e(NumberSlider, {
              label: t('超时', 'Timeout'),
              min: 5000,
              max: 300000,
              step: 1000,
              value: config.timeoutMs,
              unit: 'ms',
              onChange: function (n) {
                rules.patch({ timeoutMs: n })
              },
              note: t('超时后自动降级为本地格式整理。', 'On timeout it degrades to a local tidy-up.'),
            }),
            e('p', { className: 'dshsl-field-label', style: { marginTop: 12 } }, t('配置文件', 'Config file')),
            e('p', { className: 'dshsl-path' }, String(manifest.configFile || '')),
            e(
              'p',
              { className: 'dshsl-models-note' },
              t('手改文件后重开本页即可看到（按 mtime 检测）。', 'Hand edits show up when you reopen this page (mtime-based).'),
            ),
          ),

          // —— ⑥ 关于（折叠）——
          e(
            More,
            { title: t('关于', 'About'), summary: 'v0.4.1 · AGPL-3.0' },
            e(
              'p',
              { className: 'dshsl-models-note', style: { margin: 0, lineHeight: '19px' } },
              t('作者 Starlit Sky · AGPL-3.0 · 保留署名头。', 'by Starlit Sky · AGPL-3.0 · keep the signature headers.'),
            ),
            e(
              'p',
              { className: 'dshsl-models-note', style: { margin: '6px 0 0', lineHeight: '19px' } },
              'github.com/Starlit-Sky-code/dsh-prompt-starlight',
            ),
            e(
              'p',
              { className: 'dshsl-models-note', style: { margin: '6px 0 0', lineHeight: '19px' } },
              t('快捷键：输入框内 Ctrl / ⌘ + Shift + O', 'Shortcut: Ctrl / ⌘ + Shift + O in the composer'),
            ),
          ),

          manifest.llmAvailable === false
            ? e(
                'p',
                { className: 'dshsl-warn' },
                t(
                  '本机没有可用的模型服务，点击按钮只会做本地格式整理。',
                  'No model service is available on this host; the button will only tidy formatting.',
                ),
              )
            : null,
          rules.error !== '' ? e('p', { className: 'dshsl-warn' }, rules.error) : null,

          ),

          // —— 底栏（只读目录页不显示保存类操作）——
          tab !== 'config'
            ? e(
                'div',
                { className: 'dshsl-page-foot' },
                e(
                  'span',
                  { className: 'dshsl-status' },
                  t('技能目录为只读视图', 'The skill catalog is read-only'),
                ),
              )
            : e(
            'div',
            { className: 'dshsl-page-foot' },
            e('span', { className: 'dshsl-status', 'data-dirty': rules.dirty ? '1' : '0', title: status }, status),
            e(
              'button',
              {
                type: 'button',
                className: 'dshsl-btn2',
                disabled: rules.busy,
                onClick: applyRestore,
              },
              t('恢复默认', 'Restore defaults'),
            ),
            e(
              'button',
              {
                type: 'button',
                className: 'dshsl-btn2',
                'data-primary': '1',
                disabled: rules.busy || !rules.dirty,
                onClick: applySave,
              },
              rules.busy ? t('保存中…', 'Saving…') : t('保存', 'Save'),
            ),
          ),
        )
      }

      /* -------------------------------------------------------------- *
       * 撤销提示
       * -------------------------------------------------------------- */

      function UndoToast(props) {
        var [position, setPosition] = React.useState(null)
        React.useLayoutEffect(
          function () {
            var rect = props.anchor()
            setPosition({ left: Math.max(8, rect.right - 300), top: rect.top - 42 })
          },
          [props],
        )
        if (position === null) return null
        return reactDom.createPortal(
          e(
            'div',
            { className: 'dshsl-toast', style: position, role: 'status' },
            e('span', { className: 'dshsl-toast-star', 'aria-hidden': 'true' }, e(StarIcon, { size: 13 })),
            e('span', { className: 'dshsl-toast-text' }, props.message),
            props.canUndo
              ? e('button', { type: 'button', className: 'dshsl-toast-btn', onClick: props.onUndo }, t('撤销', 'Undo'))
              : null,
          ),
          document.body,
        )
      }

      /* -------------------------------------------------------------- *
       * 按钮
       * -------------------------------------------------------------- */

      /** 快捷键：Mod+Shift+O（只在编辑区聚焦时生效）。 */
      function isShortcut(event) {
        var mod = event.metaKey || event.ctrlKey
        return mod === true && event.shiftKey === true && String(event.key || '').toLowerCase() === 'o'
      }

      function StarlightButton(props) {
        var handle = props.star && props.star.shell ? props.star.shell : null
        var route = props.star && props.star.route ? props.star.route : null
        var draft = useDraft(handle)
        var [state, setState] = React.useState('idle') // idle | busy | error | done
        var [panelOpen, setPanelOpen] = React.useState(false)
        var [toast, setToast] = React.useState(null) // { message, previous }
        var buttonRef = React.useRef(null)
        var longPressTimer = React.useRef(null)
        var errorTimer = React.useRef(null)
        var toastTimer = React.useRef(null)

        var anchor = React.useCallback(function () {
          var node = buttonRef.current
          if (node === null) return { left: 8, top: 8, right: 40, bottom: 40 }
          return node.getBoundingClientRect()
        }, [])

        var clearToast = React.useCallback(function () {
          if (toastTimer.current !== null) {
            clearTimeout(toastTimer.current)
            toastTimer.current = null
          }
          setToast(null)
        }, [])

        var optimize = React.useCallback(
          async function () {
            if (state === 'busy') return
            var text = draftOf(handle)
            if (text.trim() === '') return
            setState('busy')
            setToast(null)
            try {
              var payload = await requestJson('/optimize', {
                method: 'POST',
                body: { text: text, route: route },
              })
              var next = typeof payload.text === 'string' ? payload.text : ''
              if (next.trim() === '') throw new Error(t('优化结果为空', 'optimizer returned nothing'))
              if (writeDraft(handle, next) === false) {
                throw new Error(t('无法写回输入框', 'cannot write back to the composer'))
              }
              focusComposer(handle)
              setState('done')
              var bits = []
              if (payload.mode === 'model') {
                bits.push(t('已优化', 'Optimized'))
                // 优先显示目录里的友好名，拿不到才退回 model id
                bits.push(String(payload.modelName || payload.model || ''))
                if (typeof payload.elapsedMs === 'number') bits.push((payload.elapsedMs / 1000).toFixed(1) + 's')
              } else {
                bits.push(payload.degraded ? t('仅本地格式整理', 'local tidy only') : t('已整理格式', 'formatted'))
                if (payload.note) bits.push(String(payload.note))
              }
              setToast({
                message: bits.filter(Boolean).join(' · '),
                previous: text,
                tone: payload.mode === 'model' ? 'ok' : 'warn',
              })
              if (toastTimer.current !== null) clearTimeout(toastTimer.current)
              toastTimer.current = setTimeout(function () {
                toastTimer.current = null
                setToast(null)
                setState(function () {
                  return 'idle'
                })
              }, 9000)
            } catch (err) {
              setState('error')
              setToast({ message: String((err && err.message) || err), previous: '' })
              if (errorTimer.current !== null) clearTimeout(errorTimer.current)
              errorTimer.current = setTimeout(function () {
                errorTimer.current = null
                setState(function () {
                  return 'idle'
                })
              }, 4000)
              if (toastTimer.current !== null) clearTimeout(toastTimer.current)
              toastTimer.current = setTimeout(function () {
                toastTimer.current = null
                setToast(null)
              }, 6000)
            }
          },
          [draft, handle, route, state],
        )

        var undo = React.useCallback(
          function () {
            if (toast && toast.previous !== '') {
              writeDraft(handle, toast.previous)
              focusComposer(handle)
            }
            clearToast()
            setState('idle')
          },
          [clearToast, handle, toast],
        )

        // 组件卸载时清掉所有定时器，避免热重载后旧实例仍在改状态
        React.useEffect(
          function () {
            return function () {
              if (toastTimer.current !== null) clearTimeout(toastTimer.current)
              if (errorTimer.current !== null) clearTimeout(errorTimer.current)
              if (longPressTimer.current !== null) clearTimeout(longPressTimer.current)
            }
          },
          [],
        )

        // 输入框内快捷键：只在编辑区获得焦点时生效，避免抢全局按键
        React.useEffect(
          function () {
            if (!handle) return undefined
            function onKeyDown(event) {
              if (!isShortcut(event)) return
              var editor = null
              try {
                editor = handle.editor
              } catch (err) {}
              var rootNode = null
              try {
                rootNode = editor && typeof editor.getRootElement === 'function' ? editor.getRootElement() : null
              } catch (err) {}
              var active = document.activeElement
              var inComposer = rootNode !== null && (rootNode === active || rootNode.contains(active))
              if (!inComposer) return
              event.preventDefault()
              event.stopPropagation()
              optimize()
            }
            document.addEventListener('keydown', onKeyDown, true)
            return function () {
              document.removeEventListener('keydown', onKeyDown, true)
            }
          },
          [handle, optimize],
        )

        var disabled = state === 'busy' || handle === null || draft.trim() === ''
        var label =
          handle === null
            ? t('读不到输入面板：宿主版本可能不匹配', 'Composer facade unavailable: host version mismatch')
            : state === 'busy'
              ? t('正在优化…', 'Optimizing…')
              : draft.trim() === ''
                ? t('输入内容后可优化提示词', 'Type something to optimize')
                : t('一键优化提示词（右键看规则）', 'Optimize prompt (right-click for rules)')

        return e(
          'span',
          { className: 'dshsl-root' },
          e(
            'button',
            {
              ref: buttonRef,
              type: 'button',
              className: 'dshsl-btn',
              'data-state': state,
              'data-dsh-starlight': 'button',
              title: label,
              'aria-label': label,
              disabled: disabled,
              onMouseDown: function (event) {
                // 不让点击抢走编辑器焦点
                event.preventDefault()
              },
              onClick: function () {
                optimize()
              },
              onContextMenu: function (event) {
                event.preventDefault()
                setPanelOpen(true)
              },
              onPointerDown: function (event) {
                if (event.pointerType === 'mouse') return
                if (longPressTimer.current !== null) clearTimeout(longPressTimer.current)
                longPressTimer.current = setTimeout(function () {
                  longPressTimer.current = null
                  setPanelOpen(true)
                }, 520)
              },
              onPointerUp: function () {
                if (longPressTimer.current !== null) {
                  clearTimeout(longPressTimer.current)
                  longPressTimer.current = null
                }
              },
              onPointerCancel: function () {
                if (longPressTimer.current !== null) {
                  clearTimeout(longPressTimer.current)
                  longPressTimer.current = null
                }
              },
            },
            e(StarIcon, null),
          ),
          panelOpen
            ? e(StarPanel, {
                anchor: anchor,
                onClose: function () {
                  setPanelOpen(false)
                },
                onSaved: function () {
                  setToast({ message: t('规则已保存', 'Rules saved'), previous: '' })
                  if (toastTimer.current !== null) clearTimeout(toastTimer.current)
                  toastTimer.current = setTimeout(function () {
                    toastTimer.current = null
                    setToast(null)
                  }, 2200)
                },
              })
            : null,
          toast ? e(UndoToast, { anchor: anchor, message: toast.message, canUndo: toast.previous !== '', onUndo: undo }) : null,
        )
      }

      /* -------------------------------------------------------------- *
       * 插件入口
       * -------------------------------------------------------------- */

      /** 只有槽位注册表是硬依赖；会话/输入面板/设置全部按需读取。 */
      var inject = ['slots']

      function apply(ctx) {
        injectStyle()

        // ① composer 左侧席位：圆形四角星按钮
        ctx.slots.inject('conversation.input.left', function () {
          return ctx.slots.register(
            {
              name: 'conversation.input.left',
              id: ENTRY_ID,
              // 放在左侧簇的最前（order 越小越靠左），紧跟其后的才是官方附件/权限等按钮
              order: 10,
              inject: function (sessionId) {
                // 这里任何异常都会炸掉整个槽位渲染，所以整段包在 try 里：
                // 拿不到输入面板时退化成「只读按钮」，而不是让输入框消失。
                var star = { sessionId: sessionId, shell: null, route: null }
                try {
                  var sessions = typeof ctx.get === 'function' ? ctx.get('sessions') : null
                  var binding = sessions && typeof sessions.binding === 'function' ? sessions.binding(sessionId) : undefined
                  if (binding) {
                    try {
                      var conversation = binding.ctx && typeof binding.ctx.get === 'function' ? binding.ctx.get('conversation') : null
                      if (conversation && conversation.input) {
                        // 两条路径都试：按 sessionId 直取最省事；按 session 作用域取是官方示例写法。
                        // 任一失败都继续尝试另一条，绝不因为一个 facade 变体就没按钮。
                        if (typeof conversation.input.shell === 'function') {
                          try {
                            star.shell = conversation.input.shell(sessionId)
                          } catch (err) {
                            star.shell = null
                          }
                        }
                        if (star.shell == null && typeof conversation.input.for === 'function') {
                          try {
                            star.shell = conversation.input.for(binding.ctx)
                          } catch (err) {
                            star.shell = null
                          }
                        }
                      }
                    } catch (err) {
                      star.shell = null
                    }
                    try {
                      var projection = binding.session.projections.faceOf('modelSelection').getSnapshot()
                      var selection = projection && (projection.next || projection.lastUsed)
                      if (selection && selection.provider && selection.model) {
                        star.route = { provider: selection.provider, model: selection.model }
                      }
                    } catch (err) {
                      star.route = null
                    }
                  }
                } catch (err) {
                  star.shell = null
                }
                return { star: star }
              },
            },
            StarlightButton,
          )
        })

        // ② 设置页席位：设置 → 星芒提示词
        if (typeof ctx.slots.inject === 'function' && SECTION_ID !== '') {
          try {
            ctx.slots.inject('settings.section', function () {
              return ctx.slots.register(
                {
                  name: 'settings.section',
                  id: SECTION_ID,
                  order: 40,
                  // label 是求值函数：DSH 的设置导航按它取显示名
                  label: function () {
                    return t('星芒提示词', 'Starlight')
                  },
                },
                StarlightSettingsSection,
              )
            })
          } catch (err) {
            // 老宿主没有 settings.section 时只是没有设置页，按钮仍然可用。
            try {
              console.warn('[dsh-prompt-starlight] settings.section 槽位不可用，设置页未注册：', err)
            } catch (nested) {}
          }
        }
      }

      exports.apply = apply
      exports.inject = inject
      exports.StarlightButton = StarlightButton
      exports.StarlightSettingsSection = StarlightSettingsSection
      return module.exports
    },
  })
})()

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

      /** 模块身份：样式回收、日志前缀都用它。 */
      var PKG = 'dsh-prompt-starlight'
      /** 宿主路由前缀，与 lib/index.js 保持一致。 */
      var ROUTE = '/dsh-starlight'
      /** composer 槽位条目 id。 */
      var ENTRY_ID = 'dsh-starlight'
      /** 设置页 section id（同时是导航项 id）。 */
      var SECTION_ID = 'starlight'
      /** 浮层宽度（用于贴边钳制）。 */
      var PANEL_WIDTH = 344

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
        '.dshsl-panel{position:fixed;z-index:2147400000;width:344px;max-height:min(560px,calc(100vh - 32px));overflow:hidden;',
        'display:flex;flex-direction:column;box-sizing:border-box;border-radius:var(--dsw-radius-panel,14px);',
        'background:var(--dsw-alias-menu-surface-fill,var(--dsw-alias-bg-layer-2,#fff));',
        'border:.5px solid var(--dsw-alias-border-l3,rgba(127,127,127,.22));',
        'box-shadow:var(--dsw-elevation-panel,0 12px 40px rgba(0,0,0,.22));',
        'color:var(--dsw-alias-label-primary,#111);font-size:13px;line-height:1.5;',
        'backdrop-filter:var(--dsw-menu-backdrop-filter,none)}',
        '.dshsl-head{display:flex;align-items:center;gap:8px;padding:12px 14px 8px;flex:none}',
        '.dshsl-title{font-size:13px;font-weight:600;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
        '.dshsl-x{width:22px;height:22px;border:none;border-radius:6px;background:transparent;cursor:pointer;',
        'color:var(--dsw-alias-label-tertiary,#8a8f98);font-size:15px;line-height:1;padding:0;flex:none}',
        '.dshsl-x:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.14));color:var(--dsw-alias-label-primary,#111)}',
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
        '.dshsl-rule input{margin:2px 0 0;accent-color:var(--dsw-alias-state-business-primary,#4d6bfe);cursor:pointer;flex:none}',
        '.dshsl-rule-text{min-width:0;flex:1}',
        '.dshsl-rule-title{font-size:12.5px;line-height:18px}',
        '.dshsl-rule-note{font-size:11px;line-height:15px;color:var(--dsw-alias-label-caption,#9aa0a6)}',
        '.dshsl-ta{box-sizing:border-box;width:100%;min-height:64px;max-height:150px;resize:vertical;border-radius:8px;',
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
        '.dshsl-page-foot{position:sticky;bottom:0;display:flex;align-items:center;gap:8px;padding:12px 0 4px;',
        'background:linear-gradient(180deg,transparent,var(--dsw-alias-bg-base,#fff) 32%)}',
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
        '@media (min-width:560px){.dshsl-rules-grid{grid-template-columns:1fr 1fr}}',
        '.dshsl-group{grid-column:1/-1;display:flex;align-items:baseline;gap:8px;',
        'margin:10px 0 2px;padding:0 6px}',
        '.dshsl-group:first-child{margin-top:0}',
        '.dshsl-group-name{font-size:11px;font-weight:600;letter-spacing:.03em;text-transform:uppercase;',
        'color:var(--dsw-alias-label-caption,#9aa0a6)}',
        '.dshsl-group-note{font-size:11px;line-height:15px;color:var(--dsw-alias-label-tertiary,#8a8f98);',
        'min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
        '.dshsl-group-count{margin-left:auto;font-size:10.5px;line-height:14px;color:var(--dsw-alias-label-caption,#9aa0a6);flex:none}',
        '.dshsl-seg-note{margin:6px 0 0;min-height:15px;font-size:11.5px;line-height:15px;color:var(--dsw-alias-label-caption,#9aa0a6)}',
        '.dshsl-select{box-sizing:border-box;width:100%;height:30px;padding:0 28px 0 9px;border-radius:8px;font:inherit;font-size:12.5px;',
        'border:.5px solid var(--dsw-alias-border-l3,rgba(127,127,127,.25));',
        'background-color:var(--dsw-alias-bg-layer-1,transparent);color:var(--dsw-alias-label-primary,#111);',
        'outline:none;appearance:none;cursor:pointer;',
        'background-image:linear-gradient(45deg,transparent 50%,currentColor 50%),linear-gradient(135deg,currentColor 50%,transparent 50%);',
        'background-position:calc(100% - 15px) 13px,calc(100% - 10px) 13px;background-size:5px 5px,5px 5px;background-repeat:no-repeat}',
        '.dshsl-select:focus{border-color:var(--dsw-alias-state-business-primary,#4d6bfe)}',
        '.dshsl-select option{background:var(--dsw-alias-menu-surface-fill,#fff);color:var(--dsw-alias-label-primary,#111)}',
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
        '@media (prefers-reduced-motion: reduce){',
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

      /** 四角星（四尖、内凹）：用户要的「四角星」图标。 */
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

      /* -------------------------------------------------------------- *
       * 配置状态（浮层与设置页共用同一套读写逻辑）
       * -------------------------------------------------------------- */

      /** 把保存请求要提交的字段整理出来（浮层与设置页同一套）。 */
      function bodyOf(config, customText) {
        return {
          enabled: config.enabled !== false,
          style: config.style,
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
       * 内置规则勾选列表。
       * groups 有值时按 RULE_GROUPS 分组、宽屏两列；没有时退化成平铺单列。
       */
      function RuleList(props) {
        var disabledSet = {}
        ;((props.config && props.config.disabledRules) || []).forEach(function (id) {
          disabledSet[id] = true
        })

        var renderRule = function (rule) {
          return e(
            'label',
            { key: rule.id, className: 'dshsl-rule' },
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
              e('span', { className: 'dshsl-rule-note', style: { display: 'block' } }, pick(rule.note)),
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

        return e('div', { className: 'dshsl-rules-grid', 'data-dshsl-rules': '' }, children)
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
       * 模型下拉：第一个选项是「跟随会话当前模型」（= 不写 provider/model）。
       * @param {object} props catalog、value({provider, model})、onChange、compact
       */
      function ModelPicker(props) {
        var catalog = props.catalog
        var value = encodeRoute(props.value && props.value.provider, props.value && props.value.model)
        var options = []

        options.push(
          e(
            'option',
            { key: '__follow', value: MODEL_FOLLOW },
            t('跟随会话当前模型（推荐）', 'Follow the session model (recommended)'),
          ),
        )

        var known = false
        catalog.models.forEach(function (item) {
          var encoded = encodeRoute(item.provider, item.model)
          if (encoded === value) known = true
          options.push(
            e('option', { key: encoded, value: encoded }, item.provider + ' · ' + item.name),
          )
        })

        // 配置里写了一个目录里没有的模型（手改文件、provider 暂时不可用）时也要能显示出来
        if (value !== MODEL_FOLLOW && !known) {
          options.push(
            e('option', { key: '__saved', value: value }, t('已保存（目录中未列出）', 'Saved (not in catalog)') + ' · ' + props.value.provider + ' · ' + props.value.model),
          )
        }

        var followLabel = catalog.fallback
          ? t('当前会话模型：', 'Session model: ') + catalog.fallback.provider + ' · ' + catalog.fallback.model
          : t('宿主未报告默认模型', 'Host reported no default model')

        var notes = []
        if (catalog.status === 'loading') notes.push(t('正在读取可用模型…', 'Loading available models…'))
        if (catalog.status === 'error') notes.push(t('读不到模型目录：', 'Cannot read the model catalog: ') + catalog.message)
        if (catalog.status === 'ready' && catalog.models.length === 0) {
          notes.push(t('宿主没有公布任何模型，只能在配置文件里手写 provider/model。', 'The host advertises no models; provider/model must be written in the config file.'))
        }
        catalog.errors.forEach(function (item) {
          notes.push(item.provider + '：' + item.message)
        })
        if (value === MODEL_FOLLOW) notes.unshift(followLabel)

        return e(
          'div',
          null,
          e(
            'div',
            { style: { display: 'flex', alignItems: 'center', gap: 6 } },
            e(
              'select',
              {
                className: 'dshsl-select',
                value: value,
                'aria-label': t('优化使用的模型', 'Model used for optimization'),
                onChange: function (event) {
                  var next = decodeRoute(event.target.value)
                  props.onChange(next)
                },
              },
              options,
            ),
            props.onReload
              ? e(
                  'button',
                  {
                    type: 'button',
                    className: 'dshsl-btn3',
                    title: t('重新读取模型目录', 'Re-read the model catalog'),
                    disabled: catalog.status === 'loading',
                    onClick: props.onReload,
                  },
                  '⟳',
                )
              : null,
          ),
          notes.length === 0
            ? null
            : e(
                'p',
                { className: 'dshsl-models-note' },
                notes.join(' · '),
              ),
        )
      }

      /* -------------------------------------------------------------- *
       * 浮层面板（按钮右键 / 长按）
       * -------------------------------------------------------------- */

      /**
       * @param {object} props anchor(getBoundingClientRect)、onClose、onSaved
       */
      function StarPanel(props) {
        var rules = useRulesConfig()
        var catalog = useModelCatalog()
        var [position, setPosition] = React.useState(null)
        var rootRef = React.useRef(null)

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
              props.onClose()
            }
            function onKey(event) {
              if (event.key === 'Escape') {
                event.stopPropagation()
                props.onClose()
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
          body = e('div', { className: 'dshsl-row', style: { color: 'var(--dsw-alias-label-caption)' } }, t('读取规则…', 'Loading rules…'))
        } else {
          body = e(
            React.Fragment,
            null,
            e(
              'div',
              { className: 'dshsl-row' },
              e('span', { className: 'dshsl-label' }, t('风格', 'Style')),
              e(Segmented, {
                label: t('风格', 'Style'),
                items: rules.manifest.styles,
                value: rules.config.style,
                onChange: function (id) {
                  rules.patch({ style: id })
                },
              }),
            ),
            e(
              'div',
              { className: 'dshsl-row' },
              e('span', { className: 'dshsl-label' }, t('改写强度', 'Change budget')),
              e(Segmented, {
                label: t('改写强度', 'Change budget'),
                items: rules.manifest.depths,
                value: rules.config.depth,
                onChange: function (id) {
                  rules.patch({ depth: id })
                },
              }),
            ),
            e(
              'div',
              { className: 'dshsl-row' },
              e('span', { className: 'dshsl-label' }, t('输出语言', 'Output language')),
              e(Segmented, {
                label: t('输出语言', 'Output language'),
                items: rules.manifest.locales,
                value: rules.config.locale,
                onChange: function (id) {
                  rules.patch({ locale: id })
                },
              }),
            ),
            e(
              'div',
              { className: 'dshsl-row' },
              e('span', { className: 'dshsl-label' }, t('内置规则（取消勾选即停用）', 'Built-in rules (uncheck to disable)')),
              e(RuleList, {
                rules: rules.manifest.rules,
                groups: rules.manifest.ruleGroups,
                config: rules.config,
                onToggle: rules.toggleRule,
              }),
            ),
            e(
              'div',
              { className: 'dshsl-row' },
              e('span', { className: 'dshsl-label' }, t('自定义规则（每行一条）', 'Custom rules (one per line)')),
              e(CustomRulesField, { value: rules.customText, onChange: rules.setCustomText }),
            ),
            e('div', { className: 'dshsl-divider' }),
            e(
              'div',
              { className: 'dshsl-row' },
              e('span', { className: 'dshsl-label' }, t('优化模型', 'Optimizer model')),
              e(ModelPicker, {
                catalog: catalog,
                value: rules.config,
                onChange: function (next) {
                  rules.patch({ provider: next.provider, model: next.model })
                },
                onReload: catalog.reload,
              }),
            ),
            e(EnabledToggle, { config: rules.config, onPatch: rules.patch }),
            rules.manifest.llmAvailable === false
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

        var hint = rules.manifest ? t('右键按钮可再次打开 · 完整设置见「设置 → 星芒提示词」', 'Right-click to reopen · full page under Settings → Starlight') : ''

        return reactDom.createPortal(
          e(
            'div',
            {
              ref: rootRef,
              className: 'dshsl-panel',
              role: 'dialog',
              'aria-label': t('星芒 · 提示词优化规则', 'Starlight · prompt rules'),
              style: position === null ? { left: -9999, top: -9999 } : { left: position.left, top: position.top },
              onContextMenu: function (event) {
                event.preventDefault()
              },
            },
            e(
              'div',
              { className: 'dshsl-head' },
              e('span', { className: 'dshsl-hero-badge', style: { width: 24, height: 24, borderRadius: 8 }, 'aria-hidden': 'true' }, e(StarIcon, { size: 14 })),
              e(
                'span',
                { className: 'dshsl-title' },
                t('星芒 · 提示词规则', 'Starlight · prompt rules'),
                rules.dirty
                  ? e('span', { className: 'dshsl-pill', 'data-tone': 'warn' }, t('未保存', 'Unsaved'))
                  : null,
              ),
              e(
                'button',
                { type: 'button', className: 'dshsl-x', 'aria-label': t('关闭', 'Close'), onClick: props.onClose },
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
                  disabled: rules.busy || rules.config === null,
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

      /** 设置页/浮层共用的头部徽标（四角星 + 强调底）。 */
      function HeroBadge() {
        return e('span', { className: 'dshsl-hero-badge', 'aria-hidden': 'true' }, e(StarIcon, { size: 18 }))
      }

      /** 数字输入行（设置页高级区）。 */
      function NumberField(props) {
        return e(
          'label',
          { className: 'dshsl-field' },
          e('span', { className: 'dshsl-field-label' }, props.label),
          e('input', {
            className: 'dshsl-input',
            type: 'number',
            min: props.min,
            max: props.max,
            step: props.step,
            value: props.value,
            placeholder: props.placeholder || '',
            onChange: function (event) {
              var raw = event.target.value
              var next = raw === '' ? '' : Number(raw)
              props.onChange(next)
            },
          }),
        )
      }

      /**
       * 设置页主体。settings.section 槽位的 scope 是 root，
       * 组件只依赖自己的状态与宿主 HTTP 接口，不读取会话上下文。
       */
      function StarlightSettingsSection() {
        var rules = useRulesConfig()
        var catalog = useModelCatalog()
        var [flash, setFlash] = React.useState('')

        if (rules.error !== '' && rules.manifest === null) {
          return e(
            'div',
            { className: 'dshsl-page' },
            e(
              'div',
              { className: 'dshsl-hero' },
              e(HeroBadge, null),
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
              e(HeroBadge, null),
              e(
                'div',
                { className: 'dshsl-hero-text' },
                e('h2', { className: 'dshsl-page-h1' }, t('星芒提示词', 'Starlight')),
                e('p', { className: 'dshsl-page-sub', style: { margin: '4px 0 0' } }, t('读取配置…', 'Loading configuration…')),
              ),
            ),
            e(Skeleton, { widths: ['48%', '100%', '76%', '92%', '64%'] }),
          )
        }

        var config = rules.config
        var manifest = rules.manifest
        var allRuleIds = manifest.rules.map(function (rule) {
          return rule.id
        })
        var ruleCount = allRuleIds.length
        var offCount = (config.disabledRules || []).length

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
        var statusTone = rules.dirty ? 'warn' : 'ok'
        var enabledPill = config.enabled === false
          ? e('span', { className: 'dshsl-pill', 'data-tone': 'warn' }, t('已关闭', 'Off'))
          : e('span', { className: 'dshsl-pill', 'data-tone': 'ok' }, t('已启用', 'On'))
        var modelPill = config.provider !== '' && config.model !== ''
          ? e('span', { className: 'dshsl-pill' }, config.provider + ' · ' + config.model)
          : e('span', { className: 'dshsl-pill' }, t('跟随会话模型', 'Session model'))

        return e(
          'div',
          { className: 'dshsl-page' },
          // —— 头部 ——
          e(
            'div',
            { className: 'dshsl-hero' },
            e(HeroBadge, null),
            e(
              'div',
              { className: 'dshsl-hero-text' },
              e('h2', { className: 'dshsl-page-h1' }, t('星芒提示词优化', 'Starlight prompt optimizer'), enabledPill, modelPill),
              e(
                'p',
                { className: 'dshsl-page-sub', style: { margin: '4px 0 0' } },
                t(
                  '输入框左侧那个圆形四角星按钮的全部行为都在这里配置。改动保存后对下一次点击生效，不需要重启。',
                  'Everything the circular four-pointed-star button in the composer does is configured here. Saved changes apply to the next click — no restart.',
                ),
              ),
            ),
          ),

          // —— 总开关 ——
          e(
            'section',
            { className: 'dshsl-card' },
            e('div', { className: 'dshsl-card-head' }, e('h3', { className: 'dshsl-card-title' }, t('开关', 'Switch'))),
            e(
              'p',
              { className: 'dshsl-card-desc' },
              t('关掉后按钮仍在，但只做本地格式整理（去行尾空白 / 压空行 / 统一列表符号）。', 'When off the button stays but only tidies formatting locally.'),
            ),
            e(EnabledToggle, { config: config, onPatch: rules.patch }),
          ),

          // —— 风格 / 强度 / 语言 ——
          e(
            'section',
            { className: 'dshsl-card' },
            e('div', { className: 'dshsl-card-head' }, e('h3', { className: 'dshsl-card-title' }, t('改写形态', 'Rewrite shape'))),
            e(
              'p',
              { className: 'dshsl-card-desc' },
              t('风格决定「写成什么形状」，强度决定「改动多少」，两者独立。', 'Style picks the shape; change budget picks how much moves. They are independent.'),
            ),
            e(
              'div',
              { className: 'dshsl-row' },
              e('span', { className: 'dshsl-label' }, t('风格', 'Style')),
              e(Segmented, {
                label: t('风格', 'Style'),
                items: manifest.styles,
                value: config.style,
                onChange: function (id) {
                  rules.patch({ style: id })
                },
              }),
            ),
            e(
              'div',
              { className: 'dshsl-row' },
              e('span', { className: 'dshsl-label' }, t('改写强度', 'Change budget')),
              e(Segmented, {
                label: t('改写强度', 'Change budget'),
                items: manifest.depths,
                value: config.depth,
                onChange: function (id) {
                  rules.patch({ depth: id })
                },
              }),
            ),
            e(
              'div',
              { className: 'dshsl-row', style: { marginBottom: 0 } },
              e('span', { className: 'dshsl-label' }, t('输出语言', 'Output language')),
              e(Segmented, {
                label: t('输出语言', 'Output language'),
                items: manifest.locales,
                value: config.locale,
                onChange: function (id) {
                  rules.patch({ locale: id })
                },
              }),
            ),
          ),

          // —— 内置规则 ——
          e(
            'section',
            { className: 'dshsl-card' },
            e(
              'div',
              { className: 'dshsl-card-head' },
              e(
                'h3',
                { className: 'dshsl-card-title' },
                t('内置规则', 'Built-in rules'),
                e('span', { className: 'dshsl-badge' }, ruleCount - offCount + ' / ' + ruleCount),
              ),
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
            e(
              'p',
              { className: 'dshsl-card-desc' },
              t(
                '四条护栏（保真 / 保留技术标识 / 不编造 / 声明假设）建议保持开启；另外七条按你的习惯取舍。',
                'Keep the four guard rules (fidelity, verbatim identifiers, no invention, assumptions) on; tune the other seven to taste.',
              ),
            ),
            e(RuleList, { rules: manifest.rules, groups: manifest.ruleGroups, config: config, onToggle: rules.toggleRule }),
          ),

          // —— 自定义规则 ——
          e(
            'section',
            { className: 'dshsl-card' },
            e('div', { className: 'dshsl-card-head' }, e('h3', { className: 'dshsl-card-title' }, t('自定义规则', 'Custom rules'))),
            e(
              'p',
              { className: 'dshsl-card-desc' },
              t(
                '每行一条，优先级高于内置规则（不可协商的五条护栏除外）。想把内置规则整体换掉，就把上面全部关掉再写这里。',
                'One per line. These outrank the built-in rules except the five non-negotiables. To replace the whole rule set, turn everything above off and write here.',
              ),
            ),
            e(CustomRulesField, { value: rules.customText, onChange: rules.setCustomText }),
          ),

          // —— 模型 ——
          e(
            'section',
            { className: 'dshsl-card' },
            e('div', { className: 'dshsl-card-head' }, e('h3', { className: 'dshsl-card-title' }, t('优化模型', 'Optimizer model'))),
            e(
              'p',
              { className: 'dshsl-card-desc' },
              t(
                '默认跟随会话当前使用的模型。想用更便宜/更快的模型做改写，就在这里固定一个——只影响星芒的旁路调用，不动你的会话模型。',
                'By default the optimizer follows the session model. Pin a cheaper or faster model here to do the rewriting — this only affects Starlight’s side call, never your session model.',
              ),
            ),
            e(ModelPicker, {
              catalog: catalog,
              value: config,
              onChange: function (next) {
                rules.patch({ provider: next.provider, model: next.model })
              },
              onReload: catalog.reload,
            }),
          ),

          // —— 高级 ——
          e(
            'section',
            { className: 'dshsl-card' },
            e('div', { className: 'dshsl-card-head' }, e('h3', { className: 'dshsl-card-title' }, t('高级', 'Advanced'))),
            e(
              'p',
              { className: 'dshsl-card-desc' },
              t(
                '输出上限会随草稿长度二次缩放，但永远不会超过这里填的值；温度越低改写越稳定，越高越会自由发挥。',
                'The output cap scales with draft length but never exceeds the value here. Lower temperature rewrites more conservatively; higher drifts more freely.',
              ),
            ),
            e(
              'div',
              { className: 'dshsl-fields' },
              e(NumberField, {
                label: t('输出上限 maxTokens', 'Max output tokens'),
                value: config.maxTokens,
                min: 256,
                max: 8000,
                step: 64,
                onChange: function (value) {
                  rules.patch({ maxTokens: value === '' ? config.maxTokens : value })
                },
              }),
              e(NumberField, {
                label: t('温度 temperature', 'Temperature'),
                value: config.temperature,
                min: 0,
                max: 1.5,
                step: 0.05,
                onChange: function (value) {
                  rules.patch({ temperature: value === '' ? config.temperature : value })
                },
              }),
              e(NumberField, {
                label: t('超时 timeoutMs', 'Timeout (ms)'),
                value: config.timeoutMs,
                min: 5000,
                max: 300000,
                step: 1000,
                onChange: function (value) {
                  rules.patch({ timeoutMs: value === '' ? config.timeoutMs : value })
                },
              }),
            ),
          ),

          // —— 配置文件 ——
          e(
            'section',
            { className: 'dshsl-card' },
            e('div', { className: 'dshsl-card-head' }, e('h3', { className: 'dshsl-card-title' }, t('配置文件', 'Config file'))),
            e(
              'p',
              { className: 'dshsl-card-desc' },
              t(
                '设置页与配置文件是同一份数据；手改文件后重开本页即可看到（按 mtime 检测，秒级生效）。',
                'This page and the config file are the same data. Hand edits show up when you reopen this page (mtime-based, applies within a second).',
              ),
            ),
            e('p', { className: 'dshsl-path' }, String(manifest.configFile || '')),
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

          // —— 底栏 ——
          e(
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

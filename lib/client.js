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
      /** 槽位里的条目 id。 */
      var ENTRY_ID = 'dsh-starlight'
      /** 面板宽度（用于贴边钳制）。 */
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
        // 圆形按钮
        '.dshsl-btn{position:relative;box-sizing:border-box;width:28px;height:28px;padding:0;border:none;border-radius:999px;',
        'display:inline-flex;align-items:center;justify-content:center;background:transparent;color:var(--dsw-alias-label-tertiary,#8a8f98);',
        'cursor:pointer;transition:background .15s ease,color .15s ease,transform .12s ease;outline:none;-webkit-tap-highlight-color:transparent}',
        '.dshsl-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.14));color:var(--dsw-alias-label-primary,#111)}',
        '.dshsl-btn:active:not(:disabled){transform:scale(.92)}',
        '.dshsl-btn:focus-visible{box-shadow:0 0 0 var(--dsw-focus-ring-width,2px) var(--dsw-focus-ring-color,rgba(77,107,254,.6))}',
        '.dshsl-btn:disabled{cursor:default;opacity:.38}',
        '.dshsl-btn[data-state=busy]{color:var(--dsw-alias-state-business-primary,#4d6bfe);cursor:progress;opacity:1}',
        '.dshsl-btn[data-state=busy] .dshsl-star{animation:dshsl-spin 1.1s linear infinite}',
        '.dshsl-btn[data-state=error]{color:var(--dsw-alias-state-error-primary,#e5484d);opacity:1}',
        '.dshsl-btn[data-state=done]{color:var(--dsw-alias-state-success-primary,#2f9e44)}',
        '@keyframes dshsl-spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}',
        '.dshsl-star{display:block;width:16px;height:16px;pointer-events:none}',
        // 面板
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
      function StarIcon() {
        return e(
          'svg',
          {
            className: 'dshsl-star',
            viewBox: '0 0 24 24',
            width: 16,
            height: 16,
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
       * 面板
       * -------------------------------------------------------------- */

      function Segmented(props) {
        return e(
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
        )
      }

      /**
       * 规则面板：风格 / 强度 / 语言 / 内置规则开关 / 自定义规则。
       * @param {object} props onClose, anchor(getBoundingClientRect), onSaved
       */
      function StarPanel(props) {
        var [manifest, setManifest] = React.useState(null)
        var [error, setError] = React.useState('')
        var [saving, setSaving] = React.useState(false)
        var [draftConfig, setDraftConfig] = React.useState(null)
        var [position, setPosition] = React.useState(null)
        var [customText, setCustomText] = React.useState('')
        var rootRef = React.useRef(null)

        // 拉取目录 + 当前配置
        React.useEffect(
          function () {
            var alive = true
            requestJson('/manifest')
              .then(function (payload) {
                if (!alive) return
                setManifest(payload)
                setDraftConfig(payload.config)
                setCustomText((payload.config.customRules || []).join('\n'))
              })
              .catch(function (err) {
                if (alive) setError(String(err.message || err))
              })
            return function () {
              alive = false
            }
          },
          [],
        )

        // 定位：贴在按钮上方，并钳制在视口内
        var place = React.useCallback(function () {
          var rect = props.anchor()
          var height = rootRef.current ? rootRef.current.getBoundingClientRect().height : 420
          var viewportW = window.innerWidth
          var viewportH = window.innerHeight
          var left = Math.min(Math.max(8, rect.right - PANEL_WIDTH), Math.max(8, viewportW - PANEL_WIDTH - 8))
          var top = rect.top - height - 10
          if (top < 8) top = Math.min(viewportH - height - 8, rect.bottom + 10)
          setPosition({ left: left, top: Math.max(8, top) })
        }, [props])

        React.useLayoutEffect(
          function () {
            place()
          },
          [place, manifest],
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

        var patch = function (change) {
          setDraftConfig(function (previous) {
            return Object.assign({}, previous, change)
          })
        }

        var toggleRule = function (id, enabled) {
          var disabled = (draftConfig && draftConfig.disabledRules) || []
          var next = enabled ? disabled.filter(function (entry) { return entry !== id }) : disabled.concat([id])
          patch({ disabledRules: next })
        }

        var save = function () {
          if (draftConfig === null) return
          setSaving(true)
          setError('')
          var body = {
            style: draftConfig.style,
            locale: draftConfig.locale,
            depth: draftConfig.depth,
            enabled: draftConfig.enabled !== false,
            disabledRules: draftConfig.disabledRules || [],
            customRules: customText
              .split('\n')
              .map(function (line) { return line.trim() })
              .filter(Boolean),
          }
          requestJson('/config', { method: 'POST', body: body })
            .then(function (payload) {
              setManifest(payload)
              setDraftConfig(payload.config)
              setCustomText((payload.config.customRules || []).join('\n'))
              props.onSaved(payload.config)
            })
            .catch(function (err) {
              setError(String(err.message || err))
            })
            .then(function () {
              setSaving(false)
            })
        }

        var restore = function () {
          setSaving(true)
          setError('')
          requestJson('/reset', { method: 'POST', body: {} })
            .then(function (payload) {
              setManifest(payload)
              setDraftConfig(payload.config)
              setCustomText((payload.config.customRules || []).join('\n'))
              props.onSaved(payload.config)
            })
            .catch(function (err) {
              setError(String(err.message || err))
            })
            .then(function () {
              setSaving(false)
            })
        }

        var body
        if (error !== '' && manifest === null) {
          body = e('div', { className: 'dshsl-row dshsl-warn' }, error)
        } else if (manifest === null || draftConfig === null) {
          body = e('div', { className: 'dshsl-row', style: { color: 'var(--dsw-alias-label-caption)' } }, t('读取规则…', 'Loading rules…'))
        } else {
          var disabledSet = {}
          ;(draftConfig.disabledRules || []).forEach(function (id) { disabledSet[id] = true })
          body = e(
            React.Fragment,
            null,
            e(
              'div',
              { className: 'dshsl-row' },
              e('span', { className: 'dshsl-label' }, t('风格', 'Style')),
              e(Segmented, {
                label: t('风格', 'Style'),
                items: manifest.styles,
                value: draftConfig.style,
                onChange: function (id) { patch({ style: id }) },
              }),
            ),
            e(
              'div',
              { className: 'dshsl-row' },
              e('span', { className: 'dshsl-label' }, t('改写强度', 'Change budget')),
              e(Segmented, {
                label: t('改写强度', 'Change budget'),
                items: manifest.depths,
                value: draftConfig.depth,
                onChange: function (id) { patch({ depth: id }) },
              }),
            ),
            e(
              'div',
              { className: 'dshsl-row' },
              e('span', { className: 'dshsl-label' }, t('输出语言', 'Output language')),
              e(Segmented, {
                label: t('输出语言', 'Output language'),
                items: manifest.locales,
                value: draftConfig.locale,
                onChange: function (id) { patch({ locale: id }) },
              }),
            ),
            e(
              'div',
              { className: 'dshsl-row' },
              e(
                'span',
                { className: 'dshsl-label' },
                t('内置规则（取消勾选即停用）', 'Built-in rules (uncheck to disable)'),
              ),
              e(
                'div',
                { className: 'dshsl-rules' },
                manifest.rules.map(function (rule) {
                  return e(
                    'label',
                    { key: rule.id, className: 'dshsl-rule' },
                    e('input', {
                      type: 'checkbox',
                      checked: !disabledSet[rule.id],
                      onChange: function (event) { toggleRule(rule.id, event.target.checked) },
                    }),
                    e(
                      'span',
                      { className: 'dshsl-rule-text' },
                      e('span', { className: 'dshsl-rule-title' }, pick(rule.title)),
                      e('span', { className: 'dshsl-rule-note', style: { display: 'block' } }, pick(rule.note)),
                    ),
                  )
                }),
              ),
            ),
            e(
              'div',
              { className: 'dshsl-row' },
              e('span', { className: 'dshsl-label' }, t('自定义规则（每行一条）', 'Custom rules (one per line)')),
              e('textarea', {
                className: 'dshsl-ta',
                value: customText,
                spellCheck: false,
                placeholder: t(
                  '例如：\n输出必须包含「验收标准」小节\n不要使用「请确保」这类空话',
                  'e.g.\nAlways include an Acceptance section\nNever use filler like "please make sure"',
                ),
                onChange: function (event) { setCustomText(event.target.value) },
              }),
            ),
            e(
              'label',
              { className: 'dshsl-rule', style: { marginTop: -4 } },
              e('input', {
                type: 'checkbox',
                checked: draftConfig.enabled !== false,
                onChange: function (event) { patch({ enabled: event.target.checked }) },
              }),
              e(
                'span',
                { className: 'dshsl-rule-text' },
                e('span', { className: 'dshsl-rule-title' }, t('启用星芒按钮', 'Enable the starlight button')),
                e(
                  'span',
                  { className: 'dshsl-rule-note', style: { display: 'block' } },
                  t('关闭后按钮只做本地格式整理', 'When off, the button only tidies formatting locally'),
                ),
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
            error !== '' ? e('p', { className: 'dshsl-warn' }, error) : null,
          )
        }

        return reactDom.createPortal(
          e(
            'div',
            {
              ref: rootRef,
              className: 'dshsl-panel',
              role: 'dialog',
              'aria-label': t('提示词优化规则', 'Prompt optimization rules'),
              style: position === null ? { left: -9999, top: -9999 } : { left: position.left, top: position.top },
              onContextMenu: function (event) { event.preventDefault() },
            },
            e(
              'div',
              { className: 'dshsl-head' },
              e('span', { className: 'dshsl-title' }, t('星芒 · 提示词优化规则', 'Starlight · Prompt rules')),
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
            e('div', { className: 'dshsl-body' }, body),
            e(
              'div',
              { className: 'dshsl-foot' },
              e(
                'span',
                { className: 'dshsl-hint', title: manifest ? manifest.configFile : '' },
                t('右键按钮也可打开此面板', 'Right-click the button to reopen'),
              ),
              e(
                'button',
                { type: 'button', className: 'dshsl-btn2', disabled: saving, onClick: restore },
                t('恢复默认', 'Defaults'),
              ),
              e(
                'button',
                {
                  type: 'button',
                  className: 'dshsl-btn2',
                  'data-primary': '1',
                  disabled: saving || draftConfig === null,
                  onClick: save,
                },
                saving ? t('保存中…', 'Saving…') : t('保存', 'Save'),
              ),
            ),
          ),
          document.body,
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
            e('span', { className: 'dshsl-toast-text' }, props.message),
            props.canUndo
              ? e(
                  'button',
                  { type: 'button', className: 'dshsl-toast-btn', onClick: props.onUndo },
                  t('撤销', 'Undo'),
                )
              : null,
          ),
          document.body,
        )
      }

      /* -------------------------------------------------------------- *
       * 按钮
       * -------------------------------------------------------------- */

      /** 默认快捷键（面板里可改配置字段，这里只认默认值即可）。 */
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
                bits.push(t('已用提示词规则优化', 'Optimized with prompt rules'))
                if (payload.model) bits.push(String(payload.model))
                if (typeof payload.elapsedMs === 'number') bits.push((payload.elapsedMs / 1000).toFixed(1) + 's')
              } else {
                bits.push(payload.degraded ? t('仅本地格式整理', 'local tidy only') : t('已整理格式', 'formatted'))
                if (payload.note) bits.push(String(payload.note))
              }
              setToast({ message: bits.join(' · '), previous: text })
              if (toastTimer.current !== null) clearTimeout(toastTimer.current)
              toastTimer.current = setTimeout(function () {
                toastTimer.current = null
                setToast(null)
                setState(function () { return 'idle' })
              }, 9000)
            } catch (err) {
              setState('error')
              setToast({ message: String((err && err.message) || err), previous: '' })
              if (errorTimer.current !== null) clearTimeout(errorTimer.current)
              errorTimer.current = setTimeout(function () {
                errorTimer.current = null
                setState(function () { return 'idle' })
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
        var label = handle === null
          ? t('读不到输入面板：宿主版本可能不匹配', 'Composer facade unavailable: host version mismatch')
          : state === 'busy'
            ? t('正在优化…', 'Optimizing…')
            : draft.trim() === ''
              ? t('输入内容后可优化提示词', 'Type something to optimize')
              : t('一键优化提示词（右键配置规则）', 'Optimize prompt (right-click for rules)')

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

      /** 只有槽位注册表是硬依赖；会话/输入面板全部按需读取。 */
      var inject = ['slots']

      function apply(ctx) {
        injectStyle()

        ctx.slots.inject('conversation.input.right', function () {
          return ctx.slots.register(
            {
              name: 'conversation.input.right',
              id: ENTRY_ID,
              order: 60,
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
      }

      exports.apply = apply
      exports.inject = inject
      exports.StarlightButton = StarlightButton
      return module.exports
    },
  })
})()

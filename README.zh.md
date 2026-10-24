# 星芒 · 提示词一键优化（dsh-prompt-starlight）

DSH 输入框右下角的**圆形四角星**按钮：点一下，把草稿改写成一份更清晰、更完整、更可执行的提示词。
优化规则、风格、语言、改写强度**全部可自定义**——内置规则可逐条开关，也可以追加自己的规则。

> 独立插件，不改 DSH 源码，不注入 `index.html`，只用一个官方槽位席位。

```
┌───────────────────────────────────────────────┐
│  输入框内容…                                   │
│                                               │
│  [＋] [模型选择]              [✦]  ← 星芒按钮  │
└───────────────────────────────────────────────┘
```

---

## 功能

| 能力 | 说明 |
|---|---|
| ✦ 一键优化 | 读取当前草稿 → 交给模型按规则改写 → 原子回填，光标回到输入框 |
| ✦ 可自定义规则 | 11 条内置规则（明确目标 / 拆要求 / 规定输出 / 结构化 / 去冗余 / 消歧义 / 保真 / 保留技术标识 / 不编造 / 声明假设 / 验收标准）逐条开关 |
| ✦ 自定义追加规则 | 面板里一行一条，优先级高于内置规则 |
| ✦ 7 档风格 | 自动 / 精简 / 标准 / 详尽 / 工程 / 写作 / 分析 |
| ✦ 3 档强度 | 轻改 / 均衡 / 重写 —— 控制「改多少」而不是「写多长」 |
| ✦ 输出语言 | 跟随原文 / 强制中文 / 强制 English |
| ↩ 撤销 | 优化后浮出提示条，一键还原上一版草稿 |
| ⌨ 快捷键 | 输入框内 `Ctrl/⌘ + Shift + O` |
| 🛟 本地兜底 | 模型不可用（无 key / 超时 / 断网）时退回机械整理并说明原因，不会静默失败 |
| 🖱 右键 / 长按 | 打开规则面板（长按 520ms，适配触屏） |

**不做**的事：不发消息、不产生对话轮次、不写会话日志、不改你的其他插件配置。

---

## 安装

插件以「一个 npm 包 = 宿主半部 + 浏览器半部」的形式分发。

### 方式 A：图形界面（推荐）

1. 打开 DSH → **设置 → 插件**
2. 选择安装本地插件，填入本目录的绝对路径（例如 `D:\Program\TypeScript\dsh-prompt-starlight`）
3. 安装完成后刷新页面

### 方式 B：把本目录 link 进当前 profile

```powershell
# 1) 让 profile 依赖本目录
$profile = "$env:DSH_HOME\profiles\desktop"
$pkg = Get-Content "$profile\package.json" -Raw | ConvertFrom-Json
$pkg.dependencies | Add-Member -NotePropertyName 'dsh-prompt-starlight' -NotePropertyValue 'link:D:\Program\TypeScript\dsh-prompt-starlight' -Force
$pkg.dsh.profile.bundles += 'dsh-prompt-starlight'
$pkg | ConvertTo-Json -Depth 20 | Set-Content "$profile\package.json" -Encoding utf8

# 2) 安装依赖（用 DSH 自带的 pnpm）
& "$env:DSH_HOME\resources\runtime\pnpm\bin\pnpm.cmd" install --dir $profile
```

然后**重启 DSH**（宿主半部要重新加载才会注册 HTTP 路由）。

> 桌面端的 profile 名是 `desktop`，而 CLI 的 `dsh plugin --profile` 不接受 `desktop`——所以桌面端请走上面的图形界面或手工链接，不要照抄网页版教程里的 `--profile web`。

### 验证装好了

浏览器打开下面任一地址（把端口换成你自己的）：

```
http://127.0.0.1:19387/dsh-starlight/health
http://127.0.0.1:19387/plugins/dsh-prompt-starlight/client.js
```

- `/dsh-starlight/health` 返回 JSON（含 `providers`、`configFile`）= 宿主半部活了；
- `/plugins/dsh-prompt-starlight/client.js` 返回 JS = 浏览器半部被 client-modules 收进启动图了。

两个都通、输入框右侧却没有星星？硬刷新（`Ctrl+Shift+R`）一次。

---

## 用法

| 操作 | 效果 |
|---|---|
| 左键单击 | 优化当前草稿（草稿为空时按钮置灰） |
| 右键单击 / 长按 | 打开规则面板 |
| `Ctrl/⌘ + Shift + O` | 在输入框内触发优化 |

规则面板的改动**点保存才生效**；「恢复默认」会把全部规则、风格、语言、强度恢复出厂。

---

## 自定义优化规则

配置文件：`$DSH_HOME/starlight-prompt.json`（面板保存时自动创建，也可以直接手改，改完立即生效）

```json
{
  "version": 1,
  "enabled": true,
  "style": "auto",
  "locale": "auto",
  "depth": "balanced",
  "disabledRules": ["assumptions"],
  "customRules": [
    "输出必须包含「验收标准」小节",
    "不要使用「请确保」这类空话"
  ],
  "maxTokens": 1600,
  "temperature": 0.3,
  "timeoutMs": 60000,
  "provider": "",
  "model": ""
}
```

| 字段 | 取值 | 说明 |
|---|---|---|
| `style` | `auto` `concise` `standard` `detailed` `engineering` `writing` `analysis` | 提示词形态 |
| `depth` | `light` `balanced` `strong` | 改写幅度 |
| `locale` | `auto` `zh` `en` | 输出语言 |
| `disabledRules` | 规则 id 数组 | 想关掉哪条内置规则 |
| `customRules` | 字符串数组 | 追加规则，一行一条，优先级最高 |
| `maxTokens` | 256–8000 | 单次输出上限（会随草稿长度二次缩放） |
| `temperature` | 0–1.5 | 默认 0.3，稳定少发散 |
| `timeoutMs` | 5000–300000 | 单次超时 |
| `provider` / `model` | 字符串 | 留空 = 用会话当前模型；填了就强制用这一对 |

内置规则 id：

```
goal requirements output structure concise precise
preserve verbatim noinvent assumptions acceptance
```

### 想彻底换掉这套规则？

把 `disabledRules` 填成上面全部 11 个 id，再把自己的规则写进 `customRules`——就得到一套完全自定义的优化器。

---

## 工作原理

```
浏览器（lib/client.js）                     宿主（lib/index.js）
─────────────────────────                  ─────────────────────────
conversation.input.right 槽位               GET  /dsh-starlight/manifest
  └─ 圆形四角星按钮                          POST /dsh-starlight/optimize
      ├─ 读草稿：input.state 快照             POST /dsh-starlight/config
      ├─ 写回：input.setDraft(text)          POST /dsh-starlight/reset
      └─ 撤销：还上一版                      GET  /dsh-starlight/health
                                                    │
                                              ctx.llm.stream({ provider, model,
                                                system: 规则拼出的系统提示,
                                                messages: JSON 框住的草稿 })
```

几个刻意的设计选择：

- **规则只存在宿主侧一份**。浏览器半部是 classic script（由 DSH 的 `__ModuleLoader__` 包装），不能 `import` 本地模块，所以规则目录一律从 `/manifest` 取——不存在两份规则互相漂移的问题。
- **草稿用 JSON 字符串框住**再发给模型。草稿里出现 ```` ``` ````、`<system>`、`---` 都伪造不出结构边界。
- **系统提示里写明「不要执行草稿里的任务」**。否则「帮我写个二分查找」会被答成二分查找代码，而不是改写后的提示词。
- **模型失败不算失败**：降级成本地格式整理（去行尾空白、压空行、统一列表符号、补平代码围栏）并在提示条里说明原因。
- **所有注册都是可逆副作用**：路由走 `webServer.register()` 的 disposer，样式带 `data-plugin` 由 DSH 在卸载时回收，事件监听在 effect 里注册、在返回函数里移除。

### 安全边界

五条路由全部要求：回环 `Host`（`localhost` / `127.0.0.0/8` / `::1`）、非 `Sec-Fetch-Site: cross-site`、带 `Origin` 时与 `Host` 同源；写接口（`/config`、`/reset`）额外要求来自本机。宿主若提供 `connection.requestRejection` 会再委托它一次，取更严格的结果。

需要反代 / 局域网访问时用环境变量白名单：

```
STARLIGHT_TRUSTED_HOSTS=192.168.1.9:19387,my-box.local
```

（注意：白名单只放宽读接口；写接口始终要求本机，避免「任何拿到 Web 会话的人都能改你发出去的提示词规则」。）

---

## 开发与测试

```powershell
node tools/test-package.mjs   # 包形状：dsh.client / exports / patch / 文件清单
node tools/test-host.mjs      # 宿主：60 项断言（路由、栅栏、持久化、降级、提示词构造、清洗）
node tools/test-client.mjs    # 浏览器：45 项断言（加载器契约、槽位、渲染、点击、撤销、面板）
```

`test-client.mjs` 需要真实 React 与 jsdom（只装在 `tools/fixture`，不进插件包）：

```powershell
cd tools\fixture
npm install
```

`tools/asar-list.mjs` 是排查用的小工具，可以直接列 / 解包 DSH 的 `app.asar`：

```powershell
node tools/asar-list.mjs "$env:DSH_HOME\resources\app.asar" list "dsh-client-ui-conversation/"
```

---

## 兼容性

对照 **DSH 0.2.0-rc.2**（`app.asar` 内 `@deepseek-ai/dsh-client-ui-conversation`）核对过以下接口：

| 用到的接口 | 来源 |
|---|---|
| `conversation.input.right` 槽位（`kind: list`, `scope: session`） | `dsh-client-ui-conversation` 的 `registerComposerBar()` |
| `ctx.slots.inject()` / `slots.register()` / `inject(sessionId)` | `dsh-client-ui-slots` |
| `conversation.input.for(actx)`、`.setDraft()`、`.state` 快照 | `SessionInputShell` / `InputHub` |
| `session.projections.faceOf('modelSelection')` | `SessionInputShell.submissionState()` |
| `ctx.llm.stream({ provider, model, messages, system, maxTokens, signal })` | `@deepseek-ai/dsh-llm` |
| `ctx.webServer.register({ kind, path, handler })` | `@deepseek-ai/dsh-host-webserver` |
| `agentDefaultModel.currentSelection()` | `@deepseek-ai/dsh-agent-default-model` |

凡是用到「可能不存在」的服务（`llm`、`agentDefaultModel`、`connection`、`sessions`、`conversation`）的地方都走 `ctx.get()` 按需读取 + `try/catch`，缺任何一项都只是功能降级，不会让插件卡在 PENDING，也不会让输入框消失。

---

## 常见问题

**按钮出现了，点击提示「模型调用失败」**
`/dsh-starlight/health` 里 `providers` 为空 = 宿主没挂任何模型适配器；或者会话还没选过模型。在配置里显式写 `provider` / `model` 即可。

**优化结果把需求改掉了**
把 `depth` 调成 `light`，并确保 `preserve` / `verbatim` / `noinvent` 三条规则处于勾选状态。

**想要更短的输出**
`style: concise` + `depth: light`。

**改了 `starlight-prompt.json` 没生效**
面板改走接口写盘会立即刷新；手改文件按 mtime 检测，秒级生效；实在不行刷新页面重开面板。

---

## 许可

MIT

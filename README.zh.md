# 星芒 · 提示词一键优化（dsh-prompt-starlight）

DSH 输入框工具行**左侧**的**圆形四角星**按钮（自带一圈描边光晕，从工具行里浮出来）：点一下，把草稿改写成一份更清晰、更完整、更可执行的提示词。
优化规则、风格、语言、改写强度**全部可自定义**——内置规则可逐条开关，也可以追加自己的规则，并且有**独立设置页**（设置 → 星芒提示词）。

> 独立插件，不改 DSH 源码，不注入 `index.html`，只占两个官方槽位席位。

```
┌───────────────────────────────────────────────┐
│  输入框内容…                                   │
│                                               │
│  (✦) [＋] [权限]           [模型选择] [发送]   │
│   └ 星芒按钮（左侧，带外圈光环）                │
└───────────────────────────────────────────────┘
```

---

## 功能

| 能力 | 说明 |
|---|---|
| ✦ 一键优化 | 读取当前草稿 → 交给模型按规则改写 → 原子回填，光标回到输入框 |
| ✦ 可自定义规则 | 11 条内置规则，按「基础结构 / 表达质量 / 保真护栏」分组展示，逐条开关 + 分组计数 + 「全开 / 全关」 |
| ✦ 自定义追加规则 | 一行一条，优先级高于内置规则 |
| ✦ 7 档风格 | 自动 / 精简 / 标准 / 详尽 / 工程 / 写作 / 分析（选中项下方直接显示该档说明） |
| ✦ 3 档强度 | 轻改 / 均衡 / 重写 —— 控制「改多少」而不是「写多长」 |
| ✦ 输出语言 | 跟随原文 / 强制中文 / 强制 English |
| 🎛 **模型切换** | 下拉可选宿主已挂载的任意模型（`provider · 友好名`），默认「跟随会话当前模型」；只影响星芒的旁路调用，不动你的会话模型 |
| ⚙ **独立设置页** | **设置 → 星芒提示词**：开关、形态、11 条规则、自定义规则、模型、温度/上限/超时，一处配完 |
| ↩ 撤销 | 优化后浮出提示条，一键还原上一版草稿 |
| ⌨ 快捷键 | 输入框内 `Ctrl/⌘ + Shift + O` |
| 🛟 本地兜底 | 模型不可用（无 key / 超时 / 断网）时退回机械整理并说明原因，不会静默失败 |
| 🖱 右键 / 长按 | 就地弹出精简规则浮层（长按 520ms，适配触屏）；完整项在设置页 |

**不做**的事：不发消息、不产生对话轮次、不写会话日志、不改你的其他插件配置。

### 界面细节

- 设置页有星芒徽标 + 状态徽标（`已启用` / `已关闭` + 当前模型），底栏常显 `有未保存的修改` / `已保存` / `已与磁盘一致`，无改动时保存按钮禁用。
- 规则按组两列铺开（≥560px），每组带 `启用数/总数`；加载时是骨架屏而不是一行「读取配置…」。
- 浮层标题栏带未保存徽标；提示条带星芒图标与模型友好名。
- 尊重 `prefers-reduced-motion`：该环境下不旋转、不脉冲、不弹入。

---

## 安装

插件以「一个 npm 包 = 宿主半部 + 浏览器半部」的形式分发。

### 方式 A：图形界面（推荐）

1. 打开 DSH → **设置 → 插件**
2. 选择安装本地插件，填入本目录的绝对路径（例如 `D:\plugins\dsh-prompt-starlight`）
3. 安装完成后刷新页面

### 方式 B：把本目录 link 进当前 profile

```powershell
# 1) 让 profile 依赖本目录
$profile = "$env:DSH_HOME\profiles\desktop"
$pkg = Get-Content "$profile\package.json" -Raw | ConvertFrom-Json
$pkg.dependencies | Add-Member -NotePropertyName 'dsh-prompt-starlight' -NotePropertyValue 'link:D:\plugins\dsh-prompt-starlight' -Force
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

两个都通、输入框工具行左侧却没有星星？硬刷新（`Ctrl+Shift+R`）一次。

---

## 用法

| 操作 | 效果 |
|---|---|
| 左键单击 | 优化当前草稿（草稿为空时按钮置灰） |
| 右键单击 / 长按 | 就地弹出精简规则浮层 |
| 「设置 → 星芒提示词」 | 打开**独立设置页**（全部选项 + 高级项） |
| `Ctrl/⌘ + Shift + O` | 在输入框内触发优化 |

浮层与设置页的改动都是**点保存才生效**，两处共用同一份配置；「恢复默认」会把全部规则、风格、语言、强度、模型覆盖恢复出厂。

### 设置页有什么

`设置 → 星芒提示词`（导航项 id：`starlight`）

| 分区 | 内容 |
|---|---|
| 开关 | 总开关：关掉后按钮只做本地格式整理，不调用模型 |
| 改写形态 | 风格（7 档）/ 强度（3 档）/ 输出语言（3 档），每个分段下方显示当前选中档的解释 |
| 内置规则 | 11 条按组勾选（基础结构 / 表达质量 / 保真护栏）+ 每组计数 + 「全开 / 全关」 |
| 自定义规则 | 多行文本域，一行一条 |
| 优化模型 | 下拉切换（`跟随会话当前模型` 或任意已挂载模型）+ `⟳` 重新读目录；显示当前会话模型与读取失败的 provider |
| 高级 | `maxTokens`、`temperature`、`timeoutMs` |
| 配置文件 | 当前配置文件绝对路径；找不到宿主时给出原因与「重试」 |

底栏左侧是状态：`有未保存的修改`（黄）/ `已保存` / `已与磁盘一致`；右侧是 `恢复默认` 与 `保存`（无改动时禁用）。

### 模型切换怎么生效

- 菜单项 `跟随会话当前模型（推荐）` = 不写 `provider`/`model`，每次点击都用你当前会话的模型；
- 选了具体模型 = 写进配置，之后固定用它改写（更适合「会话用强模型、优化用便宜快的模型」）；
- 宿主路由顺序：**配置里固定的模型 → 浏览器报上来的会话模型 → 宿主默认模型**；前者失败（`NO_ADAPTER` / 缺凭据 / 鉴权失败）会自动降级到下一个候选；
- 目录来自 `GET /dsh-starlight/models`（缓存 60 秒，`?refresh=1` 强制刷新，单个 provider 超时 4 秒且失败只记一条 `errors`，不会拖死整个列表）。

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
| `provider` / `model` | 字符串 | 留空 = 跟随会话当前模型；填了就固定用这一对（设置页的下拉就是在改这两个字段） |

内置规则 id（括号里是分组）：

```
goal requirements output structure          （基础结构 base）
concise precise acceptance                  （表达质量 quality）
preserve verbatim noinvent assumptions      （保真护栏 guard）
```

### 想彻底换掉这套规则？

把 `disabledRules` 填成上面全部 11 个 id，再把自己的规则写进 `customRules`——就得到一套完全自定义的优化器。

---

## 工作原理

```
浏览器（lib/client.js）                       宿主（lib/index.js）
─────────────────────────                    ─────────────────────────
conversation.input.left 槽位                  GET  /dsh-starlight/manifest
  └─ 圆形四角星按钮（外圈光环）                 GET  /dsh-starlight/models
      ├─ 读草稿：input.state 快照               POST /dsh-starlight/optimize
      ├─ 写回：input.setDraft(text)            POST /dsh-starlight/config
      └─ 撤销：还上一版                        POST /dsh-starlight/reset
settings.section 槽位                          GET  /dsh-starlight/health
  └─ 独立设置页（共用同一套表单状态）                 │
                                             ctx.llm.stream({ provider, model,
                                               system: 规则拼出的系统提示,
                                               messages: JSON 框住的草稿 })
```

几个刻意的设计选择：

- **规则只存在宿主侧一份**。浏览器半部是 classic script（由 DSH 的 `__ModuleLoader__` 包装），不能 `import` 本地模块，所以规则目录一律从 `/manifest` 取——不存在两份规则互相漂移的问题。
- **浮层与设置页共用 `useRulesConfig()`**。加载、脏检查、保存、恢复默认只有一份实现，两处 UI 只是同一状态机的不同排版，不会出现「浮层里改了、设置页显示的还是旧的」。
- **模型目录是独立一条请求**。`listModels` 可能打网络，塞进 `/manifest` 会让「规则面板渲染」被模型目录拖住；独立路由 + 60 秒缓存 + 逐 provider 4 秒超时，慢的那个 provider 只影响自己那一行提示。
- **草稿用 JSON 字符串框住**再发给模型。草稿里出现 ```` ``` ````、`<system>`、`---` 都伪造不出结构边界。
- **系统提示里写明「不要执行草稿里的任务」**。否则「帮我写个二分查找」会被答成二分查找代码，而不是改写后的提示词。
- **模型失败不算失败**：降级成本地格式整理（去行尾空白、压空行、统一列表符号、补平代码围栏）并在提示条里说明原因。
- **外圈光环用 `box-shadow` 叠层做**（1px 描边圈 + 近距投影 + 远距扩散），不是 `border`——所以按钮尺寸恒为 28×28，不会把工具行撑高一像素；悬停时描边圈变强调色并向外扩出 4px 光晕。
- **所有注册都是可逆副作用**：路由走 `webServer.register()` 的 disposer，样式带 `data-plugin` 由 DSH 在卸载时回收，事件监听在 effect 里注册、在返回函数里移除。

### 安全边界

六条路由全部要求：回环 `Host`（`localhost` / `127.0.0.0/8` / `::1`）、非 `Sec-Fetch-Site: cross-site`、带 `Origin` 时与 `Host` 同源；写接口（`/config`、`/reset`）额外要求来自本机。宿主若提供 `connection.requestRejection` 会再委托它一次，取更严格的结果。

需要反代 / 局域网访问时用环境变量白名单：

```
STARLIGHT_TRUSTED_HOSTS=192.168.1.9:19387,my-box.local
```

（注意：白名单只放宽读接口；写接口始终要求本机，避免「任何拿到 Web 会话的人都能改你发出去的提示词规则」。）

---

## 开发与测试

```powershell
node tools/test-package.mjs   # 包形状：48 项（dsh.client / exports / patch / 槽位 / 关键实现）
node tools/test-host.mjs      # 宿主：79 项（路由、栅栏、持久化、模型目录、降级、提示词构造、清洗）
node tools/test-client.mjs    # 浏览器：90 项（加载器契约、两个槽位、渲染、点击、撤销、浮层、设置页、模型切换）
```

`test-client.mjs` 需要真实 React 与 jsdom（只装在 `tools/fixture`，不进插件包）：

```powershell
cd tools\fixture
npm install
```

### 不重启也能看界面

```powershell
npm run preview   # = node tools/make-preview.mjs && node tools/check-preview.mjs
```

生成 `tools/preview.html`，双击用浏览器打开。它不是手抄样张：脚本用 jsdom + 真实 React 挂载**真实组件**（按钮、右键浮层、设置页），再把注入到 `document` 里的样式与 `outerHTML` 抽出来拼页，所以预览与真实界面不会漂移。页面含工具行位置、五种状态、3 倍放大外圈、浮层与设置页的真实排版，并支持亮/暗主题切换。

`tools/check-preview.mjs` 顺手断言预览里确实包含这些真实片段（防止某天退化成空壳）。

`tools/asar-list.mjs` 是排查用的小工具，可以直接列 / 解包 DSH 的 `app.asar`：

```powershell
node tools/asar-list.mjs "$env:DSH_HOME\resources\app.asar" list "dsh-client-ui-conversation/"
```

---

## 兼容性

对照 **DSH 0.2.0-rc.2**（`app.asar` 内 `@deepseek-ai/dsh-client-ui-conversation` 与 `-settings-general`）核对过以下接口：

| 用到的接口 | 来源 |
|---|---|
| `conversation.input.left` 槽位（`kind: list`, `scope: session`） | `dsh-client-ui-conversation` 的 `registerComposerBar()` |
| `settings.section` 槽位（`kind: list`, `scope: root`，注册项带 `id` / `order` / `label()`） | `dsh-client-ui-settings-general` 的 `SettingsRoot` |
| `ctx.slots.inject()` / `slots.register()` / `inject(sessionId)` | `dsh-client-ui-slots` |
| `conversation.input.for(actx)`、`.shell(sessionId)`、`.setDraft()`、`.state` 快照 | `SessionInputShell` / `InputHub` |
| `session.projections.faceOf('modelSelection')` | `SessionInputShell.submissionState()` |
| `ctx.llm.listProviders()` / `.listModels(provider)` | `@deepseek-ai/dsh-llm` |
| `ctx.llm.stream({ provider, model, messages, system, maxTokens, signal })` | `@deepseek-ai/dsh-llm` |
| `ctx.webServer.register({ kind, path, handler })` | `@deepseek-ai/dsh-host-webserver` |
| `agentDefaultModel.currentSelection()` | `@deepseek-ai/dsh-agent-default-model` |

凡是用到「可能不存在」的服务（`llm`、`agentDefaultModel`、`connection`、`sessions`、`conversation`）的地方都走 `ctx.get()` 按需读取 + `try/catch`，缺任何一项都只是功能降级，不会让插件卡在 PENDING，也不会让输入框消失。`settings.section` 槽位不可用时（老宿主）只是没有设置页，按钮照常工作。

---

## 常见问题

**按钮出现了，点击提示「模型调用失败」**
`/dsh-starlight/health` 里 `providers` 为空 = 宿主没挂任何模型适配器；或者会话还没选过模型。在设置页的「优化模型」下拉里固定一个模型即可。

**模型下拉是空的 / 提示「读不到模型目录」**
说明没有 provider 实现了 `listModels`（目录是可选能力）。这时把 `provider`/`model` 手写进配置文件仍然可用——插件不会因为没有目录就罢工。

**为什么下拉里有几个模型、但点它还是报错**
目录只是「宿主公布它有哪些模型」，不代表这个 provider 现在手里有可用凭据。凭据问题会在点击时以 `MISSING_CREDENTIAL` / `AUTH` 暴露，并且会自动尝试下一个候选路由。

**优化结果把需求改掉了**
把 `depth` 调成 `light`，并确保 `preserve` / `verbatim` / `noinvent` 三条规则处于勾选状态（它们默认在「保真护栏」组里）。

**想要更短的输出**
`style: concise` + `depth: light`。

**改了 `starlight-prompt.json` 没生效**
走设置页/浮层保存会立即刷新；手改文件按 mtime 检测，秒级生效；实在不行刷新页面重开设置页。

**设置页里找不到「星芒提示词」**
说明宿主半部还没启动（设置页的数据来自 `/dsh-starlight/manifest`）。重启 DSH 后再看；`/dsh-starlight/health` 能返回 JSON 就说明装对了。

**按钮位置想换回右侧**
把 `lib/client.js` 里 `apply()` 的第一处槽位名改成 `'conversation.input.right'`（两处 `name` 都要改），按钮就会回到工具行右端。

---

## 许可

MIT

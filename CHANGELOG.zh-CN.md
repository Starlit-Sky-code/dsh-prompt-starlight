# 更新记录

本项目的所有重要变更都记在这里。格式参照 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

英文版见 [CHANGELOG.md](CHANGELOG.md)。

## [未发布]

## [0.4.1] - 2026-10-25

### 新增

- **插件卡片图标**：`package.json` 声明 `icon`，宿主读文件后内联成 data URL 交给 UI。此前卡片显示的是 DSH 内置占位图标。
- **本地化展示文案**：`locale/en.json` 与 `locale/zh.json` 提供卡片的 `title` / `description`；`exports` 放行 `./locale/*`（不放行会被宿主静默跳过）。
- **`tools/check-plugin-meta.mjs`**：复刻宿主 `readPluginMeta()` 的规则，重启 DSH 之前就能验证卡片会显示什么。
- **format-1 插件市场索引** `market/index.json`：DSH 没有官方市场，「市场」就是一份 https 上的 JSON 索引，用户加进 Plugins → Discover 即可安装。
- **GitHub Release 预打包 tarball**：安装时免 pnpm 构建授权。
- **GitHub Actions**：`ci.yml`（push/PR 全量检查）、`release.yml`（推 `v*` tag 自动发版）。

### 变更

- **全部对外文案重写**：不再宣称已经删掉的「7 档风格」，改为描述实际存在的强度/详细度滑块与 11 条规则。
- **发布目标钉死在 `registry.npmjs.org`**：防止某个全局 `.npmrc` 把 registry 指到 GitHub Packages 后出现「已登录却一直 ENEEDAUTH」。
- 收紧了 `files[]`，去掉只服务 GitHub 的三张大图。

### 修复

- `.gitignore` 补上根 `node_modules/`：此前一次 `git add -A` 误提交了 140 个文件。
- CI 里「没有把 node_modules 打进包」的断言改为检查 git 跟踪——原写法在 CI 中必然误报。

## [0.4.0] - 2026-10-25

### 变更（不兼容）

- **界面重做**：浮层与设置页同一套骨架，模型置顶，强度（5 档）与详细度（3 档）各一根滑块，其余折叠。浮层默认只露 4 个控件。
- **配置格式 v1 → v2**：`style` 拆成 `verbosity` + `lens` 两个可独立调的轴。旧配置由 `LEGACY_STYLE_MAP` 自动迁移，老文件不用改。

### 新增

- 插件图标进入 UI：新增宿主路由 `GET /dsh-starlight/icon.png` 下发 `assets/icon-ui.png`（浏览器半部读不到本地文件）。
- 高级区的 `maxTokens` / 温度 / 超时也换成滑块。
- `tools/make-shots.mjs`：把真实组件渲染成 README 截图（jsdom + React + headless Edge）。

### 移除

- `design/settings-variants.html`（三版设计稿已被实装取代）。

## [0.3.0] - 2026-10-24

### 新增

- 优化模型可切换：默认跟随会话模型，也可钉死某个更便宜的模型；显示会话当前模型与失败的服务商。
- 设置页三版设计稿（后被实装取代）。

## [0.2.0] - 2026-10-24

### 新增

- 按钮移到输入框工具行左侧，并加一圈描边光晕。
- 独立设置页（设置 → 星芒提示词）。

## [0.1.0] - 2026-10-24

### 新增

- 首个版本：输入框旁的圆形四角星按钮，一键把草稿改写成更清晰的提示词。
- 11 条内置规则（基础结构 / 表达质量 / 保真护栏）、自定义规则、语言与改写强度可选。
- 模型不可用时降级为本地格式整理，并说明原因。

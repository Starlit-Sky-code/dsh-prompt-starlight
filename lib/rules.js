/**
 * 星芒 · 提示词优化规则库（纯数据 + 纯函数，无 IO）。
 *
 * 这里是「可自定义优化规则」的唯一事实来源：
 *  - RULE_CATALOG  内置规则模块，用户可逐条开关；
 *  - STYLE_CATALOG 改写风格档位；
 *  - buildSystemPrompt() 把「启用的规则 + 风格 + 语言 + 强度 + 自定义规则」拼成系统提示；
 *  - tidyLocally()  没有可用模型时的本地兜底整理。
 *
 * 设计原则：
 *  1) 规则正文写给「优化模型」看，用简短祈使句，避免歧义；
 *  2) 用户可见的标题/说明是中英双语，随界面语言切换；
 *  3) 任何规则都不得诱导模型新增原文没有的事实——这条写在 NON_NEGOTIABLES 里且不可关闭。
 */

/** 目标语言档位。 */
export const LOCALE_CATALOG = [
  { id: 'auto', label: { zh: '跟随原文', en: 'Follow draft' }, note: { zh: '原文中文→中文，原文英文→英文', en: 'Chinese in, Chinese out; English in, English out' } },
  { id: 'zh', label: { zh: '中文', en: 'Chinese' }, note: { zh: '始终输出简体中文', en: 'Always output Simplified Chinese' } },
  { id: 'en', label: { zh: 'English', en: 'English' }, note: { zh: '始终输出英文', en: 'Always output English' } },
]

/** 改写强度：控制「改动幅度」，而不是长度。 */
export const DEPTH_CATALOG = [
  { id: 'light', label: { zh: '轻改', en: 'Light' }, note: { zh: '只修病句与结构，尽量保留原措辞', en: 'Fix wording and structure, keep phrasing' } },
  { id: 'balanced', label: { zh: '均衡', en: 'Balanced' }, note: { zh: '默认：重写得清晰完整，篇幅与原稿相当', en: 'Default: rewrite clearly, similar length' } },
  { id: 'strong', label: { zh: '重写', en: 'Strong' }, note: { zh: '按最佳实践完整重写，可明显变长', en: 'Full best-practice rewrite, may grow' } },
]

/** 风格档位。每条 directive 直接进系统提示。 */
export const STYLE_CATALOG = [
  {
    id: 'auto',
    label: { zh: '自动', en: 'Auto' },
    note: { zh: '由模型判断草稿适合的形态', en: 'Let the model pick the fitting shape' },
    directive: {
      zh: '自行判断这份草稿的最佳提示词形态：需要落地执行就写成任务规格，需要创作就写成创作简报，不要套用固定模板。',
      en: 'Decide the best prompt shape for this draft: a task spec for execution work, a creative brief for writing work. Do not force one template.',
    },
  },
  {
    id: 'concise',
    label: { zh: '精简', en: 'Concise' },
    note: { zh: '最短篇幅，去掉一切可推断内容', en: 'Shortest form, drop anything inferable' },
    directive: {
      zh: '写成精简版：只保留对结果有影响的信息，整体长度不超过原稿的 1.5 倍；不写背景铺垫、不写客套。',
      en: 'Write a concise version: keep only information that changes the outcome, at most 1.5x the draft length. No padding, no pleasantries.',
    },
  },
  {
    id: 'standard',
    label: { zh: '标准', en: 'Standard' },
    note: { zh: '目标 / 要求 / 输出 / 约束', en: 'Goal / requirements / output / constraints' },
    directive: {
      zh: '写成标准任务规格：目标、具体要求、输出形式、边界与约束；每条要求可被检验。',
      en: 'Write a standard task spec: goal, concrete requirements, output shape, boundaries and constraints. Every requirement must be checkable.',
    },
  },
  {
    id: 'detailed',
    label: { zh: '详尽', en: 'Detailed' },
    note: { zh: '补充边界条件、异常分支与验证方式', en: 'Add edge cases, failure branches, verification' },
    directive: {
      zh: '写成详尽规格：在标准结构上补充边界条件、异常与失败分支、以及可执行的验证方式；允许比原稿长。',
      en: 'Write a detailed spec: on top of the standard structure add edge cases, failure branches and a concrete way to verify the result. Growing beyond draft length is fine.',
    },
  },
  {
    id: 'engineering',
    label: { zh: '工程', en: 'Engineering' },
    note: { zh: '面向代码/系统任务', en: 'For code and system tasks' },
    directive: {
      zh: '写成工程任务单：明确输入与产出物、技术与环境约束、接口与文件位置、验收标准；把「不要做什么」也写清楚，防止过度改动。',
      en: 'Write an engineering ticket: explicit inputs and deliverables, stack and environment constraints, interfaces and file locations, acceptance criteria. State non-goals to prevent scope creep.',
    },
  },
  {
    id: 'writing',
    label: { zh: '写作', en: 'Writing' },
    note: { zh: '面向文案/文章/创作', en: 'For copy and prose' },
    directive: {
      zh: '写成创作简报：读者与场景、语气与人称、篇幅与结构、必须出现与必须避免的内容、风格参照。保留原文题材与事实。',
      en: 'Write a creative brief: audience and situation, tone and person, length and structure, must-include and must-avoid, style references. Keep the draft subject and facts.',
    },
  },
  {
    id: 'analysis',
    label: { zh: '分析', en: 'Analysis' },
    note: { zh: '面向研究/评估/诊断', en: 'For research and diagnosis' },
    directive: {
      zh: '写成分析任务：待回答的问题、需要比对或核验的维度、证据来源要求、结论的呈现顺序；明确区分「已知事实」与「需要推断」。',
      en: 'Write an analysis task: the question to answer, dimensions to compare or verify, evidence requirements, and the order conclusions appear in. Separate known facts from inference.',
    },
  },
]

/**
 * 内置规则模块。
 * `group` 只用于界面分组：base=基础结构，quality=表达质量，guard=保真护栏。
 */
export const RULE_CATALOG = [
  {
    id: 'goal',
    group: 'base',
    title: { zh: '明确目标', en: 'State the goal' },
    note: { zh: '开头一句话说清要达成什么结果', en: 'One line up front on the outcome wanted' },
    body: {
      zh: '把「最终要得到什么结果」提到最前面，用一句话说清；把「怎么做」留到后面。不要以背景介绍开头。',
      en: 'Put the outcome wanted first, in one sentence; move the how-to later. Never open with background.',
    },
  },
  {
    id: 'requirements',
    group: 'base',
    title: { zh: '拆出具体要求', en: 'Extract requirements' },
    note: { zh: '把混在叙述里的要求逐条列出', en: 'List requirements hidden in prose' },
    body: {
      zh: '把散落在叙述中的要求拆成独立条目，一条一个要求，互不重复、互不包含；保持原文的取舍，不要合并出新的要求。',
      en: 'Split requirements buried in prose into separate items, one requirement each, no overlap or nesting. Keep the draft’s set of asks; do not merge into new ones.',
    },
  },
  {
    id: 'output',
    group: 'base',
    title: { zh: '规定输出形式', en: 'Specify the output' },
    note: { zh: '长度、结构、格式、语言', en: 'Length, structure, format, language' },
    body: {
      zh: '如果原文对产出物、格式、篇幅、语言有要求，集中写进「输出」一节；原文没说的不要凭空规定具体数值。',
      en: 'If the draft constrains the deliverable, format, length or language, gather those under an Output section. Do not invent specific numbers the draft never gives.',
    },
  },
  {
    id: 'structure',
    group: 'base',
    title: { zh: '结构化排版', en: 'Structure the layout' },
    note: { zh: '用标题/列表替代大段流水句', en: 'Headings and lists over prose walls' },
    body: {
      zh: '用短标题与列表组织内容；同一层级的条目格式一致；不要为了结构而把一句话拆成多个标题。',
      en: 'Organise with short headings and lists; keep sibling items in one format. Do not split a single sentence into multiple headings just to look structured.',
    },
  },
  {
    id: 'concise',
    group: 'quality',
    title: { zh: '去冗余', en: 'Cut redundancy' },
    note: { zh: '删口语、重复、自明内容', en: 'Drop filler, repeats, the obvious' },
    body: {
      zh: '删掉口语填充、自我重复、无需说明的自明内容；同一件事只说一次。',
      en: 'Remove verbal filler, self-repetition and statements the reader can infer. Say each thing once.',
    },
  },
  {
    id: 'precise',
    group: 'quality',
    title: { zh: '消除歧义', en: 'Remove ambiguity' },
    note: { zh: '把模糊词换成可判断的表述', en: 'Replace vague words with checkable ones' },
    body: {
      zh: '把「好一点」「优化一下」「合适」这类模糊表述换成可判断的标准；做不到时保留原词，但明确标注需确认。',
      en: 'Replace vague wording such as "better", "improve it", "appropriate" with checkable criteria. When you cannot, keep the original word but flag it as needing confirmation.',
    },
  },
  {
    id: 'preserve',
    group: 'guard',
    title: { zh: '保真：不改需求', en: 'Fidelity: keep the asks' },
    note: { zh: '不加需求、不删需求、不改结论', en: 'No added or dropped asks' },
    body: {
      zh: '不得新增原文没有的需求、不得删除原文已有的需求、不得替用户做技术选型或业务决策；原文的每一个诉求在改写后都必须能对应上。',
      en: 'Never add asks the draft lacks, never drop one it has, never make technical or product decisions for the user. Every ask in the draft must be traceable in the rewrite.',
    },
  },
  {
    id: 'verbatim',
    group: 'guard',
    title: { zh: '原样保留技术标识', en: 'Keep identifiers verbatim' },
    note: { zh: '路径/命令/代码/占位符/版本号', en: 'Paths, commands, code, placeholders, versions' },
    body: {
      zh: '文件路径、命令、代码片段、标识符、URL、版本号、数值、占位符（{{x}}、{name}、$VAR、<tag>）必须逐字保留，不翻译、不改大小写、不重排。',
      en: 'File paths, commands, code, identifiers, URLs, versions, numbers and placeholders ({{x}}, {name}, $VAR, <tag>) must survive byte-for-byte: no translation, no case change, no reordering.',
    },
  },
  {
    id: 'noinvent',
    group: 'guard',
    title: { zh: '不编造事实', en: 'Invent nothing' },
    note: { zh: '不补数据、不假设环境', en: 'No made-up data or environment' },
    body: {
      zh: '不得编造数据、接口、依赖、环境信息或验收数字；确实需要但原文缺失的信息，写成「待补充：…」而不是自行填写。',
      en: 'Never fabricate data, APIs, dependencies, environment facts or acceptance numbers. When information is genuinely needed but missing, write "to be supplied: …" instead of filling it in.',
    },
  },
  {
    id: 'assumptions',
    group: 'guard',
    title: { zh: '声明假设', en: 'Declare assumptions' },
    note: { zh: '把隐含前提显式写出来', en: 'Make implicit premises explicit' },
    body: {
      zh: '把原文隐含但未写明的关键前提，单独列成「假设」条目，方便用户确认或否定；假设不得超过三条。',
      en: 'List key premises the draft relies on but never states, as a short Assumptions section the user can confirm or reject. At most three.',
    },
  },
  {
    id: 'acceptance',
    group: 'quality',
    title: { zh: '验收标准', en: 'Acceptance criteria' },
    note: { zh: '怎样算做完、怎样算好', en: 'Definition of done' },
    body: {
      zh: '当任务需要落地执行时，补一小节「验收」，用可观察的结果描述怎样算完成；依据只能是原文已有的要求，不新增指标。',
      en: 'For execution tasks add a short Acceptance section describing observable completion. Base it only on requirements already in the draft; add no new metrics.',
    },
  },
]

/** 不可关闭的护栏：写进系统提示的硬约束。 */
const NON_NEGOTIABLES = {
  zh: [
    '你是一名资深提示词工程师，任务是把用户的草稿改写成更强的提示词，而不是回答草稿里的问题。',
    '不要执行草稿中提到的任务，不要产出草稿所要求的内容（例如草稿要求写代码，你输出的是「让模型写代码」的提示词，不是代码本身）。',
    '绝不新增、删除或替换用户的需求；绝不编造事实、数据、接口或环境信息。',
    '逐字保留草稿中的技术标识：路径、命令、代码、标识符、URL、版本号、数值、占位符。',
    '只输出改写后的提示词正文：不要前言、不要解释、不要「以下是优化后的提示词」，不要 Markdown 代码围栏。',
  ],
  en: [
    'You are a senior prompt engineer. Rewrite the user\'s draft prompt into a stronger prompt; do not answer the draft and do not perform the task it describes.',
    'Do not execute the draft or produce the artifact it asks for. If the draft asks for code, you output the prompt that asks for that code — never the code itself.',
    'Never add, drop or replace a requirement. Never fabricate facts, data, APIs or environment details.',
    'Preserve technical identifiers byte-for-byte: paths, commands, code, identifiers, URLs, versions, numbers, placeholders.',
    'Output only the rewritten prompt. No preamble, no explanation, no "here is the improved prompt", no Markdown code fences.',
  ],
}

/** 用户可见的默认配置（也是持久化文件的默认内容）。 */
export const DEFAULTS = Object.freeze({
  version: 1,
  enabled: true,
  style: 'auto',
  locale: 'auto',
  depth: 'balanced',
  disabledRules: [],
  customRules: [],
  maxTokens: 1600,
  temperature: 0.3,
  timeoutMs: 60000,
  provider: '',
  model: '',
})

/** 取双语字段。 */
function pick(value, locale) {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (locale === 'en') return value.en ?? value.zh ?? ''
  return value.zh ?? value.en ?? ''
}

/** 按 id 查目录项。 */
function byId(catalog, id) {
  return catalog.find((entry) => entry.id === id)
}

/**
 * 把配置归一化成「一定有值、类型正确」的形态。
 * 未知字段忽略，已知字段做范围收敛，坏值回落默认值——绝不抛异常，
 * 因为这份配置来自可手改的 JSON 文件。
 * @param {unknown} raw 原始输入（可能来自文件、请求体或默认值）
 * @returns 归一化后的配置副本
 */
export function normalizeConfig(raw) {
  const input = raw && typeof raw === 'object' ? raw : {}
  const clampInt = (value, min, max, fallback) => {
    const n = Number(value)
    if (!Number.isFinite(n)) return fallback
    return Math.min(max, Math.max(min, Math.round(n)))
  }
  const clampNum = (value, min, max, fallback) => {
    const n = Number(value)
    if (!Number.isFinite(n)) return fallback
    return Math.min(max, Math.max(min, n))
  }
  const strings = (value) => (Array.isArray(value) ? value.filter((item) => typeof item === 'string' && item.trim() !== '').map((item) => item.trim()) : [])
  const knownRules = new Set(RULE_CATALOG.map((rule) => rule.id))
  const locales = new Set(LOCALE_CATALOG.map((entry) => entry.id))
  const styles = new Set(STYLE_CATALOG.map((entry) => entry.id))
  const depths = new Set(DEPTH_CATALOG.map((entry) => entry.id))

  return {
    version: 1,
    enabled: input.enabled !== false,
    style: styles.has(input.style) ? input.style : DEFAULTS.style,
    locale: locales.has(input.locale) ? input.locale : DEFAULTS.locale,
    depth: depths.has(input.depth) ? input.depth : DEFAULTS.depth,
    disabledRules: [...new Set(strings(input.disabledRules).filter((id) => knownRules.has(id)))],
    customRules: strings(input.customRules).slice(0, 20),
    maxTokens: clampInt(input.maxTokens, 256, 8000, DEFAULTS.maxTokens),
    temperature: clampNum(input.temperature, 0, 1.5, DEFAULTS.temperature),
    timeoutMs: clampInt(input.timeoutMs, 5000, 300000, DEFAULTS.timeoutMs),
    provider: typeof input.provider === 'string' ? input.provider.trim() : '',
    model: typeof input.model === 'string' ? input.model.trim() : '',
  }
}

/** 当前生效的规则对象列表（按目录顺序，已排除被关闭的）。 */
export function activeRules(config) {
  const disabled = new Set(config.disabledRules)
  return RULE_CATALOG.filter((rule) => !disabled.has(rule.id))
}

/**
 * 组装系统提示。
 * @param {object} config 归一化后的配置
 * @param {{ style?: string, locale?: string, depth?: string, customRules?: string[] }} [overrides] 单次调用的临时覆盖
 * @returns {string} 系统提示文本
 */
export function buildSystemPrompt(config, overrides = {}) {
  const style = pick(byId(STYLE_CATALOG, overrides.style ?? config.style)?.directive, 'en')
  const depth = overrides.depth ?? config.depth
  const locale = overrides.locale ?? config.locale
  const rules = activeRules(config)
  const custom = Array.isArray(overrides.customRules) ? overrides.customRules : config.customRules

  const depthText = {
    light: 'Change as little as possible: fix wording, ordering and structure. Keep the draft\'s own phrasing and length wherever it is already clear.',
    balanced: 'Rewrite for clarity and completeness. The result should be roughly the same length as the draft — shorter when the draft is padded, longer only when structure demands it.',
    strong: 'Rewrite freely into the best possible prompt for this goal, even if the result is noticeably longer than the draft.',
  }[depth] ?? ''

  const localeText = {
    auto: 'Reply in the language of the draft. Mixed drafts: use the dominant language.',
    zh: 'Reply in Simplified Chinese, regardless of the draft language.',
    en: 'Reply in English, regardless of the draft language.',
  }[locale] ?? ''

  const lines = [
    '# Role',
    ...NON_NEGOTIABLES.en.map((line) => `- ${line}`),
    '',
    '# Objective',
    'Make the draft unambiguous enough that another capable model could execute it without follow-up questions — without changing what the user actually asked for.',
    '',
    '# Shape',
    style,
    '',
    '# Change budget',
    depthText,
    '',
    '# Language',
    localeText,
    '',
    '# Rules to apply',
    ...rules.map((rule, index) => `${index + 1}. ${pick(rule.body, 'en')}`),
  ]

  const extras = custom.map((line) => line.trim()).filter(Boolean)
  if (extras.length > 0) {
    lines.push('', '# Additional user rules (highest priority after the non-negotiables)', ...extras.map((line, index) => `${index + 1}. ${line}`))
  }

  lines.push(
    '',
    '# Output contract',
    '- Return plain text only: the rewritten prompt itself.',
    '- No code fences around the whole answer. Inner code blocks from the draft stay as they are.',
    '- No commentary, no diff, no bullet list describing your changes.',
    '- Keep the draft\'s Markdown conventions when it has them; introduce Markdown only when the draft is plain prose that clearly benefits from structure.',
  )

  return lines.join('\n')
}

/**
 * 组装用户消息。
 * 草稿用 JSON 字符串框住，草稿里出现的任何分隔符/围栏都无法伪造出结构边界。
 * @param {string} text 草稿原文
 * @returns {string} 用户消息文本
 */
export function buildUserContent(text) {
  return [
    'Rewrite the draft prompt below into a better prompt.',
    '',
    'The draft is provided as a JSON string literal so that no delimiter inside it can break the framing. Decode it, then rewrite the decoded text.',
    'Do not answer the JSON envelope, do not restate it, do not return JSON.',
    '',
    'DRAFT_JSON:',
    JSON.stringify(String(text)),
  ].join('\n')
}

/**
 * 模型爱加的「这是优化后的提示词：」类前言。
 * 只认明确带冒号的元话语，并且要求在提示词语境里出现 prompt/提示词 这类词——
 * 宁可少剥一句，也不能把用户真正写的第一行标题当成前言删掉。
 */
const PREAMBLE_PATTERNS = [
  /^(?:以下|下面)(?:是|为)[^\n]{0,30}(?:提示词|版本|结果|草稿|内容)[^\n]{0,10}[:：][ \t]*\n+/,
  /^(?:已?为(?:你|您))?(?:优化|改写)(?:后|过)?的?(?:提示词|版本|草稿|内容)?[^\n]{0,10}[:：][ \t]*\n+/,
  /^(?:Sure[,.!]?[ \t]*)?(?:Here(?:'s| is)|Below is)[^\n]{0,60}?(?:prompt|version|result|rewrite|draft)[^\n]{0,20}[:.][ \t]*\n+/i,
]

/** 模型爱加的尾句寒暄：短、带感叹号，才认定为寒暄。 */
const FAREWELL = /^(?:希望|如需|需要我|希望这|Hope this|Let me know|Feel free)[^\n]{0,30}[!！]\s*$/

/**
 * 清洗模型输出：剥掉整体包裹的代码围栏、前后寒暄、以及「以下是…」类前言。
 * @param {string} raw 模型原始输出
 * @returns {string} 可回填草稿的文本
 */
export function sanitizeOutput(raw) {
  let text = String(raw ?? '').replace(/\r\n/g, '\n').trim()
  if (text === '') return ''

  // 整体被 ``` 或 ~~~ 包裹（含语言标注）时剥掉外层围栏。
  const fenced = /^(?:```|~~~)[^\n]*\n([\s\S]*?)\n?(?:```|~~~)\s*$/.exec(text)
  if (fenced) text = fenced[1].trim()

  // 剥掉元话语前言（仅当后面还有正文）。
  for (const pattern of PREAMBLE_PATTERNS) {
    const stripped = text.replace(pattern, '')
    if (stripped !== text && stripped.trim() !== '') {
      text = stripped.trim()
      break
    }
  }

  // 尾部单行寒暄。
  const lines = text.split('\n')
  if (lines.length > 1 && FAREWELL.test(lines[lines.length - 1].trim())) {
    lines.pop()
    text = lines.join('\n').trim()
  }

  return text
}

/**
 * 本地兜底整理：没有可用模型时，只做可解释的机械整理，绝不臆造内容。
 * 处理项：行尾空白、连续空行、列表符号统一、全角空格、围栏配平。
 * @param {string} text 草稿原文
 * @returns {string} 整理后的文本
 */
export function tidyLocally(text) {
  let out = String(text ?? '').replace(/\r\n/g, '\n')
  out = out.replace(/[\u00a0\u3000]/g, ' ')
  out = out
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/, ''))
    .join('\n')
  out = out.replace(/\n{3,}/g, '\n\n')
  // 统一无序列表符号为 "- "（只处理行首的 * / • / ·）
  out = out.replace(/^[ \t]*[•·][ \t]+/gm, (match) => match.replace(/[•·]/, '-'))
  out = out.trim()
  // 围栏数量为奇数时补一个收尾围栏，避免粘贴后整段被当成代码。
  const fences = (out.match(/^```/gm) ?? []).length
  if (fences % 2 === 1) out += '\n```'
  return out
}

/**
 * 估算单次调用的输出上限：随草稿长度缩放，但始终落在配置上下限之内。
 * @param {string} text 草稿
 * @param {number} configured 用户配置的 maxTokens
 * @returns {number} 实际 maxTokens
 */
export function scaleMaxTokens(text, configured) {
  const length = String(text ?? '').length
  const wanted = 512 + Math.ceil(length * 1.6)
  return Math.min(Math.max(512, wanted), Math.max(512, configured))
}

/** 供浏览器端渲染的目录投影（去掉仅宿主使用的字段）。 */
export function catalogForClient(config) {
  return {
    rules: RULE_CATALOG.map((rule) => ({
      id: rule.id,
      group: rule.group,
      title: rule.title,
      note: rule.note,
    })),
    styles: STYLE_CATALOG.map((entry) => ({ id: entry.id, label: entry.label, note: entry.note })),
    locales: LOCALE_CATALOG.map((entry) => ({ id: entry.id, label: entry.label, note: entry.note })),
    depths: DEPTH_CATALOG.map((entry) => ({ id: entry.id, label: entry.label, note: entry.note })),
    defaults: DEFAULTS,
    config,
  }
}

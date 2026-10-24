# Starlight · one-click prompt optimizer (`dsh-prompt-starlight`)

A **circular four-pointed-star** button in the bottom-right corner of the DSH composer. One click turns your draft into a clearer, more complete, more executable prompt. Every optimization rule, style, language and change-budget is **editable** — toggle the built-in rules, or append your own.

> A standalone plugin. No DSH source edits, no `index.html` injection, one official slot seat.

```
┌───────────────────────────────────────────────┐
│  Draft text…                                  │
│                                               │
│  [＋] [model]                     [✦]  ← star │
└───────────────────────────────────────────────┘
```

---

## Features

| | |
|---|---|
| ✦ One click | Read the draft → rewrite with the rule set → atomic write-back, caret returned to the editor |
| ✦ Editable rules | 11 built-in rules (goal / requirements / output / structure / concision / disambiguation / fidelity / verbatim identifiers / no invention / assumptions / acceptance), each toggleable |
| ✦ Custom rules | One per line in the panel; they outrank the built-in rules |
| ✦ 7 styles | Auto / concise / standard / detailed / engineering / writing / analysis |
| ✦ 3 change budgets | Light / balanced / strong — controls *how much changes*, not how long the result is |
| ✦ Output language | Follow the draft / force Chinese / force English |
| ↩ Undo | A toast after each run restores the previous draft in one click |
| ⌨ Shortcut | `Ctrl/⌘ + Shift + O` inside the composer |
| 🛟 Local fallback | No model, timeout or offline → mechanical tidy-up plus a stated reason, never a silent failure |
| 🖱 Right-click / long-press | Opens the rules panel (520 ms long-press for touch) |

**It never** sends messages, creates turns, writes to the session log, or touches other plugins' settings.

---

## Install

One npm package = one host half + one browser half.

### A. GUI (recommended)

1. DSH → **Settings → Plugins**
2. Install a local plugin, pointing at this directory (e.g. `D:\Program\TypeScript\dsh-prompt-starlight`)
3. Refresh the page

### B. Link it into the current profile

```powershell
$profile = "$env:DSH_HOME\profiles\desktop"
$pkg = Get-Content "$profile\package.json" -Raw | ConvertFrom-Json
$pkg.dependencies | Add-Member -NotePropertyName 'dsh-prompt-starlight' -NotePropertyValue 'link:D:\Program\TypeScript\dsh-prompt-starlight' -Force
$pkg.dsh.profile.bundles += 'dsh-prompt-starlight'
$pkg | ConvertTo-Json -Depth 20 | Set-Content "$profile\package.json" -Encoding utf8

& "$env:DSH_HOME\resources\runtime\pnpm\bin\pnpm.cmd" install --dir $profile
```

Then **restart DSH** — the host half has to reload before the HTTP routes exist.

> The desktop profile is named `desktop`, and the CLI's `dsh plugin --profile` refuses it. Use the GUI or the manual link above; don't copy `--profile web` instructions from web-edition tutorials.

### Verify

```
http://127.0.0.1:19387/dsh-starlight/health
http://127.0.0.1:19387/plugins/dsh-prompt-starlight/client.js
```

JSON with `providers` = host half alive. JavaScript = the browser half made it into the boot graph. Both fine but no star? Hard-refresh (`Ctrl+Shift+R`).

---

## Usage

| Action | Effect |
|---|---|
| Left click | Optimize the current draft (greyed out when empty) |
| Right click / long-press | Open the rules panel |
| `Ctrl/⌘ + Shift + O` | Optimize while the editor is focused |

Panel edits apply on **Save**. **Defaults** restores every rule, style, language and budget.

---

## Custom rules

Config file: `$DSH_HOME/starlight-prompt.json` (created on first save; safe to hand-edit, picked up immediately)

```json
{
  "version": 1,
  "enabled": true,
  "style": "auto",
  "locale": "auto",
  "depth": "balanced",
  "disabledRules": ["assumptions"],
  "customRules": ["Always include an Acceptance section", "No 'please make sure' filler"],
  "maxTokens": 1600,
  "temperature": 0.3,
  "timeoutMs": 60000,
  "provider": "",
  "model": ""
}
```

Built-in rule ids:

```
goal requirements output structure concise precise
preserve verbatim noinvent assumptions acceptance
```

To replace the whole rule set, put all 11 ids in `disabledRules` and write your own rules into `customRules`.

---

## How it works

```
browser (lib/client.js)                     host (lib/index.js)
─────────────────────────                  ─────────────────────────
conversation.input.right slot              GET  /dsh-starlight/manifest
  └─ circular star button                  POST /dsh-starlight/optimize
      ├─ read:  input.state snapshot        POST /dsh-starlight/config
      ├─ write: input.setDraft(text)        POST /dsh-starlight/reset
      └─ undo:  previous draft              GET  /dsh-starlight/health
                                                    │
                                             ctx.llm.stream({ provider, model,
                                               system: built from the rules,
                                               messages: JSON-framed draft })
```

Deliberate choices:

- **Rules live host-side, once.** The browser half is a classic script wrapped by DSH's `__ModuleLoader__`, so it cannot `import` local modules; the catalog always comes from `/manifest`. No two drifting copies.
- **The draft is JSON-framed** before it reaches the model, so ```` ``` ````, `<system>` or `---` inside it cannot forge a structural boundary.
- **The system prompt forbids executing the draft.** Otherwise "write me a binary search" gets answered with code instead of an improved prompt.
- **A failed model call is not a failed click**: it degrades to a mechanical tidy-up and says why.
- **Every registration is a reversible side effect**: routes via the `webServer.register()` disposer, styles tagged `data-plugin` for DSH to reclaim, listeners added in `ctx.effect()` and removed in its return value.

### Security boundary

All five routes require a loopback `Host` (`localhost` / `127.0.0.0/8` / `::1`), reject `Sec-Fetch-Site: cross-site`, and require `Origin` to match `Host` when present. Write routes (`/config`, `/reset`) additionally require the request to come from this machine. If the host exposes `connection.requestRejection`, it is consulted too and the stricter result wins.

Behind a reverse proxy or on a LAN, whitelist explicitly:

```
STARLIGHT_TRUSTED_HOSTS=192.168.1.9:19387,my-box.local
```

(The whitelist only relaxes read routes; writes always require the local machine, so possessing a web session never grants permission to rewrite your prompt rules.)

---

## Development

```powershell
node tools/test-package.mjs   # package shape: dsh.client / exports / patch / files
node tools/test-host.mjs      # host: 60 assertions
node tools/test-client.mjs    # browser: 45 assertions
```

`test-client.mjs` needs real React and jsdom, installed only under `tools/fixture`:

```powershell
cd tools\fixture
npm install
```

`tools/asar-list.mjs` lists or unpacks DSH's `app.asar` for debugging.

---

## Compatibility

Verified against **DSH 0.2.0-rc.2** (`@deepseek-ai/dsh-client-ui-conversation` inside `app.asar`):

| Interface used | Source |
|---|---|
| `conversation.input.right` slot (`kind: list`, `scope: session`) | `registerComposerBar()` |
| `ctx.slots.inject()` / `slots.register()` / `inject(sessionId)` | `dsh-client-ui-slots` |
| `conversation.input.for(actx)`, `.setDraft()`, `.state` snapshot | `SessionInputShell` / `InputHub` |
| `session.projections.faceOf('modelSelection')` | `SessionInputShell.submissionState()` |
| `ctx.llm.stream({ provider, model, messages, system, maxTokens, signal })` | `@deepseek-ai/dsh-llm` |
| `ctx.webServer.register({ kind, path, handler })` | `@deepseek-ai/dsh-host-webserver` |
| `agentDefaultModel.currentSelection()` | `@deepseek-ai/dsh-agent-default-model` |

Every possibly-absent service (`llm`, `agentDefaultModel`, `connection`, `sessions`, `conversation`) is read lazily through `ctx.get()` inside `try/catch`: a missing one only degrades a feature — it never parks the plugin in PENDING and never makes the composer disappear.

---

## License

MIT

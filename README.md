# Starlight · one-click prompt optimizer (`dsh-prompt-starlight`)

A **circular four-pointed-star** button on the **left** of the DSH composer toolbar, wearing a hairline ring and soft glow so it lifts off the toolbar. One click turns your draft into a clearer, more complete, more executable prompt. Every rule, style, language and change budget is **editable**, and there is a **dedicated settings page** (Settings → Starlight).

> A standalone plugin. No DSH source edits, no `index.html` injection, two official slot seats.

```
┌───────────────────────────────────────────────┐
│  Draft text…                                  │
│                                               │
│  (✦) [＋] [permissions]       [model] [send]  │
│   └ star button (left, ringed)                │
└───────────────────────────────────────────────┘
```

---

## Features

| | |
|---|---|
| ✦ One click | Read the draft → rewrite with the rule set → atomic write-back, caret returned to the editor |
| ✦ Editable rules | 11 built-in rules (goal / requirements / output / structure / concision / disambiguation / fidelity / verbatim identifiers / no invention / assumptions / acceptance), each toggleable, with all-on / all-off |
| ✦ Custom rules | One per line; they outrank the built-in rules |
| ✦ 7 styles | Auto / concise / standard / detailed / engineering / writing / analysis |
| ✦ 3 change budgets | Light / balanced / strong — controls *how much changes*, not how long the result is |
| ✦ Output language | Follow the draft / force Chinese / force English |
| ⚙ **Settings page** | **Settings → Starlight**: switch, style, budget, language, all 11 rules, custom rules, and advanced provider / temperature / timeout — in one place |
| ↩ Undo | A toast after each run restores the previous draft in one click |
| ⌨ Shortcut | `Ctrl/⌘ + Shift + O` inside the composer |
| 🛟 Local fallback | No model, timeout or offline → mechanical tidy-up plus a stated reason, never a silent failure |
| 🖱 Right-click / long-press | Opens the compact rules popover (520 ms for touch); the settings page has everything else |

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
| Right click / long-press | Open the compact rules popover |
| **Settings → Starlight** | Open the dedicated settings page (everything, plus advanced fields) |
| `Ctrl/⌘ + Shift + O` | Optimize while the editor is focused |

Popover and settings-page edits both apply on **Save** and share one config document. **Restore defaults** resets every rule, style, language, budget and model override.

### What the settings page holds

Navigation id: `starlight`.

| Section | Contents |
|---|---|
| Switch | Master switch; off ⇒ the button only tidies formatting and never calls a model |
| Rewrite shape | Style (7) / change budget (3) / output language (3) |
| Built-in rules | 11 checkboxes, all-on / all-off, live "enabled / total" badge |
| Custom rules | Multi-line textarea, one rule per line |
| Advanced | `provider` / `model` override, `maxTokens`, `temperature`, `timeoutMs` |
| Config file | Absolute path of the config document; a clear reason plus **Retry** when the host is unreachable |

The footer shows `Unsaved changes` (amber) / `Saved` / `In sync with disk`, with **Restore defaults** and **Save** (disabled while clean).

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
browser (lib/client.js)                      host (lib/index.js)
─────────────────────────                  ─────────────────────────
conversation.input.left slot                GET  /dsh-starlight/manifest
  └─ circular star button (ringed)          POST /dsh-starlight/optimize
      ├─ read:  input.state snapshot         POST /dsh-starlight/config
      ├─ write: input.setDraft(text)         POST /dsh-starlight/reset
      └─ undo:  previous draft               GET  /dsh-starlight/health
settings.section slot                              │
  └─ settings page (same form state)        ctx.llm.stream({ provider, model,
                                               system: built from the rules,
                                               messages: JSON-framed draft })
```

Deliberate choices:

- **Rules live host-side, once.** The browser half is a classic script wrapped by DSH's `__ModuleLoader__`, so it cannot `import` local modules; the catalog always comes from `/manifest`. No two drifting copies.
- **The popover and the settings page share `useRulesConfig()`.** Loading, dirty-checking, saving and restoring have one implementation; the two surfaces are just different layouts over the same state machine, so they can never disagree.
- **The draft is JSON-framed** before it reaches the model, so ```` ``` ````, `<system>` or `---` inside it cannot forge a structural boundary.
- **The system prompt forbids executing the draft.** Otherwise "write me a binary search" gets answered with code instead of an improved prompt.
- **A failed model call is not a failed click**: it degrades to a mechanical tidy-up and says why.
- **The ring is `box-shadow` layers** (1 px outline + near shadow + far bloom), not `border`, so the button stays exactly 28×28 and never nudges the toolbar height; hover swaps the outline to the accent colour and blooms a 4 px halo.
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
node tools/test-package.mjs   # package shape: dsh.client / exports / patch / slots / files
node tools/test-host.mjs      # host: 64 assertions
node tools/test-client.mjs    # browser: 79 assertions
```

`test-client.mjs` needs real React and jsdom, installed only under `tools/fixture`:

```powershell
cd tools\fixture
npm install
```

### See the styles without restarting

```powershell
node tools/make-preview.mjs   # writes tools/preview.html — just open it
```

The preview's button CSS is extracted verbatim from `lib/client.js` (not a hand-copied duplicate). It shows the toolbar position, idle / disabled / busy / error / done states, a 3× zoom of the ring, and light/dark themes. Re-run after touching the styles.

`tools/asar-list.mjs` lists or unpacks DSH's `app.asar` for debugging.

---

## Compatibility

Verified against **DSH 0.2.0-rc.2** (`@deepseek-ai/dsh-client-ui-conversation` and `-settings-general` inside `app.asar`):

| Interface used | Source |
|---|---|
| `conversation.input.left` slot (`kind: list`, `scope: session`) | `registerComposerBar()` |
| `settings.section` slot (`kind: list`, `scope: root`; entries carry `id` / `order` / `label()`) | `SettingsRoot` in `dsh-client-ui-settings-general` |
| `ctx.slots.inject()` / `slots.register()` / `inject(sessionId)` | `dsh-client-ui-slots` |
| `conversation.input.for(actx)`, `.shell(sessionId)`, `.setDraft()`, `.state` snapshot | `SessionInputShell` / `InputHub` |
| `session.projections.faceOf('modelSelection')` | `SessionInputShell.submissionState()` |
| `ctx.llm.stream({ provider, model, messages, system, maxTokens, signal })` | `@deepseek-ai/dsh-llm` |
| `ctx.webServer.register({ kind, path, handler })` | `@deepseek-ai/dsh-host-webserver` |
| `agentDefaultModel.currentSelection()` | `@deepseek-ai/dsh-agent-default-model` |

Every possibly-absent service (`llm`, `agentDefaultModel`, `connection`, `sessions`, `conversation`) is read lazily through `ctx.get()` inside `try/catch`: a missing one only degrades a feature — it never parks the plugin in PENDING and never makes the composer disappear. A missing `settings.section` slot (older host) simply means no settings page; the button keeps working.

---

## License

MIT

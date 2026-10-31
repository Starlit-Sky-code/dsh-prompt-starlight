# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project adheres to [Semantic Versioning](https://semver.org/).

Chinese version: [CHANGELOG.zh-CN.md](CHANGELOG.zh-CN.md).

## [Unreleased]

### Changed

- **The model switcher follows DSH's native pattern**: a row with the label on the left, the current value on the right and a chevron, expanding into a list below, replaces the native `<select>`. On dark themes the OS dropdown pops up as a white sheet with its own font and colours; the list, its hover state, the check mark and the "re-read catalog" entry are now drawn by the plugin.
- **The popover animates in and out**: it scales and fades in from the button's side (bottom right), and on close it plays the exit animation before unmounting. Everything is disabled under `prefers-reduced-motion`.
- The settings page's model row drops the duplicated heading and left-aligns the value, matching the other native rows.
- **A gear button in the popover's top-right corner opens a standalone settings window**: a 760px modal holding the same config as Settings → Starlight — model, strength, detail, language, scenario, rules (with notes, counters, all-on/all-off, two columns), custom rules, advanced and the master switch, with the status line and Save / Restore defaults pinned at the bottom. Esc and a backdrop click close it; closing returns focus to the gear and refreshes the popover so it never shows pre-save values.
  DSH exposes no API for a client plugin to open the settings page (the settings shell exports only `apply`/`inject`, the SPA has no hash or routing, and the installed `dsh-ops` / `dsh-whale-widget` plugins show no such call), so the plugin opens its own window instead of faking a jump.
- **The popover's "More" section is far more compact**: rules show their title only (the note becomes a hover tooltip), two columns, group notes dropped, and custom rules fold into a nested section. The panel cap went from 560 to 620px, so the footer stays put.
- Screenshots are now quantized to a 256-colour palette: `tools/make-shots.mjs` calls `tools/optimize-shots.py`. Eight images 1.08 MB → 0.43 MB, and the package is back to 0.83 MB.

- **A third settings tab, "Plugin market"** (read-only): point it at any format 1 index over https — it defaults to our own index — and it lists each plugin's title, category, version and description, folding the catalog's declared version into a paste-ready install spec (`git+https…#commit` or `name@version`) with one-click copy. The tab loads on open; there is no button to press first.
  - Still read-only: it installs nothing and writes no files; the footer just says the market is a read-only view.
  - Served through a host proxy, `GET /dsh-starlight/market`: it accepts only credential-free https URLs without query or fragment, refuses redirects, times out at 10s, caps at 2 MiB, checks the format and whitelists fields; the same index is cached for 60s.

- **A slimmer popover**: rules, custom rules and advanced parameters now live only in the settings window (the gear); expanding the popover leaves the scenario switch, one clickable row that opens the window, and the master toggle. The section summary reads "scenario · General" instead of a rule count — the rules are no longer in that block, so reporting a count only misleads. (the gear); expanding the popover leaves the scenario switch and the master toggle, plus a line saying where the rest went. The same set used to appear three times — popover, settings window, settings page — and the popover copy only made the panel taller.
- **A Tab trap for the settings window**: inside the modal, Tab and Shift+Tab wrap at both ends instead of escaping to the page behind it; closing still returns focus to the gear.

### Fixed

- The model note was clipped by the picker's rounded container.
- **The gear is an SVG icon now**: the ⚙ glyph renders as a small circle in many fonts and does not read as settings.
- **The popover and the settings window carry an inset hairline**: on dark themes their fill is too close to the page fill for a shadow alone to separate them.
- **Rule checkboxes are drawn by the plugin**: a native checkbox only honours accent-color, so its unchecked state was a glaring white square on dark themes; both themes now share the same blue check.
- **The rules grid decided its columns from the viewport width** (`@media (min-width:560px)`), so the 360px-wide popover was squeezed into two columns on a large screen. It now follows the container: two compact columns in the popover, two columns with notes on the settings page.
- The final shortcut hint in the expanded popover was cut in half by the panel edge; it has moved out (the settings page and README both mention it).

### Added

- **A "Skill market" tab on the settings page** (read-only catalog): searches the public ClawHub catalog and shows each skill's name, author, downloads, summary and the install reference the catalog itself provides, with one-click copy and a link to its page.
  - Read-only: it installs nothing and writes no files; the footer just says the catalog is a read-only view, with no save button.
  - Served through a host proxy, `GET /dsh-starlight/skills`: avoids browser CORS, and bounds upstream with a 10s timeout, no redirect following, a 1 MiB response cap and a field whitelist; identical queries are cached host-side for 60s.

## [0.4.1] - 2026-10-25

### Added

- **Plugin card artwork**: `package.json` declares `icon`; the host reads the file and inlines it as a data URL. The card previously fell back to DSH's built-in placeholder.
- **Localized display text**: `locale/en.json` and `locale/zh.json` supply the card's `title` / `description`; `exports` must expose `./locale/*` or the host silently skips them.
- **`tools/check-plugin-meta.mjs`**: replicates the host's `readPluginMeta()` rules, so the card contents can be verified before restarting DSH.
- **format-1 plugin market index** (`market/index.json`): DSH has no official market — a market is a JSON index on any https URL, added under Plugins → Discover.
- **Prebuilt tarball on GitHub Releases**: installs without a pnpm build-authorisation prompt.
- **GitHub Actions**: `ci.yml` (full checks on push/PR) and `release.yml` (tag-driven release).

### Changed

- **All user-facing copy rewritten**: no longer claims the removed "7 styles"; it now describes the strength/detail sliders and the 11 rules that actually exist.
- **Publish target pinned to `registry.npmjs.org`**, so a global `.npmrc` cannot silently repoint publishing at GitHub Packages and produce a misleading `ENEEDAUTH`.
- Trimmed `files[]` by dropping three images that only serve GitHub.

### Fixed

- `.gitignore` now covers the root `node_modules/`; a previous `git add -A` committed 140 files by accident.
- The CI check "no node_modules in the package" now inspects git tracking — the old version looked for the directory and always failed in CI.

## [0.4.0] - 2026-10-25

### Changed (breaking)

- **UI rework**: the popover and the settings page share one skeleton — model first, strength (5 stops) and detail (3 stops) as sliders, everything else folded away. The popover shows four controls by default.
- **Config v1 → v2**: `style` split into two independently adjustable axes, `verbosity` and `lens`. Legacy files migrate automatically through `LEGACY_STYLE_MAP`.

### Added

- Plugin artwork in the UI: a new host route `GET /dsh-starlight/icon.png` serves `assets/icon-ui.png` (the browser half cannot read local files).
- The advanced `maxTokens` / temperature / timeout fields are sliders too.
- `tools/make-shots.mjs` renders the real components into README screenshots (jsdom + React + headless Edge).

### Removed

- `design/settings-variants.html` — the three mockup variants were superseded by the implementation.

## [0.3.0] - 2026-10-24

### Added

- Switchable optimizer model: follow the session by default, or pin a cheaper one; the session's current model and any failing provider are shown.
- Three settings-page design mockups (later superseded).

## [0.2.0] - 2026-10-24

### Added

- The button moved to the left of the composer toolbar, with a hairline ring and soft glow.
- A dedicated settings page (Settings → Starlight).

## [0.1.0] - 2026-10-24

### Added

- First release: a circular four-pointed-star button beside the composer that rewrites the draft into a clearer prompt.
- 11 built-in rules (structure / expression quality / fidelity guards), custom rules, output language and change budget.
- Degrades to a local tidy-up, with a stated reason, when no model is available.

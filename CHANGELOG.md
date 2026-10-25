# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project adheres to [Semantic Versioning](https://semver.org/).

Chinese version: [CHANGELOG.zh-CN.md](CHANGELOG.zh-CN.md).

## [Unreleased]

### Changed

- **The model switcher follows DSH's native pattern**: a row with the label on the left, the current value on the right and a chevron, expanding into a list below, replaces the native `<select>`. On dark themes the OS dropdown pops up as a white sheet with its own font and colours; the list, its hover state, the check mark and the "re-read catalog" entry are now drawn by the plugin.
- **The popover animates in and out**: it scales and fades in from the button's side (bottom right), and on close it plays the exit animation before unmounting. Everything is disabled under `prefers-reduced-motion`.
- The settings page's model row drops the duplicated heading and left-aligns the value, matching the other native rows.

### Fixed

- The model note was clipped by the picker's rounded container.

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

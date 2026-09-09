---
type: Configuration
title: Linting & Code Quality (v2)
description: ESLint, Prettier, and secret scanning enforcement in Narrative Sprout v2.
tags: [lint, prettier, eslint, gitleaks, tailwindcss]
timestamp: 2026-09-09T00:00:00Z
source: eslint.config.js, .prettierrc.json, .prettierignore, .github/workflows/ci.yml, src/index.css
---

# Overview

CI (`ci.yml` `check` job) runs `bun run lint` → `bunx tsc --noEmit` → `bun test` → `bun run format:check`; the `e2e` job runs Playwright on a chromium/webkit matrix; the `secret-scan` job runs the gitleaks release binary over full history. All jobs must be green to merge.

# ESLint

Flat config (`eslint.config.js`): `js.configs.recommended` + `typescript-eslint` recommended, ignoring `dist/`, `node_modules/`, `playwright-report/`, and `test-results/`. Plus one project-specific rule (REDESIGN §5.7):

- `no-restricted-syntax`: **`.catch()` on `z.record(…)` / `z.array(…)` results is an error** — validate element-wise instead. (Selector targets `CallExpression[callee.property.name="catch"][callee.object.callee.property.name=/^(record|array)$/]`.)

# Prettier

`.prettierrc.json` formatting with `--check .` in CI. `.prettierignore` skips `*.md` (avoids churning hand-edited tables) and `public/` (vendored fonts/images). `prettier-plugin-tailwindcss` (with `tailwindStylesheet: ./src/index.css`, required for Tailwind v4) auto-sorts classes in `class`/`className` attributes, `@apply` blocks, and configured functions on `--write`.

# Tailwind CSS Lint (`eslint-plugin-better-tailwindcss`)

Chosen over `eslint-plugin-tailwindcss` v4: CSS-first native (`entryPoint: src/index.css` resolves `@theme` custom colors like `bg-body-bg`), auto-detects `@layer components` classes via `detectComponentClasses`, higher rule coverage, more active maintenance. `recommended` preset is enabled as-is (stylistic = warn, correctness = error), with two project adjustments in `eslint.config.js`:

- `enforce-consistent-line-wrapping: off` — conflicts with `prettier-plugin-tailwindcss` (verified: enabling it makes `eslint --fix` and `prettier --write` reformat the same class strings back and forth, ~98 files). Line wrapping is left to Prettier; class **order** is enforced by both tools and they agree on it.
- `no-unknown-classes` (`error`) + `ignore` list — `detectComponentClasses` only covers `@layer components` (e.g. `form-*`, `choice-*`). Custom classes defined in `@layer base`/`utilities` (`support-text-color`, `text-bg-color`, `font-serif-display`, `animate-fade-in/out`, …) and the external icon-font class `material-symbols-rounded` (`public/s/icons.css`, not part of Tailwind) are allow-listed by regex. **When adding a custom class, prefer `@layer components`, otherwise add it to this list — CI fails on unlisted classes.**

One intentional exception: `ToggleSwitch.tsx` disables `no-conflicting-classes` for its `checked:after:hover:` / `checked:after:focus:` background pair (same emitted `content` value, different states — harmless).

# Secrets

gitleaks runs in CI over the whole git history (`--redact --verbose`), plus GitHub Secret Scanning / Push Protection on the repo. `.env*` (except `.env.example`) is gitignored; `dist/` is gitignored on every branch.

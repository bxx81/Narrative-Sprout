---
type: Configuration
title: Linting & Code Quality (v2)
description: ESLint, Prettier, and secret scanning enforcement in Narrative Sprout v2.
tags: [lint, prettier, eslint, gitleaks]
timestamp: 2026-09-02T00:00:00Z
source: eslint.config.js, .prettierrc.json, .prettierignore, .github/workflows/ci.yml
---

# Overview

CI (`ci.yml` `check` job) runs `bun run lint` → `bunx tsc --noEmit` → `bun test` → `bun run format:check`; the `secret-scan` job runs the gitleaks release binary over full history. All jobs must be green to merge.

# ESLint

Flat config (`eslint.config.js`): `js.configs.recommended` + `typescript-eslint` recommended, ignoring `dist/` and `node_modules/`. Plus one project-specific rule (REDESIGN §5.7):

- `no-restricted-syntax`: **`.catch()` on `z.record(…)` / `z.array(…)` results is an error** — validate element-wise instead. (Selector targets `CallExpression[callee.property.name="catch"][callee.object.callee.property.name=/^(record|array)$/]`.)

# Prettier

`.prettierrc.json` formatting with `--check .` in CI. `.prettierignore` skips `*.md` (avoids churning hand-edited tables) and `public/` (vendored fonts/images).

# Secrets

gitleaks runs in CI over the whole git history (`--redact --verbose`), plus GitHub Secret Scanning / Push Protection on the repo. `.env*` (except `.env.example`) is gitignored; `dist/` is gitignored on every branch.

---
type: Configuration
title: Build System (v2)
description: Vite, TypeScript, chunk splitting, and build toolchain of Narrative Sprout v2.
tags: [build, vite, typescript, chunks]
timestamp: 2026-10-07T00:00:00Z
source: vite.config.ts, tsconfig.json, package.json
---

# Overview

Vite 7 + React plugin + Tailwind v4 plugin + `vite-plugin-pwa`. TypeScript is strict (`strict`, `noUnusedLocals/Parameters`, `noFallthroughCasesInSwitch`, `moduleResolution: bundler`, `target ES2022`, `jsx: react-jsx`); `bun run build` runs `tsc --noEmit` before `vite build`. `__APP_VERSION__` is defined from `package.json` (`2.0.0`); `__BUILD_SHA__` is the short commit SHA (Cloudflare `CF_PAGES_COMMIT_SHA` → GitHub `GITHUB_SHA` → `git rev-parse --short=7 HEAD`, else `unknown`). Both appear on the title screen as `Version: 2.0.0 (abc1234)`, linked to that exact commit.

# Chunk Splitting

`vite.config.ts` `manualChunks` separates vendors for PWA cache efficiency (app code changes every release, vendors only on version bumps):

| Chunk | Contents | Size (raw, ~) |
|-------|----------|---------------|
| `index` | App code | 555 kB (gzip ~182 kB) |
| `react` | react + react-dom + react-router + react-i18next + react-hot-toast | 249 kB |
| `zod` | zod v4 (full bundle) | 92 kB (gzip ~25 kB) |
| `i18next` | i18next core | 43 kB |

`chunkSizeWarningLimit: 600`. Zod mini migration was deliberately rejected: it needs a full function-style rewrite of every schema (the mini build exposes only a function-style API) for a ~10 kB gzip gain — poor cost/benefit; revisit only if startup load needs major optimization (locale JSON dynamic import is the more efficient candidate). `@gradio/client` (HF image backend) stays lazily imported so it never joins the startup graph.

# Scripts

| Script | Command |
|--------|---------|
| `bun dev` | `vite` (dev server, HMR) |
| `bun test` | `bun test --path-ignore-patterns='e2e/**'` (unit tests, happy-dom; e2e/ excluded) |
| `bun run test:e2e` | `playwright test` (E2E, chromium + webkit) |
| `bun run build` | `tsc --noEmit && vite build` |
| `bun run lint` | `eslint .` |
| `bun run format:check` | `prettier --check .` |
| `bun run sync:tauri-version` | copy `package.json#version` into `src-tauri/Cargo.toml` |
| `bun run check:tauri-version` | verify `Cargo.toml` version matches (CI; no writes) |

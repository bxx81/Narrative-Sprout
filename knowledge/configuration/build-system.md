---
type: Configuration
title: Build System (v2)
description: Vite, TypeScript, chunk splitting, and build toolchain of Narrative Sprout v2.
tags: [build, vite, typescript, chunks]
timestamp: 2026-09-02T00:00:00Z
source: vite.config.ts, tsconfig.json, package.json
---

# Overview

Vite 7 + React plugin + Tailwind v4 plugin + `vite-plugin-pwa`. TypeScript is strict (`strict`, `noUnusedLocals/Parameters`, `noFallthroughCasesInSwitch`, `moduleResolution: bundler`, `target ES2022`, `jsx: react-jsx`); `bun run build` runs `tsc --noEmit` before `vite build`. `__APP_VERSION__` is defined from `package.json` (`2.0.0`).

# Chunk Splitting

`vite.config.ts` `manualChunks` separates vendors for PWA cache efficiency (app code changes every release, vendors only on version bumps):

| Chunk | Contents | Size (raw, ~) |
|-------|----------|---------------|
| `index` | App code | 555 kB (gzip ~182 kB) |
| `react` | react + react-dom + react-router + react-i18next + react-hot-toast | 249 kB |
| `zod` | zod v4 (full bundle) | 92 kB (gzip ~25 kB) |
| `i18next` | i18next core | 43 kB |

`chunkSizeWarningLimit: 600`. Zod mini migration was deliberately rejected: it needs a full function-style rewrite of every schema for ~10 kB gzip gain (see SESSION_HANDOFF Phase 6.9.5). `@gradio/client` (HF image backend) stays lazily imported so it never joins the startup graph.

# Scripts

| Script | Command |
|--------|---------|
| `bun dev` | `vite` (dev server, HMR) |
| `bun test` | `bun test` (unit tests, happy-dom) |
| `bun run build` | `tsc --noEmit && vite build` |
| `bun run lint` | `eslint .` |
| `bun run format:check` | `prettier --check .` |

---
type: Playbook
title: Build & Deploy (v2)
description: Production build and Cloudflare Pages deployment of Narrative Sprout v2.
tags: [build, deploy, cloudflare]
timestamp: 2026-09-02T00:00:00Z
source: vite.config.ts, package.json, README, SESSION_HANDOFF.md
---

# Overview

`bun run build` (`tsc --noEmit && vite build`) produces `dist/` — minified app + vendor chunks (`index/react/zod/i18next`), precached locales, manifest + service worker, fonts, icons, title art. `dist/` is gitignored on every branch and never committed.

# Cloudflare Pages

Git integration (no CLI/Workers knowledge needed): push to `main` → production deploy of `https://narrative-sprout.pages.dev/`; each PR gets a preview URL. Dashboard holds `BUN_VERSION=1.4.0` (must match `packageManager`/`.bun-version`) and `VITE_GOOGLE_CLIENT_ID` for production. No `functions/` directory exists yet; if serverless handling is ever added it must live in repo-root `functions/`.

# Release Notes

- Current app version `2.0.0` (semver break from v1 by design).
- PWA `autoUpdate`: new service worker activates on reload; chunk splitting keeps per-release re-downloads near the app chunk (~182 kB gzip + changed vendors).
- Tauri desktop (Phase 7) is future work on its own branch (`src-tauri` branch, stronghold for credentials); `dist/` stays ignored everywhere so branch merges stay clean.

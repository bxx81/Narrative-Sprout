---
type: Playbook
title: Build & Deploy (v2)
description: Production build and Cloudflare Pages deployment of Narrative Sprout v2.
tags: [build, deploy, cloudflare, release, versioning]
timestamp: 2026-10-07T00:00:00Z
source: vite.config.ts, package.json, README, release-please-config.json, .github/workflows/release-please.yml
---

# Overview

`bun run build` (`tsc --noEmit && vite build`) produces `dist/` — minified app + vendor chunks (`index/react/zod/i18next`), precached locales, manifest + service worker, fonts, icons, title art. `dist/` is gitignored on every branch and never committed.

# Cloudflare Pages

Git integration (no CLI/Workers knowledge needed): push to `main` → production deploy of `https://narrative-sprout.pages.dev/`; each PR gets a preview URL. Dashboard holds `BUN_VERSION=1.4.0` (must match `packageManager`/`.bun-version`) and `VITE_GOOGLE_CLIENT_ID` for production. No `functions/` directory exists yet; if serverless handling is ever added it must live in repo-root `functions/`.

# Version Management

- `package.json#version` is the single source of truth. `vite.config.ts` injects it as `__APP_VERSION__` (shown on the title screen) and `src-tauri/tauri.conf.json` reads it via `"version": "../package.json"`.
- Because the web deploys continuously between releases, the title screen also shows `__BUILD_SHA__` — the short commit SHA of the build (`CF_PAGES_COMMIT_SHA` → `GITHUB_SHA` → `git rev-parse --short=7 HEAD`, else `unknown`) — as `Version: 2.0.0 (abc1234)` and links it to that exact commit. This identifies a specific deploy within the same release.
- `Cargo.toml` has no such indirection: `scripts/sync-tauri-version.ts` copies the version into its `[package]` section. Run `bun run sync:tauri-version` to write, `bun run check:tauri-version` to verify (wired into CI's `check` job and run before the Tauri CLI via the `tauri` script). `Cargo.lock` is left to `cargo` to refresh on the next build.
- Releases are automated by [release-please](https://github.com/googleapis/release-please) (`.github/workflows/release-please.yml`, `release-please-config.json`, `.release-please-manifest.json`). It reads Conventional Commits on `main` and opens a release PR that bumps `package.json`, updates `CHANGELOG.md`, and bumps `Cargo.toml` (via its `# x-release-please-version` annotation, which retains comments/formatting). Merging that PR creates the `vX.Y.Z` tag + GitHub Release. `bootstrap-sha` pins the first scan to the v2 line; the default `GITHUB_TOKEN` is used, so workflows do not run on the release PR itself.

# Release Notes

- Current app version `2.0.0` (semver break from v1 by design).
- PWA `autoUpdate`: new service worker activates on reload; chunk splitting keeps per-release re-downloads near the app chunk (~182 kB gzip + changed vendors).
- Tauri desktop (Phase 7) ships on `main` (real-machine verified); see `operations/desktop-app.md`.

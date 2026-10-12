---
type: Playbook
title: Build & Deploy (v2)
description: Production build and Cloudflare Pages deployment of Narrative Sprout v2.
tags: [build, deploy, cloudflare, release, versioning]
timestamp: 2026-10-11T00:00:00Z
source: vite.config.ts, package.json, README, release-please-config.json, .github/workflows/release-please.yml, .github/workflows/tauri-release.yml
---

# Overview

`bun run build` (`tsc --noEmit && vite build`) produces `dist/` — minified app + vendor chunks (`index/react/zod/i18next`), precached locales, manifest + service worker, fonts, icons, title art. `dist/` is gitignored on every branch and never committed.

# Cloudflare Pages

Git integration (no CLI/Workers knowledge needed): push to `main` → production deploy of `https://narrative-sprout.pages.dev/`; each PR gets a preview URL. Dashboard holds `BUN_VERSION=1.4.0` (must match `packageManager`/`.bun-version`) and `VITE_GOOGLE_CLIENT_ID` for production. No `functions/` directory exists yet; if serverless handling is ever added it must live in repo-root `functions/`.

# Version Management

- `package.json#version` is the single source of truth. `vite.config.ts` injects it as `__APP_VERSION__` (shown on the title screen) and `src-tauri/tauri.conf.json` reads it via `"version": "../package.json"`.
- Because the web deploys continuously between releases, the title screen also shows `__BUILD_SHA__` — the short commit SHA of the build (`CF_PAGES_COMMIT_SHA` → `GITHUB_SHA` → `git rev-parse --short=7 HEAD`, else `unknown`) — as `Version: 2.0.0 (abc1234)` and links it to that exact commit. This identifies a specific deploy within the same release.
- `Cargo.toml` has no such indirection: `scripts/sync-tauri-version.ts` copies the version into its `[package]` section. Run `bun run sync:tauri-version` to write, `bun run check:tauri-version` to verify (wired into CI's `check` job and run before the Tauri CLI via the `tauri` script).
- `Cargo.lock` must NOT be handed to release-please as an extra-file: `cargo` owns the `narrative-sprout` entry's version line, rewrites the file on every invocation, and strips comments — a `# x-release-please-version` annotation disappears on the next `cargo` run even when the lock already matches the manifest (verified with the project's cargo 1.99). The refresh `cargo` produces is treated as a build byproduct and committed back to `main` by the release workflow (see Release Assets), which keeps the tree clean for the next local `bunx tauri build`. A local build right after the release-PR merge still shows the one-line version refresh until that back-commit lands.
- Releases are automated by [release-please](https://github.com/googleapis/release-please) (`.github/workflows/release-please.yml`, `release-please-config.json`, `.release-please-manifest.json`). It reads Conventional Commits on `main` and opens a release PR that bumps `package.json`, updates `CHANGELOG.md`, and bumps `Cargo.toml` (via its `# x-release-please-version` annotation, which retains comments/formatting). Merging that PR creates the tag + GitHub Release. `bootstrap-sha` pins the first scan to the v2 line. Tag/release names are entirely release-please-generated (2.1.0 shipped as `narrative-sprout-v2.1.0`, 2.0.1 as `narrative-sprout-v2.0.1`, 2.0.0 as plain `v2.0.0`) — nothing may hardcode any pattern.
- **release-please must run with a PAT** (repository secret `RELEASE_PLEASE_TOKEN`, fine-grained token scoped to this repository, Contents read/write; a guard step fails the workflow when it is missing). Events created with the default `GITHUB_TOKEN` never start new workflow runs, so a release-please-created tag/release would not reach `tauri-release.yml`. This happened for real on 2.1.0: the release published without its installer (zero `tauri-release` runs) purely because release-please used the default token. With the PAT, the release PR push now also triggers `pull_request` CI — expected, and it finally verifies the release PR before merge. Rotate the token before its one-year expiry; the same failure mode returns silently otherwise.

# Release Assets (Windows installer)

`.github/workflows/tauri-release.yml` fires on the GitHub Release release-please just published (`release: types: [published]`). On `windows-latest` it checks out the release tag, installs Bun + stable Rust (`Swatinem/rust-cache`, `workspaces: src-tauri`), and builds through `tauri-apps/tauri-action@v1` with `tauriScript: bun run tauri` — i.e. the same `bun run tauri build` a local release build runs (the `tauri` script runs `sync:tauri-version` first). A first step resolves the upload target from the tag via the GitHub API (works for both the release event and a manual `workflow_dispatch`, where only the tag is known) and deletes stale `*-setup.exe` / `*.msi` assets so a re-run replaces instead of failing on a duplicate name. The NSIS installer (`src-tauri/target/release/bundle/nsis/Narrative Sprout_<version>_x64-setup.exe`) is uploaded onto that release via `releaseId`; `uploadUpdaterJson: false` because the app has no updater. The final step commits the cargo-refreshed `Cargo.lock` back to `main` — skipped when `main` is strictly ahead of the release commit, so dependencies merged in the meantime can never be rolled back. NSIS is the only bundle target (`tauri.conf.json`), so no per-platform matrix is needed; the runner already provides the WebView2 runtime. Drive backup on desktop needs the Desktop-type OAuth client id + secret at build time: locally they live in a gitignored `.env.tauri` at the repo root (Vite loads it automatically for `--mode tauri`), and the workflow writes the same file on the runner from the repository Actions secrets `VITE_GOOGLE_CLIENT_ID_TAURI` / `VITE_GOOGLE_CLIENT_SECRET_TAURI` (the build fails with an explicit error when either secret is missing, because a Tauri build without them silently falls back to the web client id and Drive sign-in then fails at the token exchange). The values are never committed; `.env.example` stays empty.

Recovery: Actions → `tauri-release` → Run workflow → `release_tag` (e.g. `narrative-sprout-v2.1.0`) rebuilds and attaches the installer to an existing release; this is also the documented way to repair a release that shipped without its installer.

# Release Notes

- Current app version `2.0.1` (semver break from v1 by design).
- PWA `autoUpdate`: new service worker activates on reload; chunk splitting keeps per-release re-downloads near the app chunk (~182 kB gzip + changed vendors).
- Tauri desktop (Phase 7) ships on `main` (real-machine verified); see `operations/desktop-app.md`.

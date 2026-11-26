---
type: Playbook
title: Desktop App (Tauri)
description: Windows desktop build of Narrative Sprout v2 — Stronghold credential Vault, system-browser OAuth, and Tauri-mode build notes.
tags: [tauri, desktop, stronghold, oauth]
timestamp: 2026-10-11T00:00:00Z
source: src-tauri/src/lib.rs, src-tauri/tauri.conf.json, src/features/desktop/, src/db/credentialsRepository.ts, vite.config.ts, scripts/separate-assets.mjs
---

# Overview

The same `main` branch builds a Windows desktop app (`src-tauri/` lives alongside the web app; only `target/` and `gen/` are ignored). `bun run tauri:dev` runs Vite in `--mode tauri`; `bunx tauri build` produces the NSIS installer. Every GitHub release gets that same installer attached automatically by CI (`.github/workflows/tauri-release.yml` — see `operations/build-and-deploy.md`), so a local build is only needed for testing. Tauri mode disables the PWA service worker (`virtual:pwa-register` becomes a noop stub), and `scripts/separate-assets.mjs` strips fonts/images from `dist/` into native resources resolved at runtime via `resourceDir` + `convertFileSrc` (`features/desktop/assetResolver.ts`, `fontLoader.ts`). The bundled `legal/` pages (terms/privacy + OSS licenses, native resources) are opened in the system browser via `openPath` (`features/desktop/legalDocuments.ts`, wired in `TitleScreen`). OS file drop, native fullscreen, app exit, and the native title-bar theme (`windowTheme.ts` — `WebviewWindow.setTheme` follows the `colorScheme` setting, `null` for `system`; `core:window:allow-set-theme` capability) are wired in `features/desktop/` with dynamic imports only (nothing Tauri enters the web bundle; verified by chunk split). Second launches focus the first window (single-instance plugin — concurrent writers must never touch the Vault, keyring entry, or IndexedDB).

# OSS License Page (per-build generation)

`rollup-plugin-license` (`vite.config.ts`) lists exactly the dependencies inside the **current bundle**, so the web build (tree-shaken `@tauri-apps/*`, includes workbox) and the Tauri build (`@tauri-apps/*` retained, no workbox) legitimately differ. Each mode writes its own flavor and they never share a file — both artifacts are gitignored build outputs:

- **Web/PWA**: `public/legal/license.html` (dev server) + direct write to `dist/legal/license.html` (deploy artifact — `public/` is copied to `dist/` at build start, before the plugin runs, so the fresh file must land in `dist/legal` itself).
- **Tauri**: `src-tauri/resources/legal/license.html`, mapped in `tauri.conf.json` `resources` into the install folder (`legal/license.html`). `public/legal/terms_of_service.html` / `privacy_policy.html` (hand-maintained) are mapped individually — the `../public/legal` directory mapping is gone so the web flavor can never leak into the installer.

# Credential Vault

API keys/tokens live in a Stronghold Vault (`credentials.hold` in LOCAL app data — machine-bound, never Roaming), operated through Rust-only commands (`credential_get/set/delete`); the Vault password never crosses into JS. The password is 32 random bytes (Stronghold hard-requires `NC_DATA_SIZE`), hex-encoded in the OS credential store, generated once with no user prompt. Snapshot file encryption uses age work factor 0 (scrypt stretching is meaningless against a 256-bit random password; the file stays encrypted). Gotchas fixed in 7.3: `keyring` v3 needs the `windows-native` feature or it silently falls back to an unpersisted in-process mock (guard + tripwire tests); `load_client` is required after opening a snapshot; first launch migrates IndexedDB → Vault idempotently (never overwrites newer Vault values); wipe purges the Vault before `db.delete()`. Non-Windows targets need their own keyring features (`apple-native` / `linux-native-*`) — until then the mock guard fails fast instead of losing credentials.

# Windows Startup Crash — vertdll.dll (and the `windows` shim)

`stronghold-runtime` 2.0.1 (transitive via `iota_stronghold`) is the only user of the `windows` 0.36.1 crate. That crate's `#[link(name = "windows")]` pulls in the combined `windows.lib` from `windows_x86_64_msvc` 0.36.1, which contains an import descriptor for `vertdll.dll` (the VSM enclave runtime DLL) providing `WaitOnAddress`/`WakeByAddressAll`. `windows.lib` is passed first on the MSVC link line, so its definitions beat the correct `synchronization.lib` ones and the executable ends up importing `vertdll.dll`. Loading that DLL outside a VBS enclave starts a worker thread that null-derefs: the app shows a white window and dies with `STATUS_ACCESS_VIOLATION` (0xC0000005) at startup — a thread whose start routine is inside `vertdll.dll`, crashing at `vertdll+0xdc7e`. The bad import was present in earlier releases too; Windows builds with `vertdll.dll` 10.0.26100.9974 (KB5132061/KB5132688, November 2026) turned it into a hard crash.

Fix: `[patch.crates-io] windows = { path = "vendor/windows-0.36.1-kernel32-shim" }` in `src-tauri/Cargo.toml` — a minimal stand-in exposing exactly the API surface `stronghold-runtime` uses (`Win32::Foundation` handles/errors, `Win32::System::Memory` allocation APIs, `core::PCWSTR`/`Error`), bound to `kernel32.dll` instead, with no `#[link(name = "windows")]`. It deliberately fails to compile if `stronghold-runtime` ever calls a Win32 API the shim does not implement, so it cannot silently drift. `WaitOnAddress` itself is referenced by `std`/`parking_lot_core`, which already link `synchronization.lib` (`api-ms-win-core-synch-l1-2-0.dll`) — the shim does not need to provide it.

Verification: `dumpbin /imports` on a built exe must never list `vertdll.dll` (the `tauri-release` workflow fails the build if it does). Remove the patch entry and `vendor/windows-0.36.1-kernel32-shim/` if `stronghold-runtime` ever moves off `windows` 0.36 (2.0.1 is the latest release as of writing).

# Desktop OAuth

The WebView cannot do provider consent, so OpenRouter PKCE and Google Drive run in the OS browser against a one-shot localhost server (`start_server` + `tauri-plugin-oauth`), sharing `features/desktop/oauthLoopback.ts`. Google needs a Desktop-type client id **and** its client secret at the token endpoint (observed — PKCE alone is rejected); both are build-time `.env.tauri` values, never committed. Drive tokens stay in memory only, like the web GIS flow.

# Threat Model (honest wording)

The Vault defeats file inspection and off-machine reads; bulk data (stories, images) relies on the OS user-account boundary. Same-account processes are outside the protection boundary (they can reach the OS credential store). Never claim app-side encryption beyond this.

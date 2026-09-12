---
type: Playbook
title: Desktop App (Tauri)
description: Windows desktop build of Narrative Sprout v2 — Stronghold credential Vault, system-browser OAuth, and Tauri-mode build notes.
tags: [tauri, desktop, stronghold, oauth]
timestamp: 2026-09-12T00:00:00Z
source: src-tauri/src/lib.rs, src-tauri/tauri.conf.json, src/features/desktop/, src/db/credentialsRepository.ts, vite.config.ts, scripts/separate-assets.mjs
---

# Overview

The same `main` branch builds a Windows desktop app (`src-tauri/` lives alongside the web app; only `target/` and `gen/` are ignored). `bun run tauri:dev` runs Vite in `--mode tauri`; `bunx tauri build` produces the NSIS installer. Tauri mode disables the PWA service worker (`virtual:pwa-register` becomes a noop stub), and `scripts/separate-assets.mjs` strips fonts/images from `dist/` into native resources resolved at runtime via `resourceDir` + `convertFileSrc` (`features/desktop/assetResolver.ts`, `fontLoader.ts`). The bundled `legal/` pages (terms/privacy/OSS licenses, also native resources) are opened in the system browser via `openPath` (`features/desktop/legalDocuments.ts`, wired in `TitleScreen`). OS file drop, native fullscreen, and app exit are wired in `features/desktop/` with dynamic imports only (nothing Tauri enters the web bundle; verified by chunk split). Second launches focus the first window (single-instance plugin — concurrent writers must never touch the Vault, keyring entry, or IndexedDB).

# Credential Vault

API keys/tokens live in a Stronghold Vault (`credentials.hold` in LOCAL app data — machine-bound, never Roaming), operated through Rust-only commands (`credential_get/set/delete`); the Vault password never crosses into JS. The password is 32 random bytes (Stronghold hard-requires `NC_DATA_SIZE`), hex-encoded in the OS credential store, generated once with no user prompt. Snapshot file encryption uses age work factor 0 (scrypt stretching is meaningless against a 256-bit random password; the file stays encrypted). Gotchas fixed in 7.3: `keyring` v3 needs the `windows-native` feature or it silently falls back to an unpersisted in-process mock (guard + tripwire tests); `load_client` is required after opening a snapshot; first launch migrates IndexedDB → Vault idempotently (never overwrites newer Vault values); wipe purges the Vault before `db.delete()`. Non-Windows targets need their own keyring features (`apple-native` / `linux-native-*`) — until then the mock guard fails fast instead of losing credentials.

# Desktop OAuth

The WebView cannot do provider consent, so OpenRouter PKCE and Google Drive run in the OS browser against a one-shot localhost server (`start_server` + `tauri-plugin-oauth`), sharing `features/desktop/oauthLoopback.ts`. Google needs a Desktop-type client id **and** its client secret at the token endpoint (observed — PKCE alone is rejected); both are build-time `.env.tauri` values, never committed. Drive tokens stay in memory only, like the web GIS flow.

# Threat Model (honest wording)

The Vault defeats file inspection and off-machine reads; bulk data (stories, images) relies on the OS user-account boundary. Same-account processes are outside the protection boundary (they can reach the OS credential store). Never claim app-side encryption beyond this.

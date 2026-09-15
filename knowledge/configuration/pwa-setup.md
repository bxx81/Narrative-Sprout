---
type: Configuration
title: PWA Setup (v2)
description: Progressive Web App manifest, service worker, caching, and offline behavior of Narrative Sprout v2.
tags: [pwa, service-worker, offline]
timestamp: 2026-09-14T00:00:00Z
source: vite.config.ts, src/main.tsx, index.html, src/db/wipeRepository.ts, src/store/gameStore.ts
---

# Overview

Installable standalone PWA with offline UI, via `vite-plugin-pwa` (`registerType: "autoUpdate"`). `main.tsx` calls `registerSW({ immediate: true })` (`virtual:pwa-register`, typed via `vite-env.d.ts`).

# Manifest & Icons

`vite.config.ts` manifest: name `Narrative Sprout`, `display: standalone`, theme/background `#1a1a2e`, icons `icons/android-chrome-192x192.png` + `icons/android-chrome-512x512.png` (both real files under `public/icons/`, alongside favicons and the Apple touch icon). `index.html` also loads `/s/icons.css` (Material icons) and `/s/en.css` globally.

# Caching

- **Precache** (`globPatterns: **/*.{js,css,html,json,svg,ico,ogg}`): app chunks, styles, HTML, the **bundled locale JSON**, and the UI sound effects (`public/sounds/*.ogg`, ~70 KB total) — so the UI works offline. Versioned vendor chunks (`react`/`zod`/`i18next`) keep per-release precache diffs small.
- **Runtime `CacheFirst`** (`static-assets`, 300 entries / 30 days): `/(images|s)/…(webp|woff2?|ttf|otf)` — heavy title backgrounds and font files. `webp` is deliberately excluded from precache (initial install would be huge).
- LLM/image/Drive API calls are never cached (network-only).

# Offline & Wipe

Loaded games remain viewable offline (IndexedDB); new generations need API access. Data wipe (`wipeRepository` + storage clearing + reload) returns to factory state and lands on `/deletion_complete` (flagged via `sessionStorage`).

- **Wipe order** (`gameStore.wipeAllData` → `wipeRepository.wipeAllUserData`): `revokeDriveAccessToken()` (best-effort, capped at 3 s via `WIPE_REVOKE_TIMEOUT_MS`, so the Google-side grant does not survive) → SW unregister + Cache Storage deletion (`clearPwaTraces`: precache + `static-assets` + `sample-saves`) → `db.delete()` → other IndexedDB databases (`indexedDB.databases()`, defense in depth) → `localStorage`/`sessionStorage` clear → reload. PWA trace clearing never throws: each step settles independently and failures only `console.warn`, so they never block the IndexedDB wipe. `SettingsScreen` catches a wipe failure and shows an error toast instead of dying silently.
- **Caveats**: after SW + cache removal the next load needs network (offline reload fails). While the `nsDataDeletionComplete` flag is set, the app deliberately skips SW re-registration (`registerServiceWorker` in `src/features/wipe/api.ts`) and bootstrap (`App`), so the completion screen leaves no worker, cache, or recreated database behind; the worker and precache return when the user re-enters via the completion screen's Return button or visits the origin again in a new session. Not removable from JS: the installed PWA icon/install state (manual uninstall only), browser history, permission-prompt history, `HttpOnly` cookies, and the Google-side consent-screen history. Backups already uploaded to Google Drive remain on Google's servers (deleting them is out of scope; the confirm dialog states this).

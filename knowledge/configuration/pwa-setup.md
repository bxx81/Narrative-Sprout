---
type: Configuration
title: PWA Setup (v2)
description: Progressive Web App manifest, service worker, caching, and offline behavior of Narrative Sprout v2.
tags: [pwa, service-worker, offline]
timestamp: 2026-09-02T00:00:00Z
source: vite.config.ts, src/main.tsx, index.html
---

# Overview

Installable standalone PWA with offline UI, via `vite-plugin-pwa` (`registerType: "autoUpdate"`). `main.tsx` calls `registerSW({ immediate: true })` (`virtual:pwa-register`, typed via `vite-env.d.ts`).

# Manifest & Icons

`vite.config.ts` manifest: name `Narrative Sprout`, `display: standalone`, theme/background `#1a1a2e`, icons `icons/android-chrome-192x192.png` + `icons/android-chrome-512x512.png` (both real files under `public/icons/`, alongside favicons and the Apple touch icon). `index.html` also loads `/s/icons.css` (Material icons) and `/s/en.css` globally.

# Caching

- **Precache** (`globPatterns: **/*.{js,css,html,json,svg,ico}`): app chunks, styles, HTML, and the **bundled locale JSON** — so the UI works offline. Versioned vendor chunks (`react`/`zod`/`i18next`) keep per-release precache diffs small.
- **Runtime `CacheFirst`** (`static-assets`, 300 entries / 30 days): `/(images|s)/…(webp|woff2?|ttf|otf)` — heavy title backgrounds and font files. `webp` is deliberately excluded from precache (initial install would be huge).
- LLM/image/Drive API calls are never cached (network-only).

# Offline & Wipe

Loaded games remain viewable offline (IndexedDB); new generations need API access. Data wipe (`wipeRepository` + storage clearing + reload) returns to factory state and lands on `/deletion_complete` (flagged via `sessionStorage`).

---
type: Reference
title: Asset Inventory (v2)
description: Bundled images, fonts, icons, sounds, and locales shipped with Narrative Sprout v2.
tags: [assets, images, fonts, sounds, locales]
timestamp: 2026-09-15T00:00:00Z
source: public/, src/features/i18n/locales/
---

# Overview

All static files live in Vite-standard `public/` (served at root). Heavy media stays out of the PWA precache (runtime `CacheFirst` instead); the small UI sound effects are precached.

# Images

| Path | Contents |
|------|----------|
| `public/images/1_1/`, `16_9/`, `9_16/` | Title-screen background art per aspect ratio (WebP). |
| `public/images/error.webp` | Error fallback illustration. |
| (IndexedDB `assets`) | Per-node scene illustrations (WebP, 1:1 by node id) — user data, not bundled. |

# Icons

`public/icons/`: `android-chrome-192x192.png` + `android-chrome-512x512.png` (PWA manifest), `apple-touch-icon-180x180.png`, `favicon-16x16.png` / `favicon-32x32.png` / `favicon.ico`.

# Sounds

`public/sounds/`: `done.ogg`, `notification.ogg`, `error.ogg` (~20–28 KB each) — UI chimes for generation completion, toasts, and the error dialog (see [Sound Effects](/features/sound-effects.md)). Pixabay sources, attributed in the build-generated `public/legal/license.html` (gitignored build artifact). Included in the PWA precache (`ogg` in `globPatterns`).

# Fonts & Styles

`public/s/`: per-language stylesheets (`en/ja/zh/zh-tw/zh-hk/ko/ar/he/hi/lo/th.css`, `icons.css` for Material icons) + self-hosted WOFF2 families (Inter, Cormorant Garamond, Molle, BIZ UD Gothic/Mincho, Noto Sans/Serif variants incl. SC/TC/HK/KR/Hebrew/Devanagari/Lao/Thai, Kufi/Naskh Arabic) + `OFL.txt`. `index.html` loads `icons.css` + `en.css` globally; the rest load per language (see [Localization](/configuration/localization.md)). `icons.css` points at `font.woff2`, a Material Symbols Rounded subset (opsz 24, weight 300) generated from the `IconName` union by `bun run update:icons` — see [Development Setup](/operations/development.md).

# Locales

`src/features/i18n/locales/`: `en.json` (19.4 KB, source of truth), `ja.json` (24.6 KB), `ko.json` (22.5 KB), `zh.json` (19.1 KB), `zh-tw.json` (19.1 KB) — 280 keys each, bundled into the JS precache for offline UI.

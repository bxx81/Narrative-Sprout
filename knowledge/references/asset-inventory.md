---
type: Reference
title: Asset Inventory (v2)
description: Bundled images, fonts, icons, and locales shipped with Narrative Sprout v2.
tags: [assets, images, fonts, locales]
timestamp: 2026-09-02T00:00:00Z
source: public/, src/features/i18n/locales/
---

# Overview

All static files live in Vite-standard `public/` (served at root). Heavy media stays out of the PWA precache (runtime `CacheFirst` instead).

# Images

| Path | Contents |
|------|----------|
| `public/images/1_1/`, `16_9/`, `9_16/` | Title-screen background art per aspect ratio (WebP). |
| `public/images/error.webp` | Error fallback illustration. |
| (IndexedDB `assets`) | Per-node scene illustrations (WebP, 1:1 by node id) — user data, not bundled. |

# Icons

`public/icons/`: `android-chrome-192x192.png` + `android-chrome-512x512.png` (PWA manifest), `apple-touch-icon-180x180.png`, `favicon-16x16.png` / `favicon-32x32.png` / `favicon.ico`.

# Fonts & Styles

`public/s/`: per-language stylesheets (`en/ja/zh/zh-tw/zh-hk/ko/ar/he/hi/lo/th.css`, `icons.css` for Material icons) + self-hosted WOFF2 families (Inter, Cormorant Garamond, Molle, BIZ UD Gothic/Mincho, Noto Sans/Serif variants incl. SC/TC/HK/KR/Hebrew/Devanagari/Lao/Thai, Kufi/Naskh Arabic) + `OFL.txt`. `index.html` loads `icons.css` + `en.css` globally; the rest load per language (see [Localization](/configuration/localization.md)).

# Locales

`src/features/i18n/locales/`: `en.json` (23.7 KB, source of truth), `ja.json` (30.1 KB), `ko.json` (27.7 KB), `zh.json` (23.2 KB), `zh-tw.json` (23.3 KB) — 327 keys each, bundled into the JS precache for offline UI.

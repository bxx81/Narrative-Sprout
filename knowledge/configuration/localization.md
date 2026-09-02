---
type: Configuration
title: Localization (v2)
description: Built-in UI languages, AI dynamic translation, and per-language fonts in Narrative Sprout v2.
tags: [i18n, translation, fonts]
timestamp: 2026-09-02T00:00:00Z
source: src/features/i18n/config.ts, index.ts, translateService.ts, englishUiTexts.ts, locales/
---

# Overview

UI language (`settings.uiLanguage`, stored as the **native display name**) is independent from narrative language (`settings.language`, injected into story prompts).

# Built-in Languages

Five languages bundled at build time (`src/features/i18n/locales/*.json`, 327 keys each) and precached for offline use — no http-backend, unlike legacy:

| Display name | Code | File |
|--------------|------|------|
| English | `en` | `en.json` (source of `englishUiTexts`) |
| 日本語 | `ja` | `ja.json` |
| 汉语 | `zh` | `zh.json` |
| 한국어 | `ko` | `ko.json` |
| 臺灣華語 | `zh-tw` | `zh-tw.json` |

`getInitialUiLanguage` detects from `navigator.languages` (Traditional Chinese variants `zh-tw/zh-hant/zh-hk` checked **before** bare `zh` — a legacy ordering bug fix). `applyLanguageDocumentEffects` sets `html lang` + `dir` (RTL via `isRightToLeftLanguage`) + loads the per-language font CSS. An `App.tsx` effect applies `addResourceBundle` (overlap+deep) → `changeLanguage` on settings change.

# AI Dynamic Translation

`translateService.ts`: any user-typed language (e.g. Español) is translated from the English texts in 30-key sequential chunks (500 ms politeness delay, 0..1 progress). `getTranslateLanguageCode` resolves the IETF tag (built-in check → 30-language table → LLM call with validation, falling back to the raw name). Results persist in `settings.aiTranslations` (name → bundle) / `aiLanguageMappings` (name → tag), element-wise validated. The selector groups built-ins separately from `(AI)` languages; deleting the active AI language falls back to English. Translation failure toasts (`aiTranslationError`). RTL languages are supported at document level; narrative prose follows the game language, not the UI language.

# Fonts

Self-hosted WOFF2 under `public/s/` with per-language stylesheets (`ja.css`, `zh.css`, `zh-tw.css`, `zh-hk.css`, `ko.css`, `ar.css`, `he.css`, `hi.css`, `lo.css`, `th.css`, `en.css`, `icons.css`), loaded on demand by `loadFontForLanguage` (English + icons load globally from `index.html`). Families include Inter, Cormorant Garamond, Molle, BIZ UD Gothic/Mincho, Noto Sans/Serif variants, Kufi/Naskh Arabic.

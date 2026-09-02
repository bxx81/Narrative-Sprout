---
type: Feature
title: Theme Generation (Generate Idea)
description: AI-generated theme ideas for the theme setup screen in v2.
tags: [theme, idea-generation]
timestamp: 2026-09-02T00:00:00Z
source: src/features/theme/generateThemes.ts, themeGeneratorData.ts, src/store/gameStore.ts
---

# Overview

The ThemeSetup screen offers a Generate Idea button (psychiatry icon) that fills the theme textarea with AI-written ideas instead of requiring the player to invent one from scratch.

# Generation

`generateThemes({ apiKey, textModel, language })`: draws 5 random keyword sets from `WORLDVIEWS` (37) / `GENRES` (12) / `TONES` (19, all Japanese) in `themeGeneratorData.ts`, then makes **one** LLM call for `{ themes: [{ title, description }] }` (`json_schema` strict, or `json_object` + embedded schema when `--strict=false`). Model/options/timeout use the same text-model parsing as narration. Results map to `"Title: description"` strings; entries whose title/description are empty after trim are filtered out. A structurally invalid response (missing fields) fails the whole Zod parse and rejects the call. Failures reject with an `Error` the caller toasts (`generateThemeFailed`).

# Stock & Cycling

The store keeps `generatedThemes: string[]` + `themeGeneration: AsyncOperation`. `cycleTheme()`: pops one idea from stock with no API call when available; when empty, generates 5, returns the first, and stocks the remaining 4. The button shows the remaining count `(N)` and a busy state while generating.

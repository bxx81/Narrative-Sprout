---
type: Feature
title: Settings System
description: All user-configurable settings and developer options in Narrative Sprout v2.
tags: [settings, configuration]
timestamp: 2026-09-02T00:00:00Z
source: src/types/settings.ts, src/screens/SettingsScreen.tsx, src/store/gameStore.ts
---

# Overview

Settings are a global singleton (`settings` table, `key: "app"`); the store's `updateSettings(partial)` is the only write path. Generation settings are global-only — saves hold none of them — except the `sceneTextLength` and `language` snapshots (see [Narrative Generation](narrative-generation.md)). Secrets live in `credentials`, never in settings (see [LLM Service](/services/llm-service.md)).

# Narrative Language (Per-Save Snapshot)

There is no story-language selector: at game start (`startNewGame`) the current display language (`settings.uiLanguage`) is snapshotted as that save's narrative language (`GameRecord.language`, persisted by `turnService.startGame`). `resolveNarrativeLanguage(game, settings)` (`src/store/gameStore.ts`) returns `game?.language ?? settings.uiLanguage` and feeds every generation call (`choose` / `refine` / `redoScene` / autoplay / theme ideas). Consequences:

- Later turns of a save keep the start-time language even if the display language changes (verified: English-started and Japanese-started saves each keep their prompts).
- Root redo (new save from the same story) carries over the source save's language.
- Saves created before the snapshot field existed (no `language`) fall back to the current display language.
- The legacy global `settings.language` (default `"Japanese"`) is kept for record compatibility but is never written by the UI and is not consulted for generation.

# Settings Reference

| Key | Default | Description |
|-----|---------|-------------|
| `language` | `"Japanese"` | Legacy global narrative language. Kept for record compatibility; generation ignores it and uses the per-save snapshot instead (see above). |
| `uiLanguage` | browser-detected | UI display language (native name, e.g. `"English"`). See [Localization](/configuration/localization.md). |
| `sceneTextLength` | `"medium"` | Target prose length for **new** saves (`short/medium/detailed/long/verbose/novel/novel2`). |
| `textModel` | `"openai/gpt-4o-mini"` | Narrator model id + `--options`. See [Narrative Generation](narrative-generation.md). |
| `imageGenerator` | `"disabled"` | `disabled/huggingface/a1111/comfyui/nvidia_nim`. See [Image Generation](image-generation.md). |
| `a1111Endpoint` / `a1111Config` | `http://127.0.0.1:7860` + defaults | A1111 endpoint + generation parameters JSON. |
| `comfyuiEndpoint` / `comfyuiWorkflow` | `http://127.0.0.1:8188` + defaults | ComfyUI endpoint + workflow JSON. |
| `huggingFaceSpaceId` / `huggingFaceConfig` | `mrfakename/Z-Image-Turbo` + defaults | HF Space id + config JSON. |
| `nimEndpoint` / `nimConfig` | Flux URL + defaults | NVIDIA NIM endpoint + config JSON. |
| `webpCompression` | `"normal"` | WebP quality (`normal` 0.9 / `high` 1.0). |
| `memoryStrategy` | `"single"` | `auto/single/split`; start screen offers per-run choice. |
| `enableStoryLogCompaction` | `true` | Archivist compaction of old `storyLog`. |
| `enableStreaming` | `true` | Live text streaming (ANDed with per-model `--stream`). See [Streaming](streaming.md). |
| `autoRetrySeconds` | `0` | 429 auto-retry countdown seconds (`0` = manual only). See [Error Handling](/services/error-service.md). |
| `showElapsedTime` | `false` | Elapsed-seconds display in the loading overlay. |
| `aiTranslations` / `aiLanguageMappings` | `{}` | AI-translated UI bundles + IETF tag table. See [Localization](/configuration/localization.md). |

Settings validate with `z.infer`-derived schemas; AI-translation tables validate element-wise (corrupt languages/values skipped with warnings). A malformed settings row falls back to defaults with a warning instead of crashing startup.

# Developer Options

`Settings > Developer Options` (bottom section): WebP compression selector, elapsed-time toggle, 429 auto-retry selector, and the debug-log toggle. Visibility beyond the debug toggle requires debug mode. Debug mode (`src/lib/debugLog.ts`) resolves once at module load: `?debug=true/false` query (persisted) → `nsDebug` localStorage flag (`"1"` on / `"0"` explicit off, which beats dev-server default) → `import.meta.env.DEV`. `setDebugMode` persists; applying needs a reload. The `debug` logger no-ops unless enabled; LLM call/turn entry points log through it.

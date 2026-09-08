---
type: Feature
title: Settings System
description: All user-configurable settings and developer options in Narrative Sprout v2.
tags: [settings, configuration]
timestamp: 2026-09-08T00:00:00Z
source: src/types/settings.ts, src/screens/SettingsScreen.tsx, src/store/gameStore.ts, src/components/settings/EndpointConnectionTest.tsx, src/features/connectivity/
---

# Overview

Settings are a global singleton (`settings` table, `key: "app"`); the store's `updateSettings(partial)` is the only write path. Generation settings are global-only — saves hold none of them — except the `sceneTextLength` snapshot (see [Narrative Generation](narrative-generation.md)). Secrets live in `credentials`, never in settings (see [LLM Service](/services/llm-service.md)).

# Narrative Language Sync

`language` (injected into story prompts) always mirrors the display language (`uiLanguage`, native name — identity, no mapping table). Every display-language write path carries both values: the Settings selector (via `setUiLanguage`), `translateUi` (new AI language becomes the narrative language too), and `deleteAiTranslation` (falling back to English when the active AI language is deleted). On first run (no stored settings row), `settingsRepository.get()` seeds `language` from the detected display language (`getInitialUiLanguage`) instead of the `"Japanese"` default.

# Settings Reference

| Key | Default | Description |
|-----|---------|-------------|
| `language` | `"Japanese"` (fresh installs: detected display language) | Narrative language injected into prompts. Always mirrors `uiLanguage` (see above). |
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

# Connectivity Test

Every configurable endpoint carries an inline `EndpointConnectionTest` (`src/components/settings/EndpointConnectionTest.tsx`): the Text model section (probes `GET {baseUrl}/models` with the stored API key as Bearer) and the A1111 (`GET /`), ComfyUI (`GET /system_stats`), and NIM (bare generation URL + token) image panels. Hugging Face needs none (fixed Space URL). The probe (`testEndpointConnectivity` in `src/features/connectivity/`, 15 s timeout, `fetchImpl` injectable) reports `ok / http-error / cors-likely / unreachable / timeout / mixed-content / invalid-url`. Browsers hide CORS reasons from script, so CORS is a likelihood via a `no-cors` control request — `TypeError` + succeeding control ⇒ `cors-likely`, both failing ⇒ `unreachable` — never a verdict; https→http short-circuits as `mixed-content`. The key is header-only and never enters results, logs, or exports. Local `AsyncOperation` state only — no store slice, no `persist`.

# Developer Options

`Settings > Developer Options` (bottom section): WebP compression selector, elapsed-time toggle, 429 auto-retry selector, and the debug-log toggle. Visibility beyond the debug toggle requires debug mode. Debug mode (`src/lib/debugLog.ts`) resolves once at module load: `?debug=true/false` query (persisted) → `nsDebug` localStorage flag (`"1"` on / `"0"` explicit off, which beats dev-server default) → `import.meta.env.DEV`. `setDebugMode` persists; applying needs a reload. The `debug` logger no-ops unless enabled; LLM call/turn entry points log through it.

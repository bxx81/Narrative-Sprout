---
type: Feature
title: Streaming Generation Display
description: SSE streaming delivery of narration with a dedicated display store, per-model opt-out, and bulk fallback in v2.
tags: [streaming, sse, llm]
timestamp: 2026-09-04T00:00:00Z
source: src/lib/openAiClient.ts, src/store/streamStore.ts, src/lib/modelOptions.ts, src/features/narrative/generateScene.ts, src/screens/GameScreen.tsx, src/screens/StartingScreen.tsx
---

# Overview

Narration calls can stream Server-Sent Events so the scene text appears live while the model is still generating. Delivery (transport) and display (rendering) are separate concerns: the client accumulates deltas, the store extracts partial `sceneText`, and the screens render it.

# Transport

`OpenAiCompatibleClient.createStreamingChatCompletion` sends `stream: true` with `stream_options: { include_usage: true }` and parses SSE by hand (CRLF normalization, `data:` extraction, `[DONE]`, mid-stream `error`, reasoning separation). Behavior:

- **Idle watchdog**: 60 s max silence between chunks once content started flowing (separate from the `--timeout` request timeout, default 600 s).
- **Stream rejection fallback**: `ApiError(400/404/415/422)` means the endpoint rejects streaming itself → exactly one retry in bulk mode. 429/5xx are never treated as stream rejection.
- **Final assembly**: the streamed chunks are assembled into a normal-shaped response so downstream JSON parsing/validation is shared with bulk.
- `onDelta` receives the **accumulated** text on each chunk.

`callChatCompletion` (`generateScene.ts`) streams only when the caller passes `onDelta` **and** the model allows it; otherwise the request is bulk (no `stream` field at all).

# Enablement

Effective streaming = global setting AND per-model option:

- Global: `settings.enableStreaming` (default `true`).
- Per-model: `--stream=false` in the text-model string (`TextModelOptions.stream`).
- Helper: `isStreamingEnabledForSettings(settings)` parses the model string and ANDs both flags.

The store computes this per generation flow (start/choose/refine/redo/rootRedo) and passes `onSceneTextDelta` (→ `streamStore.pushDelta`) only when enabled. The `enableStreaming` switch therefore affects the API call, not just the display.

# Display Store

`src/store/streamStore.ts` is a `useSyncExternalStore` display-only store that deliberately bypasses `gameStore` (deltas arrive many times per second):

- `begin(streamingEnabled)`: `"streaming"` shows live text; `"generating"` shows the spinner only.
- `pushDelta(accumulatedText)` → 100 ms trailing-flush batch → `scanSceneText` extracts the LAST `"sceneText"` value with an escape-aware scanner (`complete` = closing quote seen).
- `end()` / `cancel()` return to idle; `getSignal()` supplies the `AbortSignal` so Stop cancels generation.
- Final data always renders through the regular success path, never from the stream store.

`GameScreen` suppresses `LoadingOverlay` while streaming incomplete text (rendering it in `MainText` with a cursor + pulsing choice skeletons) and restores the spinner once `sceneTextComplete` flips (remaining JSON keys still generating) or when the image stage starts (`generationStage === "image"`). While the stream store is active (`stream.status !== "idle"`) both `GameScreen` and `StartingScreen` show the legacy-style fixed Stop-generating button (`intent="navigator"` circle at bottom-right, `cancelGeneration` → `streamStore.cancel()`). Reasoning output is never shown live.

`StartingScreen` also renders a word-count pseudo progress bar while `stream.status === "streaming"`: `min(0.9, wordCount / minWordsTarget(sceneTextLength))` (no numeric label). Tail behavior — with a progress-reporting image generator (A1111/ComfyUI) the bar continues as `0.9 + 0.1 × imageGenerationProgress` (monotonic; the word-based cap is 90%); with no image generator configured it jumps to 100% at `sceneTextComplete`; generators without progress reporting hold at 90%. The label message follows `generationStage` (`loadingWeavingScene` → `loadingPaintingScene`).

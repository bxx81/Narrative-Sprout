# Knowledge Bundle Update Log

## 2026-09-02
* **Creation**: Initial OKF v0.1 knowledge bundle for Narrative Sprout v2 (clean rebuild, Phase 0–6.9.5 complete).
* **Creation**: 39 concept documents covering overview, features, services, data model, integrations, configuration, operations, and references.
* **Note**: The Tauri desktop build (Phase 7) has not started in v2; there is intentionally no Tauri concept document yet. Legacy Tauri docs live only in the archived legacy repository.

## 2026-09-03
* **Correction**: Verified all 39 concept docs against the codebase. Fixes applied:
  * `features/conditional-text.md` — theme is embedded verbatim in the system prompt, never conditionally resolved.
  * `features/narrative-generation.md` — `memoryStrategy` default is `single` (not `auto`); `memoryReminder` parameter is currently unused.
  * `integrations/ai-providers.md` — `--reasoning` sends `effort: "true"`/`"false"` verbatim (no medium/none translation); `only` maps to `provider: { only: [value] }`.
  * `features/streaming.md` / `features/game-loop.md` — StartingScreen shows a spinner + static label only (no streaming/word-count display; elapsed time gated behind `showElapsedTime`); attachment resolution happens in `startNewGame`, not `startGame`; past-turn history collected newest-first but replayed oldest-first.
  * `features/image-generation.md` — ComfyUI progress arrives via WebSocket, not polling; Disabled backend skips generation (transparent placeholder is UI-layer).
  * `features/scene-correction.md` — refine prompt uses the real `[Refine request]` format (wire-shape scene JSON); root-refine path added.
  * `references/key-dependencies.md` — @vitejs/plugin-react is 5.x (was conflated with Vite 7.x).
  * `features/theme-generation.md` — structurally invalid entries fail the whole parse (only empty-after-trim entries are filtered).
  * `features/story-export.md` — export is History-screen only; import filters described accurately (no parentless-node check).
  * `operations/data-migration.md` — element-wise skipping happens in `importSave.ts`, not `restoreRepository`.
  * `services/llm-service.md` — mid-stream errors throw `ApiError(500)` after stream end (not legacy `checkError`); added `reasoningEffort`.
  * `services/error-service.md` — noted the always-present "Start Over" button.
  * `data-model/state-management.md` — services receive state as parameters; `cancelGeneration` aborts via `streamStore.cancel()`.
  * `services/storage-service.md` — added `putAsset` / `getNode` to `gameRepository` capabilities.
  * `overview/architecture.md` — clarified that `*Service.ts` filenames inside features are internals, not a service layer.

## 2026-09-04
* **Addition**: Legacy-style Stop-generating button (fixed `navigator` circle, `cancelGeneration` → `streamStore.cancel()`) on both `GameScreen` and `StartingScreen`.
* **Addition**: `StartingScreen` streaming UI ported from legacy: word-count pseudo progress bar (capped 90%; A1111/ComfyUI continue as `0.9 + 0.1 × imageGenerationProgress`, no-image-generator setups reach 100% at `sceneTextComplete`, progress-less generators hold at 90%) and a pipeline-following loading message (`generationStage` → `loadingWeavingScene`/`loadingPaintingScene`).
* **Addition**: `minWordsTarget` / `MIN_WORDS` in `promptBuilder.ts` (exposed via `features/narrative/api.ts`) — numeric lower word bounds per `sceneTextLength`; backs the pseudo progress bar. Unit tests added.
* **Correction**: `features/streaming.md` and `features/game-loop.md` no longer describe `StartingScreen` as spinner + static label; `features/narrative-generation.md` documents the min-word bounds.

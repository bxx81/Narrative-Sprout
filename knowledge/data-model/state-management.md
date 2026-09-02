---
type: Architecture
title: State Management (v2)
description: Zustand store discipline, AsyncOperation pattern, streaming display store, and turn orchestration in v2.
tags: [zustand, state, async-operation]
timestamp: 2026-09-02T00:00:00Z
source: src/store/gameStore.ts, asyncOperation.ts, streamStore.ts, src/features/gameplay/turnService.ts
---

# Zustand Store

`useGameStore` (`src/store/gameStore.ts`) is a single store with `devtools` + `subscribeWithSelector` only — **no `persist` middleware** (persistence is IndexedDB only, never a second middleware path). Components subscribe via selectors so unrelated changes don't re-render them.

Discipline (AGENTS.md rule 5):

- Components and features **never call `set` directly**. All state changes go through action functions defined in the store: `bootstrap`, `saveApiKey` / `saveCredential`, `updateSettings`, `goToTitle`, `startNewGame`, `openGame`, `choose`, `refine`, `redoScene`, `regenerateImage`, `deleteBranch` (→ `{ gameDeleted }`), `deleteSave`, `exportSave`, `wipeAllData`, `setViewingNode`, `updateSceneText`, `cycleTheme`, `resumeStoryAtNode`, `setChronicleTargetNode`, `toggleAutoplay` / `runAutoplayTurn` / `dismissAutoplayEndingComment`, `cancelGeneration`, `retryGeneration` / `dismissError`, `setUiLanguage` / `translateUi` / `deleteAiTranslation`, `downloadEncryptedBackup` / `restoreBackupFromFile` / `importSaveFromFile`, Drive actions (`connect/disconnect/upload/refresh/restore/delete`).
- Services do not read the store themselves; store actions pass state into service functions as parameters (no prop-drilling into components either).

# AsyncOperation

`src/store/asyncOperation.ts`:

```typescript
type AsyncOperation<TPayload, TResult> =
  | { phase: "idle" }
  | { phase: "running"; payload: TPayload; startedAt: string }
  | { phase: "failed"; payload: TPayload; error: Error }
  | { phase: "done"; result: TResult };
```

Replaces legacy `_PENDING/_SUCCESS` + `lastActionForRetry`. The `failed` payload is the retry contract: `generation` payloads are `start` / `choice` / `refine` / `redo` / `rootRedo` (+ image-regeneration payload). No ad-hoc pending flags. `startedAt` also feeds the elapsed-time display.

# Turn Orchestration

Actions set `generation: running`, compute streaming enablement, `streamStore.begin(...)`, resolve attachments/settings, then delegate to `turnService` (`startGame` / `choosePath` / `refineScene` + `TurnServiceOptions` stage callbacks), persist transactionally, and update `nodes` / `assets` / `activeGame`. `cancelGeneration` aborts via `streamStore.cancel()` (the request signal is the one from `streamStore.getSignal()`); failures record `failed` for the dialog; `retryGeneration` re-dispatches by payload kind. Refine/redo/rootRedo reuse the same wiring (streaming/cancel/retry/stage).

# Streaming Display Store

`streamStore` (`src/store/streamStore.ts`) is a separate `useSyncExternalStore` module (not part of `gameStore`) so high-frequency deltas don't churn the app store. Details: see [Streaming](/features/streaming.md). Status `idle` / `streaming` / `generating`; `scanSceneText` extracts partial prose; 100 ms trailing flush; `end()` returns to idle so finals always render through the success path.

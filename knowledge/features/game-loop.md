---
type: Feature
title: Game Loop
description: Core game lifecycle — theme setup, generation, choices, persistence, and navigation in Narrative Sprout v2.
tags: [game-loop, gameplay, zustand]
timestamp: 2026-09-09T00:00:00Z
source: src/features/gameplay/turnService.ts, src/store/gameStore.ts, src/screens/GameScreen.tsx, src/components/game/GameChoices.tsx, src/screens/ChronicleScreen.tsx, src/lib/gameTextSize.ts, src/app/routes.ts, src/app/App.tsx
---

# Overview

The core loop is: theme input → opening generation → 3 choices → next-turn generation → persistence → resume. Routes replace the legacy screen-state enum: `/` (Title), `/setup` (ThemeSetup), `/setup/starting` (Starting), `/play` (Game), `/load`, `/history`, `/chronicle`, `/settings`, `/deletion_complete`. `/play`, `/history`, and `/chronicle` are guarded by `RequireActiveGame` (redirects to `/` without an active game).

# Turn Flow

- **ThemeSetup** (`ThemeSetupScreen.tsx`): free-text theme, `{a|b}` random placeholders, attachment files, scene length, memory strategy, and Generate Idea (see [Theme Generation](theme-generation.md)). Starting calls `startNewGame(theme, attachmentFiles)`.
- **Starting** (`StartingScreen.tsx`): shows a `LoadingSpinner` + a label that follows the pipeline (`generationStage`: `loadingWeavingScene` during text, `loadingPaintingScene` on the image stage; the label re-fades on change); a word-count pseudo progress bar and the fixed Stop-generating button appear while the stream store is active (see [Streaming](streaming.md)); elapsed time appears only with `settings.showElapsedTime` (default off). On success navigates to `/play`. Failures surface in the global `ErrorDialog` (see [Error Handling](/services/error-service.md)).
- **startNewGame → startGame** (`turnService.ts`): `gameStore.startNewGame` first resolves attachment texts/theme via `processAttachmentFiles`; `startGame` receives ready `attachmentTexts`, builds the opening prompt, runs the narration call (single or split), optionally compacts memory, generates the scene image, then persists `GameRecord` + root `StoryNodeRecord` (+ optional asset) in one Dexie transaction. The save snapshots `sceneTextLength` at creation.
- **Playing** (`GameScreen.tsx`): choice buttons or free-text input → `choose(choiceText)` → `choosePath` (context: per-save scene length, up to 5 past turns — collected newest-first, replayed oldest-first — memory prefix, attachment texts; final user message carries the turn anchor `This is turn N of the story.` plus the length closing with the previous output's word count) → scene → image → appended node + game update in one transaction. `currentNodeId` (playhead) and `viewingNodeId` (display position) diverge when rewinding; Forward returns toward the playhead.
- **Long-press copy** (`GameChoices.tsx`, `GameScreen.tsx`): holding a choice button for `LongPressMs` (1000 ms; the choice echo also uses 500 ms on touch) copies that text into the custom-choice input and announces it with the `toastChoiceCopied` success toast — a plain click still submits, and the echo path goes through `choicePreset` + `onChoicePresetConsumed` (so a stale signal cannot refill the input on remount). The gesture is a Pointer Events state machine: `pointerdown` arms the timer and clears the click-suppression latch, a wander past `LongPressMoveSlopPx` (10 px) or `pointerup`/`pointercancel`/`pointerleave` cancels it, and when the timer fires it sets the latch so the trailing (touch: browser-synthesized) `click` is swallowed exactly once in `onClick`. Because every `pointerdown` re-arms the latch, a long press that ends without a `click` reaching the button — mouse released off the button, finger drifting before lift-off (the browser then drops the synthesized click entirely) — can never eat a later ordinary click. Regression-tested by `e2e/longpress.spec.ts`; the known edge is that keyboard Enter right after a long press loses one submission.
- **GameOver**: `isStoryOver: true` renders `storyClosingText`; autoplay stops with a retrospective comment dialog.
- **Text size**: `settings.gameTextSize` (`small/medium/large/xlarge`, default `medium`) scales scene text (incl. `storyClosingText`), choice buttons, and the choice echo together (`GAME_TEXT_SIZE_CLASSES`, shared in `src/lib/gameTextSize.ts`; echo is one step smaller). The Chronicle screen reuses the same map for scene text and the choice quote. See [Settings System](settings-system.md#game-text-size).

# Branching & Navigation

The story is a tree (`StoryNodeRecord.parentNodeId`, root has `null`). See [History & Saves](history-and-saves.md) for rewind, branch deletion, redo, chronicle, and history views, and [Scene Correction](scene-correction.md) for refine/redo/manual editing.

# Generation Stages

`turnService` reports `onTextGenerationStart` / `onImageGenerationStart` / `onImageGenerationProgress` to the store's `generationStage` (`choice` → `scene` → `image`), so `LoadingOverlay` follows the pipeline instead of showing a static label. Image progress (0..1) is wired for A1111/ComfyUI; `onImageGenerationFailed` reports an image failure that leaves the turn successful but asset-less to `notifyImageGenerationFailure` (toast; user Stop excluded) — see [Image Generation](image-generation.md#failure-handling). When `generation.phase` settles `running → idle`, a completion chime plays (see [Sound Effects](sound-effects.md)).

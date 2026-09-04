---
type: Feature
title: Game Loop
description: Core game lifecycle — theme setup, generation, choices, persistence, and navigation in Narrative Sprout v2.
tags: [game-loop, gameplay, zustand]
timestamp: 2026-09-02T00:00:00Z
source: src/features/gameplay/turnService.ts, src/store/gameStore.ts, src/app/routes.ts, src/app/App.tsx
---

# Overview

The core loop is: theme input → opening generation → 3 choices → next-turn generation → persistence → resume. Routes replace the legacy screen-state enum: `/` (Title), `/setup` (ThemeSetup), `/setup/starting` (Starting), `/play` (Game), `/load`, `/history`, `/chronicle`, `/settings`, `/deletion_complete`. `/play`, `/history`, and `/chronicle` are guarded by `RequireActiveGame` (redirects to `/` without an active game).

# Turn Flow

- **ThemeSetup** (`ThemeSetupScreen.tsx`): free-text theme, `{a|b}` random placeholders, attachment files, scene length, memory strategy, and Generate Idea (see [Theme Generation](theme-generation.md)). Starting calls `startNewGame(theme, attachmentFiles)`.
- **Starting** (`StartingScreen.tsx`): shows a `LoadingSpinner` + static label only (no streaming text); elapsed time appears only with `settings.showElapsedTime` (default off). On success navigates to `/play`. Failures surface in the global `ErrorDialog` (see [Error Handling](/services/error-service.md)).
- **startNewGame → startGame** (`turnService.ts`): `gameStore.startNewGame` first resolves attachment texts/theme via `processAttachmentFiles`; `startGame` receives ready `attachmentTexts`, builds the opening prompt, runs the narration call (single or split), optionally compacts memory, generates the scene image, then persists `GameRecord` + root `StoryNodeRecord` (+ optional asset) in one Dexie transaction. The save snapshots `sceneTextLength` at creation.
- **Playing** (`GameScreen.tsx`): choice buttons or free-text input → `choose(choiceText)` → `choosePath` (context: per-save scene length, up to 5 past turns — collected newest-first, replayed oldest-first — memory prefix, attachment texts) → scene → image → appended node + game update in one transaction. `currentNodeId` (playhead) and `viewingNodeId` (display position) diverge when rewinding; Forward returns toward the playhead.
- **GameOver**: `isStoryOver: true` renders `storyClosingText`; autoplay stops with a retrospective comment dialog.

# Branching & Navigation

The story is a tree (`StoryNodeRecord.parentNodeId`, root has `null`). See [History & Saves](history-and-saves.md) for rewind, branch deletion, redo, chronicle, and history views, and [Scene Correction](scene-correction.md) for refine/redo/manual editing.

# Generation Stages

`turnService` reports `onTextGenerationStart` / `onImageGenerationStart` / `onImageGenerationProgress` to the store's `generationStage` (`choice` → `scene` → `image`), so `LoadingOverlay` follows the pipeline instead of showing a static label. Image progress (0..1) is wired for A1111/ComfyUI; see [Image Generation](image-generation.md). When `generation.phase` settles `running → idle`, a completion chime plays (see [Sound Effects](sound-effects.md)).

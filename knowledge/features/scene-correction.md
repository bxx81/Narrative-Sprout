---
type: Feature
title: Scene Correction (Refine, Redo, Manual Edit)
description: AI-driven scene refinement, sibling re-roll redo, and in-place manual editing in v2.
tags: [refine, redo, editing]
timestamp: 2026-09-02T00:00:00Z
source: src/features/gameplay/turnService.ts, src/store/gameStore.ts, src/db/gameRepository.ts, src/components/game/RefineDialog.tsx
---

# Overview

Three correction paths, all reachable from the game navigation menu:

# Refine (AI, with instruction)

`refine(nodeId, refinePrompt)`: replays history from the node's **parent** and generates a **sibling** under the same `parentNodeId`. The user instruction is wrapped as a `[Refine request]` user message — `The player chose: "{choiceText}"… Original scene: {wire-shape JSON of the stored scene via sceneToWireResponse} … User instructions: {refinePrompt}` — and passed as the choice text of `buildTurnPrompt`. Memory builds on the parent's monologue; a fresh image is generated. Metadata records `refinePrompt`, `refinedFromNodeId`, and the sibling is navigated to on success. UI: `RefineDialog` textarea. Retryable via the `refine` generation payload.

**Root refine**: for the opening scene, a distinct `[Refine request for the first scene]` instruction replaces the last message of `buildOpeningPrompt`, and the sibling is created as a new turn-1 node **in the same game** (not a new save slot).

# Redo (Regenerate Scene, no instruction)

`redoScene(nodeId, discardHistoryContext)`: same-choice sibling re-roll without an instruction:

- **Non-root**: `choosePath` with the node's own `choiceText` as a new sibling. Keep (`discardHistoryContext: false`) preserves history; Discard (`true`) generates with empty ancestors and persists the flag on the new node — `applyHistoryContextCut` then cuts all future histories at that node (memory prefix is unaffected, legacy parity). UI is a 3-way confirm (Keep / Discard / Cancel via `ConfirmationProvider` `neutralLabel`).
- **Root**: creates a **new save slot** (`startGame` with the same theme + `attachmentTexts`, inheriting the `sceneTextLength` snapshot) and switches to it; the current save is kept. Payload `rootRedo` retries by re-running the same creation.
- Empty `choiceText` on non-root nodes is a no-op. Autoplay blocks manual redo. Retryable via `redo` / `rootRedo` payloads.

# Manual Edit

`updateSceneText(nodeId, sceneText)` (`gameRepository.updateNodeSceneText`): in-place rewrite of `scene.sceneText` (no new node/branch), refreshing `sceneWordCount` via `countWords`. The next turn's history rebuilds from stored scenes (`sceneToWireResponse`), so edits automatically flow into future generations. UI: Edit menu button → textarea (Apply/Cancel). `storyClosingText` and choices are not editable.

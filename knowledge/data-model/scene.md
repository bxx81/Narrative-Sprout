---
type: Data Model
title: Scene Structure (v2)
description: SceneContent, MemoryState, MemoryDelta, and the wire format replayed to the model in v2.
tags: [data-model, scene, memory]
timestamp: 2026-09-02T00:00:00Z
source: src/types/scene.ts, src/features/narrative/sceneSchema.ts, memoryMerge.ts
---

# SceneContent (Display Only)

`src/types/scene.ts` — what the player sees and what image generation uses. Unlike legacy, it contains **no memory**:

| Field | Type | Description |
|-------|------|-------------|
| `reasoning` | string | Model scratchpad/thinking before the scene. |
| `sceneText` | string | Literary prose of the scene. |
| `sceneWordCount` | int ≥ 0 | Word count of `sceneText` (renamed from legacy `wordsSceneText`; CJK-aware counting). |
| `imagePrompt` | string | English visual prompt for this scene's illustration. |
| `negativeImagePrompt` | string | English avoid-prompt. |
| `choices` | `string[]` | Choices offered at the end of the scene. |
| `isStoryOver` | boolean | Story concluded in this scene. |
| `storyClosingText` | string | Closing passage shown on conclusion. |
| `locationContext` | string | Location/lighting context carried across turns. |

# MemoryState (Cumulative) / MemoryDelta (This Turn)

- `MemoryState`: `{ notes: Record<string, string \| null>, storyLog: string[], storyLogSummary?: string }` — accumulated memory up to a turn. `null` notes values are deletions-in-effect; `storyLog` is oldest-first.
- `MemoryDelta`: `{ notes, sceneSummary }` — exactly what this turn's memory call produced; kept for resend/retry and for wire replay.
- `applyMemoryDelta(memory, delta)` (`memoryMerge.ts`) folds a delta into its parent's memory.

# Wire Format (What the Model Sees)

The narrator is asked for `choice1..3` (split fields — arrays proved unreliable across models), nullable `locationContext` / `negativeImagePrompt` / `finalEndingPassage`, top-level `sceneSummary`, and `notes`. Past turns MUST be replayed in this exact shape via `sceneToWireResponse(scene, memoryDelta, { omitMemoryFields? })`: replaying stored shape (`choices` array, `sceneWordCount`, …) teaches non-strict providers to imitate it and breaks the next validation (legacy `stored2work` lesson). Split scene calls pass `omitMemoryFields` so history shows no `notes`/`sceneSummary`. Split/memory/archivist variants: `narratorSceneOnlyResponseSchema` (scene + throwaway `notesDraft`), `memoryUpdateResponseSchema`, `storyLogCompactionResponseSchema`.

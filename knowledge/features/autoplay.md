---
type: Feature
title: Autoplay (Player AI)
description: A player-AI that takes game turns on its own, with its reasoning chain persisted per node in v2.
tags: [autoplay, ai-player]
timestamp: 2026-09-07T00:00:00Z
source: src/features/autoplay/autoplayService.ts, src/store/gameStore.ts, src/screens/GameScreen.tsx
---

# Overview

Autoplay lets a separate "player AI" play the game: it compiles the playthrough into one text log and answers with the next player action. Ported from the legacy `computerPlayerService`, translated to v2 record shapes.

# Decision Flow

1. `buildAutoplayLog` (pure function) walks from the viewed node up to the root and compiles theme + all scenes + choices + persisted reasoning chain into one text log.
2. `decideAutoplayTurn` asks the player AI for the next action (`{ reasoning, choice }`, `json_schema` strict, never streamed). Model/options/timeout come from the same text-model string parsing as narration.
3. The store's `runAutoplayTurn` feeds the decision's `choice` into the normal `choose` flow, passing `autoplayReasoning` and the decision cost.

# Reasoning Persistence

The decision's `reasoning` is stored on the produced node as `metadata.autoplayReasoning` (optional; old nodes parse without it). The next decision rebuilds the reasoning chain from the tree, so it survives save/reload. The decision call's cost is added to that turn's total cost.

# Guards

- A `GameScreen` effect drives autoplay only while `autoplay && generation idle`.
- `choose` accepts an `autoplayReasoning` capability token: in-flight chained turns may re-enter, but manual clicks during autoplay are rejected.
- Turning autoplay off mid-flight discards the in-flight decision.
- Terminal detection (`isStoryOver`) shows the retrospective comment in a dialog and stops.
- Failures clear autoplay. `resume`/`deleteBranch`/`openGame`/`goToTitle` also clear it.
- Autoplay state (`autoplay`, `autoplayTurn: AsyncOperation`) lives in `gameStore`; the ending comment is `autoplayEndingComment` with `dismissAutoplayEndingComment`.

# Stopping (3 Phases)

Autoplay runs in three observable phases, and the Stop-generating button (`cancelGenerationButton`) covers all of them:

1. **Decision** (`autoplayTurn: running`, spinner `Autoplay`) — the player AI picks the next choice.
2. **Text generation** (`generation: running`, stage `choice`/`scene`) — the story model writes the next scene.
3. **Image generation** (`generation: running`, stage `image`) — the scene image renders.

- `GameScreen` shows the fixed Stop button while `(loading && stream.status !== "idle") || isAutoplayDeciding`, so the decision phase (which produces no stream output) is also stoppable.
- The decision request aborts via a store-module `autoplayAbortController` passed as `decideAutoplayTurn`'s `signal` (narrative/image generation aborts via `streamStore.cancel()` instead). `cancelGeneration` aborts both, clears `autoplay` (+ `autoplay` Wake Lock), and returns a running `autoplayTurn` to `idle` immediately for instant spinner feedback; the in-flight decision result is dropped by the `if (!get().autoplay)` guard.
- A decision-phase `AbortError` settles to `autoplayTurn: idle` + `autoplay: false` silently (no dialog watches `autoplayTurn`, unlike `generation` aborts which show the informational `errorAborted` dialog). Genuine decision errors still land in `autoplayTurn: failed` + `autoplay: false`.
- `toggleAutoplay` off aborts the same way; toggling on clears a stale `autoplayTurn: failed` so a fresh run is never blocked.

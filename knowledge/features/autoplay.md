---
type: Feature
title: Autoplay (Player AI)
description: A player-AI that takes game turns on its own, with its reasoning chain persisted per node in v2.
tags: [autoplay, ai-player]
timestamp: 2026-09-02T00:00:00Z
source: src/features/autoplay/autoplayService.ts, src/store/gameStore.ts
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

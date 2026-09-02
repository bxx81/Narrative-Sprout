---
type: Playbook
title: Testing Strategy (v2)
description: Test framework, conventions, and CI for Narrative Sprout v2.
tags: [testing, bun-test, happy-dom]
timestamp: 2026-09-02T00:00:00Z
source: bunfig.toml, src/db/installFakeIndexedDb.ts, src/features/backup/testsupport/records.ts, .github/workflows/ci.yml
---

# Overview

Runner: `bun test` with happy-dom. `bunfig.toml` `[test] preload` loads `src/db/installFakeIndexedDb.ts`, so Dexie tests run against a fake IndexedDB (note: after `db.delete()`, tests must `db.open()` explicitly — Dexie won't auto-reopen inside transactions).

42 test files (~210 tests) colocate with sources (`*.test.ts`, one `.test.tsx` for the navigation hook). CI runs lint → `tsc --noEmit` → `bun test` → prettier check → gitleaks.

# Conventions

- **Pure functions first**: prompt builders, schema cleaning, tree traversal/branch deletion, compaction helpers, conditional text, random choice, scenario parsing, model-options parsing, crypto round-trips, export bundle building — all tested without I/O.
- **Fetch stubbing**: LLM/Drive/network code takes injectable `fetchImpl`-style seams; tests capture request bodies (e.g. streaming on/off asserts the `stream` field; scene-length tests assert the length instruction across all messages).
- **Real-DB tests**: repositories, backup round-trips, restore upserts, and `plaintextLeak.test.ts` run against fake-indexeddb. Shared factories live in `features/backup/testsupport/records.ts` (`makeTestGame/makeTestNode/makeTestAsset/makeTestSettings`, `wipeDatabaseForTest`) — created after a review flagged test duplication.
- **Store tests**: `gameStore.*.test.ts` cover flows (retry payloads, redo/response, stage transitions, streaming flags, theme stock, scene-length snapshot) with stubbed network.
- **Hook/component tests**: `useGameNavigation.test.tsx` renders for real (happy-dom) across resume/playhead/chronicle scenarios.

# Notable Proof Tests

- `plaintextLeak.test.ts` — the backup completion condition: envelope text + base64-decoded bytes contain no story/settings plaintext and no credentials, at both local and Drive boundaries.
- `gameStore.streaming.test.ts` — streaming OFF sends no `stream` field; ON sends `stream: true` (regression for a shipped bug where the toggle only affected display).
- `sceneSchema.test.ts` — narrator schema and prompt-embedded text contain no `propertyNames`/`$schema`.
- `gameStore.sceneLength.test.ts` — per-save snapshot wins over global; old saves fall back.
- `gameStore.stage.test.ts` — stage transitions `choice` → `scene` around the narration call.

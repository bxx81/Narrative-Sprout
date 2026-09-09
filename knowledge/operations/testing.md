---
type: Playbook
title: Testing Strategy (v2)
description: Test framework, conventions, and CI for Narrative Sprout v2.
tags: [testing, bun-test, happy-dom, playwright]
timestamp: 2026-09-09T00:00:00Z
source: bunfig.toml, src/db/installFakeIndexedDb.ts, src/features/backup/testsupport/records.ts, .github/workflows/ci.yml, playwright.config.ts, e2e/
---

# Overview

Unit runner: `bun test` with happy-dom. `bunfig.toml` `[test] preload` loads `src/db/installFakeIndexedDb.ts`, so Dexie tests run against a fake IndexedDB (note: after `db.delete()`, tests must `db.open()` explicitly — Dexie won't auto-reopen inside transactions).

49 unit files (263 tests) colocate with sources (`*.test.ts`, one `.test.tsx` for the navigation hook). `bun test` excludes `e2e/**` via `--path-ignore-patterns` (quoted in `package.json`, otherwise the shell glob-expands it) — bun's runner picks up `*.spec.ts`, which would collide with Playwright specs.

E2E runner: Playwright (`bun run test:e2e`), 5 spec files × 2 browser projects (chromium + webkit) = 30 tests. CI has three jobs: `check` (lint → `tsc --noEmit` → `bun test` → prettier check), `e2e` (chromium/webkit matrix, browsers installed with `--with-deps`, HTML report uploaded per browser), `secret-scan` (gitleaks).

# Conventions

- **Pure functions first**: prompt builders, schema cleaning, tree traversal/branch deletion, compaction helpers, conditional text, random choice, scenario parsing, model-options parsing, crypto round-trips, export bundle building — all tested without I/O.
- **Fetch stubbing**: LLM/Drive/network code takes injectable `fetchImpl`-style seams; tests capture request bodies (e.g. streaming on/off asserts the `stream` field; scene-length tests assert the length instruction across all messages).
- **Real-DB tests**: repositories, backup round-trips, restore upserts, and `plaintextLeak.test.ts` run against fake-indexeddb. Shared factories live in `features/backup/testsupport/records.ts` (`makeTestGame/makeTestNode/makeTestAsset/makeTestSettings`, `wipeDatabaseForTest`) — created after a review flagged test duplication.
- **Store tests**: `gameStore.*.test.ts` cover flows (retry payloads, redo/response, stage transitions, streaming flags, theme stock, scene-length snapshot) with stubbed network.
- **Hook/component tests**: `useGameNavigation.test.tsx` renders for real (happy-dom) across resume/playhead/chronicle scenarios.

# End-to-End (Playwright)

Config (`playwright.config.ts`): `testDir: ./e2e`, `baseURL http://127.0.0.1:5173`, `webServer` boots `bun run dev` (dev mode keeps `BrowserRouter` SPA fallback and disables the PWA service worker). Projects: chromium (Desktop Chrome — covers Chrome/Edge/Tauri WebView2) + webkit (Desktop Safari — engine-level Safari coverage for the PWA audience). Firefox is deliberately excluded: smallest share and the app's browser-dependent surface (view transitions with router fallback, no-op wake lock) leaves little engine-specific risk.

| Spec | Coverage |
|------|----------|
| `title.spec.ts` | Title heading/buttons, New Story → settings without a key |
| `screens.spec.ts` | Settings/load/setup rendering, setup → settings without a key |
| `routing.spec.ts` | `/play`/`/history`/`/chronicle` guards → title, unknown path fallback |
| `deletion.spec.ts` | Save-slot, branch (partial + last-branch-removes-game), full wipe incl. DB-empty + completion screen |
| `playthrough.spec.ts` | Mocked-LLM two-turn journey: setup → starting → turn 1 → choice → turn 2 |

Helpers (`e2e/helpers/`):

- `seed.ts` — writes games/nodes/credentials straight into IndexedDB via `page.evaluate` + dynamic `import("/src/db/database.ts")` (Vite dev serves `/src/*.ts` as modules at runtime; static types come from `typeof import` with the relative file path), then `page.reload()` so `bootstrap()` picks the rows up. Repository reads are unvalidated, so seeds only need UI-visible fields (branded ids still cast). `seedApiKey` stores the dummy `sk-or-test` (same value as unit tests, gitleaks-safe).
- `mockLlm.ts` — canned OpenRouter `chat/completions` endpoint returning a queued scene per call. Returns plain-JSON completions (not SSE): the streaming client accepts non-event-stream responses as JSON, so no SSE framing is needed. First call can be delayed to observe the starting screen.

Conventions: fresh browser context per test (= empty IndexedDB); no external network — LLM/Drive are mocked or avoided, image generation stays at its `disabled` default; scope confirm buttons to `getByRole("dialog")` (card menus share the "Delete" label); use `exact: true` where headings collide (e.g. "Settings" vs "Display"). `playwright-report/` + `test-results/` are gitignored and eslint-ignored.

Browser-install note (learned on a restricted network): Playwright's downloader aborts after a 30s socket stall and retries identically, while browsers ride through via Happy Eyeballs — a dead IPv6 path (`curl -6` stalled, plain `curl` answered in 0.6s) was the cause here. Workarounds: `bunx playwright install` retries/fallback hosts, or manually extract the exact-revision zips from `install --dry-run` URLs into `%LOCALAPPDATA%/ms-playwright/<name>-<rev>/` plus an empty `INSTALLATION_COMPLETE` marker (without it, later `install` runs prune the directory as unused).

# Notable Proof Tests

- `plaintextLeak.test.ts` — the backup completion condition: envelope text + base64-decoded bytes contain no story/settings plaintext and no credentials, at both local and Drive boundaries.
- `gameStore.streaming.test.ts` — streaming OFF sends no `stream` field; ON sends `stream: true` (regression for a shipped bug where the toggle only affected display).
- `sceneSchema.test.ts` — narrator schema and prompt-embedded text contain no `propertyNames`/`$schema`.
- `gameStore.sceneLength.test.ts` — per-save snapshot wins over global; old saves fall back.
- `gameStore.stage.test.ts` — stage transitions `choice` → `scene` around the narration call.

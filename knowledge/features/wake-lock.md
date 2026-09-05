---
type: Feature
title: Wake Lock
description: Screen Wake Lock keeps the display awake during long-running network operations (generation, autoplay, translation, images, backups) in v2.
tags: [wake-lock, ux, mobile, pwa]
timestamp: 2026-09-05T00:00:00Z
source: src/features/wakelock/api.ts, src/store/streamStore.ts, src/store/gameStore.ts
---

# Overview

The Screen Wake Lock API (`navigator.wakeLock.request("screen")`) keeps the display awake while long network calls run, so a phone does not lock itself mid-generation. Implementation lives in `src/features/wakelock/api.ts` as an owner-keyed module (not store state): callers register an owner with `acquireWakeLock(owner)` and unregister with `releaseWakeLock(owner)`. The single `WakeLockSentinel` is held as long as at least one owner is registered. Baseline 2025 API support (Chrome 84+, Safari/iOS 16.4+, Firefox 126+); requires HTTPS. Unsupported browsers, denials, and battery-saver refusals are swallowed with a `console.warn` — the lock is best-effort and must never break a turn.

# Owners

| Owner | Acquired | Released |
|-------|----------|----------|
| `generation` | `streamStore.begin()` | `streamStore.end()` — covers every turn pipeline (start / choose / refine / redo incl. root redo) end to end: text, memory, and scene image stages. |
| `autoplay` | `toggleAutoplay` (on) | Every site that turns `autoplay: false` (goToTitle, openGame, deleteBranch, resumeStoryAtNode, story over, autoplay failure) — holds across inter-turn gaps, not just per turn. |
| `translation` | `translateUi` | `finally` — UI AI translation. |
| `theme` | `cycleTheme` (generate path) | `finally` — theme idea LLM call. |
| `image` | `regenerateImage` | `finally` — scene image regeneration (abort path included). |
| `backup` | `exportSave`, `downloadEncryptedBackup`, `restoreBackupFromFile`, `importSaveFromFile`, and every Google Drive action (connect / disconnect / upload / refresh / restore / delete) | `finally` — covers GIS token interaction, key derivation, transfer, and decrypt. |

Distinct owners per concern mean overlapping operations (e.g. translation while autoplay runs) hold the lock until the last one finishes; releasing one owner never cuts short another.

# Platform Behavior

The browser force-drops the lock when the page becomes hidden, the screen turns off, or a battery saver engages. While owners are still registered, a `visibilitychange` listener re-requests on the next return to visible (the documented re-acquire path). A request dedupe flag (`requestInFlight`) prevents double requests; a lock resolved after every owner already left is released immediately. Platform releases are only recovered on visibility change — battery-saver drops are intentionally respected until then.

# Limitations

The lock only applies while the page is visible. Locking the device or switching apps suspends JS entirely (in-flight fetches included); on return the lock is re-acquired if work is still in flight. The feature has no UI surface or settings entry.

# Testing

`src/features/wakelock/api.test.ts` stubs `navigator.wakeLock` (happy-dom `Window` installed onto `globalThis`, pending-request promises resolved manually) and covers: unsupported-environment no-op, single lock shared across owners, release-after-resolved race, re-acquire on visibility change, swallowed request failures with retry, and unknown-owner release.

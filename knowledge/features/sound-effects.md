---
type: Feature
title: Sound Effects
description: UI chimes for scene-generation completion, toasts, and the error dialog in v2.
tags: [sound, audio, ux-feedback]
timestamp: 2026-09-04T00:00:00Z
source: src/features/sound/, src/store/gameStore.ts, src/components/ErrorDialog.tsx, src/app/App.tsx, public/sounds/
---

# Overview

Three one-shot UI chimes ship as OGG files in `public/sounds/` and play on the app's three user-facing feedback moments: a finished scene, a toast, and an error dialog. Playback goes through `playSound(soundName)` exposed by `src/features/sound/api.ts` (implementation `playSound.ts`, tests `playSound.test.ts` with a stubbed `Audio`). Sound names map 1:1 to files: `done` → `done.ogg`, `notification` → `notification.ogg`, `error` → `error.ogg`.

# Triggers

| Sound | Fires when | Wiring |
|-------|-----------|--------|
| `done` | Scene generation finishes successfully | Module-level `useGameStore.subscribe` on `generation.phase` in `gameStore.ts`: only `running → idle` chimes (start / choose / refine / redo incl. root redo — i.e. every autoplay turn too). `failed → idle` (dialog dismiss bookkeeping) stays silent. |
| `notification` | A new toast appears | `ToastSoundPlayer` in `App.tsx` renders next to `<Toaster>` and watches `useToasterStore()` (react-hot-toast 2.6), deduplicating by toast id — no call-site changes needed. |
| `error` | The error dialog opens with a fresh failure | Effect in `ErrorDialog.tsx` keyed on the failed payload object: chimes on open and again only when a new failure replaces the payload (a retry failing again re-chimes). |

# Playback Mechanics

`playSound` keeps one `HTMLAudioElement` singleton per sound (module `Map`), so repeats reuse the fetched/decoded media. `preload="auto"`; a replay seeks `currentTime` back to 0 only when metadata is loaded (`readyState >= HAVE_METADATA`). URLs are prefixed with `import.meta.env.BASE_URL ?? "/"`. Every failure path is swallowed silently (missing media support, autoplay policy rejection) — sound is best-effort, never a crash.

# Assets & Caching

Files total ~70 KB and are PWA-precached (`globPatterns` includes `ogg`) so chimes work offline. Sources are Pixabay, attributed in the generated `public/legal/license.html` (see `vite.config.ts` `addLicense`). There is no user-facing mute/volume setting yet; the sounds always play (subject to browser autoplay policy).

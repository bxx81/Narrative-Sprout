---
type: Reference
title: Architecture Overview (v2)
description: High-level architecture of Narrative Sprout v2 — how the UI, Zustand store, feature modules, Dexie repositories, and external APIs interact.
tags: [architecture, overview]
timestamp: 2026-09-02T00:00:00Z
source: src/app/App.tsx, src/store/gameStore.ts, src/db/database.ts, REDESIGN.md
---

# Application Architecture

```
┌────────────────────────────────────────────────────────┐
│                     Browser (PWA)                       │
│  ┌──────────┐  ┌──────────────────┐  ┌──────────────┐  │
│  │ React UI │─▶│  Zustand store   │─▶│  Action      │  │
│  │ (Screens)│  │  (gameStore +    │  │  functions   │  │
│  │          │  │   streamStore)   │  │  (slices)    │  │
│  └──────────┘  └──────────────────┘  └──────┬───────┘  │
│                                              │          │
│  ┌───────────────────────────────────────────▼────────┐ │
│  │              Feature Modules                      │ │
│  │  ┌──────────────┐ ┌────────────────┐              │ │
│  │  │ gameplay/    │ │ narrative/     │              │ │
│  │  │ turnService  │ │ (LLM calls,   │              │ │
│  │  │(orchestrator)│ │  prompts)      │              │ │
│  │  └──────────────┘ └────────────────┘              │ │
│  │  ┌──────────────┐ ┌────────────────┐              │ │
│  │  │ storytree/   │ │ image/         │              │ │
│  │  │ attachments/ │ │ memory/autoplay│              │ │
│  │  │ theme/i18n/  │ │ backup/export/ │              │ │
│  │  │ openrouter/  │ │                │              │ │
│  │  └──────────────┘ └────────────────┘              │ │
│  │  Each feature exposes only api.ts                 │ │
│  └────────────────────────────────────────────────────┘ │
│                          │                              │
│  ┌───────────────────────▼────────────────────────────┐ │
│  │              Data Layer (Dexie)                     │ │
│  │  ┌──────────────┐  ┌──────────────┐                │ │
│  │  │ game Repo    │  │ asset Repo   │                │ │
│  │  │ (games/nodes)│  │ (nodeId 1:1) │                │ │
│  │  └──────────────┘  └──────────────┘                │ │
│  │  ┌──────────────┐  ┌──────────────┐                │ │
│  │  │ settings     │  │ credentials  │                │ │
│  │  │ Repo (app)   │  │ Repo (keys)  │                │ │
│  │  └──────────────┘  └──────────────┘                │ │
│  └────────────────────────────────────────────────────┘ │
└──────────────────────┬──────────────────────────────────┘
                       │
  ┌────────────────────▼──────────────────────────────────┐
  │              External APIs                             │
  │  ┌──────────────┐  ┌──────────────────┐               │
  │  │  OpenRouter  │  │ Image Generators │               │
  │  │  (LLM API)   │  │ (HF/A1111/Comfy │               │
  │  └──────────────┘  │  /NIM/disabled)  │               │
  │  ┌──────────────────────────────────┐ │               │
  │  │  Google Drive (encrypted backup) │ │               │
  │  └──────────────────────────────────┘ │               │
  └────────────────────────────────────────┘
```

# State Flow

1. User interacts with a **React screen** (e.g., makes a choice).
2. The screen calls an **action function** on `useGameStore` (e.g., `choose`).
3. The action sets `generation` to `running` (with a retryable payload) and calls **`turnService`** (`startGame` / `choosePath` / `refineScene`).
4. `turnService` builds prompts via `features/narrative`, calls **LLM APIs** via `generateScene`, generates images via `features/image`, and persists through **Dexie repositories** in transactions.
5. The action writes results back to the store (`nodes`, `assets`, `activeGame`) and returns `generation` to `idle`. On failure it records the `failed` phase with the payload so `retryGeneration` can re-run the exact action.

# Key Design Decisions

- **All data stays in the browser**. There is no backend server. The user provides their own API key, stored only in the `credentials` table.
- **The AI is stateless**. All context is rebuilt each turn from the saved `StoryNodeRecord`s. The AI's memory (`notes` + `storyLog`) serves as long-term memory.
- **Feature modules, not services**. The ambiguous legacy "service" layer is gone; each `src/features/<name>/` module exposes only `api.ts`. (A couple of feature-internal files still carry `*Service` filenames — `autoplayService.ts`, `translateService.ts` — but they are feature internals, not a service layer.)
- **No direct `set`**. Components and features never call Zustand `set` directly; all state changes go through action functions in the store.
- **Element-wise validation**. Persisted records/arrays are never validated with whole-record `.catch()`/`.default()`; elements are `safeParse`d individually and failures are skipped with a warning.
- **Encrypted-only backup**. Plaintext backup paths do not exist; Drive uploads carry only the `ns-backup` envelope.

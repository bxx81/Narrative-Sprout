---
type: Reference
title: Architecture Overview (v2)
description: High-level architecture of Narrative Sprout v2 — how the UI, Zustand store, feature modules, Dexie repositories, and external APIs interact.
tags: [architecture, overview]
timestamp: 2026-09-12T00:00:00Z
source: src/app/App.tsx, src/store/gameStore.ts, src/db/database.ts
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

# Design Rationale (why v2 was rebuilt)

The legacy v1 codebase was unshippable: its git history contained leaked API keys, and its architecture had accumulated structural defects. v2 was a **clean rebuild with zero data compatibility** (version `2.0.0`, DB `schemaVersion` starts at 1; the legacy repo `narrative-sprout-legacy` is archived private). The problems that shaped the v2 rules:

| Legacy problem | v2 answer |
|---|---|
| API keys in repo history (P1) | Fresh repo + gitleaks CI (see [Security](security.md)) |
| OPFS + gzip single-file saves; one corruption killed everything (P3) | IndexedDB node-per-record (see [Storage Service](/services/storage-service.md)) |
| Hand-rolled write mutex + orphan images on failure (P4/P9) | Dexie transactions + orphan GC |
| Plaintext `settings.json` uploaded to Drive (P5) | Encrypted-only `ns-backup` envelope |
| Zod `.catch({})` silently replacing whole records (P6) | Element-wise `safeParse` + skip-with-warning, ESLint-enforced |
| Per-game token copies needing export sanitizing (P11) | Global `credentials` store only; exports structurally cannot reach secrets |
| `_PENDING/_SUCCESS` + `lastActionForRetry` manual flags (P8) | `AsyncOperation` union |
| `acceptVersion` string comparison broke on missing versions (P2) | Integer `schemaVersion` + migration chain (see [Data Migration](/operations/data-migration.md)) |
| Scene/theme split via filename heuristics (P7) | YAML front matter scenario format |

# Key Design Decisions

- **All data stays in the browser**. There is no backend server. The user provides their own API key, stored only in the `credentials` table.
- **The AI is stateless**. All context is rebuilt each turn from the saved `StoryNodeRecord`s. The AI's memory (`notes` + `storyLog`) serves as long-term memory.
- **Feature modules, not services**. The ambiguous legacy "service" layer is gone; each `src/features/<name>/` module exposes only `api.ts`. (A couple of feature-internal files still carry `*Service` filenames — `autoplayService.ts`, `translateService.ts` — but they are feature internals, not a service layer.)
- **No direct `set`**. Components and features never call Zustand `set` directly; all state changes go through action functions in the store.
- **Element-wise validation**. Persisted records/arrays are never validated with whole-record `.catch()`/`.default()`; elements are `safeParse`d individually and failures are skipped with a warning.
- **Encrypted-only backup**. Plaintext backup paths do not exist; Drive uploads carry only the `ns-backup` envelope.

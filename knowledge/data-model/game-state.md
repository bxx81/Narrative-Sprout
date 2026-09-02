---
type: Data Model
title: GameState & Records (v2)
description: The central persisted records — Game, StoryNode, Asset, Credential, Settings — and the live store shape in v2.
tags: [data-model, records, typescript]
timestamp: 2026-09-02T00:00:00Z
source: src/types/game.ts, asset.ts, credential.ts, settings.ts, ids.ts, src/store/gameStore.ts
---

# Persisted Records

All schemas live next to their types and derive types via `z.infer` (never declared twice). IDs are branded (`GameId`, `StoryNodeId`) and ID fields are fully qualified (`parentNodeId`, never `parentId`).

# GameRecord (Save Header)

One playthrough's header (`src/types/game.ts`):

| Field | Type | Description |
|-------|------|-------------|
| `id` | `GameId` | UUID (`crypto.randomUUID`). |
| `schemaVersion` | int > 0 | Integer schema version for the migration chain (currently 1). |
| `title` | string | World theme text; the save's display title. |
| `createdAt` / `lastPlayedAt` | ISO 8601 | Creation / last-touch timestamps (`lastPlayedAt` is the list sort key). |
| `latestNodeId` | `StoryNodeId \| null` | Reference-only pointer for list previews (no duplicated scene data). |
| `attachmentTexts` | `string[]?` | Per-game world texts (front matter resolved, `{a\|b}` applied). Element-wise validated. |
| `sceneTextLength` | `string?` | Length order snapshotted at creation; later turns prefer it over global settings (old saves omit → global fallback). |

Holds NO secrets and no other settings (those stay global), by design.

# StoryNodeRecord (One Turn)

One tree node (`src/types/game.ts`):

| Field | Type | Description |
|-------|------|-------------|
| `id` | `StoryNodeId` | UUID. |
| `gameId` | `GameId` | Owning game (absent in legacy's flat map). |
| `parentNodeId` | `StoryNodeId \| null` | `null` = root node. |
| `turnNumber` | int > 0 | 1-based (game start is turn 1). |
| `choiceText` | `string \| null` | Choice leading here; `null` on root. |
| `scene` | `SceneContent` | Display-only content (no memory). See [Scene Structure](scene.md). |
| `promptSent` | string | The user message actually sent for this turn. **Never remove**: past-turn history is rebuilt from it (cannot be recomputed from `choiceText`). |
| `memory` | `MemoryState` | Accumulated long-term memory up to and including this turn. |
| `memoryDelta` | `MemoryDelta` | This turn's delta (kept for memory-call resend). |
| `metadata` | `NodeMetadata` | `{ generationCost \| null, modelName \| null, discardHistoryContext, refinePrompt \| null, refinedFromNodeId \| null, autoplayReasoning? \| null }`. |
| `createdAt` | ISO 8601 | Timestamp. |

No asset reference field by design (assets key on the same node id).

# AssetRecord (Image)

`src/types/asset.ts`: `{ nodeId (PK = owning node id), blob: Blob, mimeType: ImageMimeType, byteSize, updatedAt }`. See [Storage Service](/services/storage-service.md).

# CredentialRecord (Secrets)

`src/types/credential.ts`: `{ key, value }` with keys `openrouterApiKey`, `huggingFaceToken`, `nvidiaNimToken`, `googleOAuthToken`. Global-only (no per-game copies). Export/backup paths must never reach these values in plaintext.

# SettingsRecord (Global Singleton)

`src/types/settings.ts`, table key `"app"`. Full field reference: see [Settings System](/features/settings-system.md). Notable validation: `aiTranslations` / `aiLanguageMappings` validate element-wise (corrupt languages/values skipped with warnings); scalar fields use plain field defaults (the record/array `.catch()` ban applies to wholesale recovery, not scalar defaults).

# Live Store Shape

`useGameStore` (`src/store/gameStore.ts`) holds `settings`, in-memory credential mirrors, `games`, `activeGame`, `nodes` (active game's nodes), `assets` (nodeId → record), `viewingNodeId`, `currentNodeId` (session-only playhead), `chronicleTargetNodeId`, `generation` / `imageRegeneration` / `autoplayTurn` / `uiTranslation` / `themeGeneration` (`AsyncOperation`s), `imageGenerationProgress`, `generationStage`, `autoplay` + `autoplayEndingComment`, `generatedThemes`, `uiTranslationProgress`, `driveConnected` + `driveBackups`. Actions are the only mutation path (see [State Management](state-management.md)).

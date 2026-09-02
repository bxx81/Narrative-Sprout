---
type: Service
title: Storage Service (IndexedDB via Dexie)
description: All persistent data storage in v2 — games, nodes, assets, settings, credentials — using IndexedDB via Dexie.
tags: [storage, indexeddb, dexie, persistence]
timestamp: 2026-09-02T00:00:00Z
source: src/db/database.ts, gameRepository.ts, assetRepository.ts, settingsRepository.ts, credentialsRepository.ts, wipeRepository.ts, restoreRepository.ts
---

# Overview

`src/db/database.ts` defines `NarrativeSproutDatabase` (database name `narrative-sprout`, version 1) with five tables:

| Table | Key | Indexes | Contents |
|-------|-----|---------|----------|
| `games` | `id` | `lastPlayedAt` | `GameRecord` headers |
| `nodes` | `id` | `gameId`, `parentNodeId`, `[gameId+turnNumber]` | `StoryNodeRecord`s (one per turn) |
| `assets` | `nodeId` | — (PK = node id) | `AssetRecord` images, 1:1 with nodes |
| `settings` | `key` | — | Singleton `SettingsRecord` (`key: "app"`) |
| `credentials` | `key` | — | `CredentialRecord` secrets |

No hand-rolled mutex: write serialization comes from Dexie transactions (`db.transaction("rw", …)`). Node records give fault locality (one corrupt node cannot take down a whole save, unlike the legacy single-file format).

# Capabilities

| Operation | Location | Description |
|-----------|----------|-------------|
| `createGame` / `appendNode` / `putAsset` / `getNode` | `gameRepository` | Game/node writes always in a `games+nodes+assets` transaction; asset writes also go through `putAsset` (same transaction as node appends). |
| `updateNodeSceneText` | `gameRepository` | In-place scene-text edit (manual editing). |
| `listGames` / `getGame` / `getNodesOfGame` | `gameRepository` | Save list (by `lastPlayedAt` desc), single game, play-order nodes. |
| `deleteBranch` / `deleteGame` | `gameRepository` | Branch or whole-save deletion, always transactional with assets. |
| `put` / `get` / `collectGarbage` / `fileNameForAsset` | `assetRepository` | Asset CRUD, orphan GC, ZIP filename derivation. |
| `get` / `put` | `settingsRepository` | Settings singleton (malformed row → defaults + warning). |
| `get` / `set` / `delete` | `credentialsRepository` | The ONLY module allowed to touch secrets. |
| `upsertRestoredData` | `restoreRepository` | Merge-by-id upsert for backup/save restores (never deletes). |
| `wipeAllUserData` | `wipeRepository` | `db.delete()` — whole database incl. settings and credentials. |

# Asset Rules (REDESIGN §5.3)

- **1:1 by `nodeId`**: regeneration overwrites the same key (`updatedAt` bumped); nodes carry no asset reference field by design.
- **Co-deletion**: node deletion and asset deletion always share one transaction — orphan-by-delete is structurally impossible.
- **Orphan GC**: `collectGarbage` compares `primaryKeys()` only (never deserializes Blobs) and removes assets without nodes; runs on startup / after deletes as a safety net.
- **Extension registry**: `src/lib/imageFileExtensions.ts` (`imageFileExtensions`, `getImageFileExtension`, `getImageMimeTypeFromExtension`, `isKnownImageMimeType`) is the single mime↔extension mapping. Hardcoding `.webp` is forbidden.

# Secrets Isolation (REDESIGN §5.4)

`credentialsRepository` is the only secrets reader/writer. Export/backup features must never import it — enforced by review, and proven by `plaintextLeak.test.ts` (see [Backup & Restore](/features/backup-restore.md)).

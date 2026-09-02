---
type: Feature
title: History & Saves
description: Save/load, branching, rewind, redo, chronicle, and IndexedDB persistence of playthroughs in v2.
tags: [saves, history, branching, indexeddb]
timestamp: 2026-09-02T00:00:00Z
source: src/db/gameRepository.ts, src/features/storytree/treeTraversal.ts, branchDeletion.ts, src/screens/LoadScreen.tsx, HistoryScreen.tsx, ChronicleScreen.tsx
---

# Overview

One playthrough = one `GameRecord` (header) + many `StoryNodeRecord`s (tree via `parentNodeId`) + `AssetRecord`s (1:1 images). All live in IndexedDB — no gzip files, no summary/detail split (see [Storage Service](/services/storage-service.md)).

# Save Management

- **List** (`gameRepository.listGames`): ordered by `lastPlayedAt` desc. `LoadScreen` cards show title, latest scene preview, timestamp, completion state; actions: open, delete. The Load screen also **imports** `ns-save` ZIPs via drag & drop / file picker (export lives on the History screen; see [Story Export](story-export.md)).
- **Open** (`openGame`): loads game + all nodes + assets into the store, sets playhead and viewing position to the latest node.
- **Delete save** (`deleteGame`): removes the game, all its nodes, and all its assets in one transaction.
- **Wipe all** (`wipeRepository.wipeAllUserData`): `db.delete()` drops the whole database including settings and credentials (factory state), then clears storage and reloads; the completion screen renders via the `nsDataDeletionComplete` sessionStorage flag on the `/deletion_complete` route.

# Tree Navigation

- **Ancestors** (`collectAncestors`, newest-first) power history building and autoplay log compilation.
- **Rewind / Resume Here**: `resumeStoryAtNode(nodeId, branchEndNodeId)` sets the viewing position and playhead (History tree and Chronicle linear views). `setViewingNode` moves display only; `currentNodeId` (session-only playhead) is where Forward returns to.
- **History screen**: renders leaf/ending node cards (not a literal tree diagram) with resume/rewind, delete, and the `ns-save` export ("Download Save Data").
- **Chronicle screen**: linear path from root to a target node (`chronicleTargetNodeId`), with resume support.

# Branch Deletion

`collectNodesToDelete(allNodes, endNodeId)` (pure): collects the whole subtree of the target, then walks upward deleting parents that would become childless (up to the branching point). `gameRepository.deleteBranch` applies it transactionally with assets and refreshes `latestNodeId`; deleting everything removes the whole game (returns `{ gameDeleted }`).

# Redo (Regenerate Scene)

`redoScene(nodeId, discardHistoryContext)` (see [Scene Correction](scene-correction.md)): non-root nodes re-roll as a sibling via `choosePath` (Keep = normal history, Discard = history cut + `discardHistoryContext` flag persisted on the node, cutting all future histories at that point via `applyHistoryContextCut`). Root redo creates a fresh save slot with the same theme/attachments, keeping the current save. Root redo is the only *gameplay* operation that creates a new `GameRecord` after game creation (backup restore and `ns-save` import also create GameRecords).

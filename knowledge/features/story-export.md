---
type: Feature
title: Story Export (ns-save)
description: Single-save ZIP export in the ns-save format, plus re-import, in v2.
tags: [export, ns-save, zip]
timestamp: 2026-09-02T00:00:00Z
source: src/features/export/exportBundle.ts, exportGame.ts, zipArchive.ts, types.ts, src/features/backup/importSave.ts
---

# Overview

Any single save can be exported as a portable ZIP (`ns-save` format, version 1) and later re-imported. Export lives only on the History screen ("Download Save Data"); the Load screen offers **import** (drag & drop / file picker), not export.

# Format

```
<file>.zip
  manifest.json            # { format: "ns-save", version: 1, exportedAt, game: GameRecord }
  nodes/<nodeId>.json      # one StoryNodeRecord each (turnNumber order)
  assets/<nodeId>.<ext>    # images; extension derived from mimeType
```

`buildExportBundle` is pure: manifest + node files + asset files. `createZipArchiveBlob` (fflate) stores WebP assets uncompressed (level 0, already compressed) and deflates JSON. Filenames sanitize the title (40 chars, OS-invalid chars stripped): `ns-save_<title>_<stamp>.zip`.

# Security

The bundle receives only `GameRecord` / `StoryNodeRecord` / `AssetRecord` — settings and credentials are structurally unable to enter an export (the export feature never imports the credentials repository). Orphan assets (no matching node) are skipped with a warning, never crashing the export.

# Re-import

`importSaveFromZipBytes` (`features/backup/importSave.ts`) parses an `ns-save` ZIP element-wise — invalid records, nodes whose `gameId` does not match the manifest game id, and assets whose `nodeId` is not among the imported nodes are skipped with warnings (there is no parentless-node check; a node with a dangling `parentNodeId` imports as-is) — then upserts via `restoreRepository` (merge by id; nothing pre-existing deleted). Unknown container versions are refused, not guessed. Results surface as toasts (`toastLoadSavedataSuccess` and friends).

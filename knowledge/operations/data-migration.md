---
type: Playbook
title: Data Migration (v2)
description: Schema versions, the migration chain, validation policy, and v1 incompatibility in Narrative Sprout v2.
tags: [migration, schema, zod, versioning]
timestamp: 2026-09-02T00:00:00Z
source: src/db/migrations.ts, src/types/game.ts, settings.ts, src/db/restoreRepository.ts
---

# Overview

v2 carries **no compatibility with legacy v1 formats** (no OPFS gzip / old ZIP importers — forbidden by AGENTS.md rule 8). Old-version support inside v2 is handled by an integer `schemaVersion` + migration chain + non-destructive refusal.

# Schema Versions

- `CURRENT_SCHEMA_VERSION = 1` (`src/db/migrations.ts`). Every `GameRecord` carries `schemaVersion: number` (int, positive).
- `migrations: Record<number, MigrationFunction>` maps N → N+1 upgraders. **Empty by design at launch** — the mechanism exists from day one so future changes never need ad-hoc conversion code. Every shape bump MUST add the corresponding entry.
- `assertSupportedSchemaVersion` throws `UnsupportedSchemaVersionError` for records newer than the build supports. Newer data is reported as unplayable, **never modified or deleted** (non-destructive policy). Older data flows through the migration chain.
- Container versions are independent: `ns-save` v1 (`NS_SAVE_VERSION`) and `ns-backup` v1 (`NS_BACKUP_VERSION`). Import/restore refuses unknown container versions instead of guessing.

# Validation Policy (REDESIGN §5.7)

1. **No `.catch()` on record/array schemas as a whole** (ESLint-enforced). No wholesale `.default()` recovery either.
2. Arrays/records validate **element-wise with `safeParse`**: bad elements are skipped with `console.warn` (`attachmentTexts`, `aiTranslations`, `aiLanguageMappings`, restored/imported nodes/assets).
3. **Migration runs before `safeParse`** (Zod strips unknown keys; old fields must be read first).
4. Schemas live with their types; `z.infer` is the single source of types.

# Restore Semantics

`restoreRepository.upsertRestoredData` merges by primary key (existing ids overwritten, rest added, nothing deleted). It performs no validation itself ("Validation has already happened in the backup feature"); the element-wise skipping of invalid nodes/assets (foreign-game nodes, assets without a matching node, unknown extensions) happens in `importSave.ts` before restore.

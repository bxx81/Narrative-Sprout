---
type: Feature
title: Backup & Restore (ns-backup)
description: Encrypted full backup envelope, local download, Google Drive sync, and restore in v2.
tags: [backup, encryption, ns-backup, drive]
timestamp: 2026-09-02T00:00:00Z
source: src/features/backup/createBackup.ts, backupPayload.ts, envelope.ts, restoreBackup.ts, importSave.ts, driveBackup.ts, src/lib/crypto.ts
---

# Overview

Backup covers **everything**: all games + nodes + assets + non-secret settings, wrapped in an encrypted `ns-backup` envelope (version 1, `.nsbak` files). **There is deliberately no unencrypted backup path.** Restore merges records by id (upsert; nothing pre-existing deleted).

# Envelope (REDESIGN §3.3, WebCrypto only)

```json
{
  "format": "ns-backup",
  "version": 1,
  "kdf": { "algo": "PBKDF2", "hash": "SHA-256", "iterations": 600000, "salt": "<base64>" },
  "cipher": { "algo": "AES-GCM", "iv": "<base64>", "data": "<base64>" }
}
```

`encryptWithPassphrase` / `decryptWithPassphrase` (`src/lib/crypto.ts`): PBKDF2-SHA256 600k → AES-GCM-256. Constants `PBKDF2_ITERATIONS`, `PBKDF2_SALT_BYTES` (16), `AES_GCM_IV_BYTES` (12). The passphrase lives in memory for one call only — never stored or logged. Losing it means losing the backup (by design, stated in README).

# Payload

The encrypted inner ZIP holds `manifest.json` (`ns-backup` v1 + `createdAt` + `gameCount`), `games/*.json`, `nodes/*.json`, `assets/<nodeId>.<ext>`, `assets.json` (nodeId → `{ mimeType, updatedAt }` index), and `settings.json` (absent when none). Filenames: `ns-backup_<stamp>.nsbak`.

# Security Proof

`collectBackupSourceData` reads games/nodes/assets/settings — it never imports the credentials repository, so secrets are structurally unreachable. `plaintextLeak.test.ts` (the Phase 5 completion condition) verifies at both the local-download and Drive-upload boundaries that the envelope text and base64-decoded bytes contain no plaintext story/settings text and no credentials. Shared test factories live in `features/backup/testsupport/records.ts`.

# Restore

`restoreBackupFromEnvelopeText(envelopeText, passphrase)`: parse envelope → decrypt → `parsePayloadZip` (element-wise validation, orphans skipped) → `restoreRepository.upsertRestoredData`. Future envelope versions are refused (non-destructive policy). `importSaveFromZipBytes` handles single-save `ns-save` ZIPs on the same path. Restore/import surfaces via toasts.

# Google Drive

Same encrypted envelope uploaded to a `NarrativeSproutBackup` folder (`.nsbak` files, newest first): upload / list / download+restore / delete (`driveBackup.ts`). Auth and client details: see [Google Drive Integration](/services/google-drive.md).

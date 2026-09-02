---
type: Service
title: Google Drive Integration (Encrypted Backup)
description: Cloud backup and restore of the encrypted ns-backup envelope via Google Drive in v2.
tags: [drive, backup, oauth, gis]
timestamp: 2026-09-02T00:00:00Z
source: src/features/backup/googleAuth.ts, driveClient.ts, driveBackup.ts
---

# Overview

Drive carries the **same encrypted envelope** as local `.nsbak` download — plaintext never leaves the device (see [Backup & Restore](/features/backup-restore.md)). Scope is the minimal `https://www.googleapis.com/auth/drive.file` (app-created files only), inside a `NarrativeSproutBackup` folder. There is intentionally **no Google API key** in this app (client id only).

# Auth

`googleAuth.ts` loads Google Identity Services dynamically (no `gapi-script` dependency) as an OAuth **token** flow. `getGoogleDriveClientId` reads `VITE_GOOGLE_CLIENT_ID`; `requestDriveAccessToken` acquires the token from a user gesture; `hasDriveAccessToken` / `clearDriveAccessToken` / `revokeDriveAccessToken` manage it. The **access token lives in memory only** — never persisted, so a reload simply reconnects. A 401 becomes `DriveUnauthorizedError`, and store actions clear the token so the UI re-prompts.

# Client

`driveClient.ts` is a minimal Drive v3 REST client (fetch + Bearer, `fetchImpl` injectable for tests): `findFolderByName` / `createFolder` / `getOrCreateFolder`, multipart `uploadFile`, `listFilesInFolder`, `downloadFile`, `deleteFile`. Query values are escaped for Drive search syntax. `DriveApiError` carries HTTP status.

# Operations

`driveBackup.ts` orchestration (token passed in per call, never stored):

| Function | Description |
|----------|-------------|
| `uploadBackupToDrive` | Builds a fresh encrypted envelope and uploads it as a new timestamped `.nsbak` file. |
| `listDriveBackups` | Lists `.nsbak` files in the folder, newest first. |
| `restoreBackupFromDrive` | Downloads one file and restores through the standard envelope path. |
| `deleteDriveBackup` | Deletes one backup file. |

Store actions (`connectGoogleDrive`, `uploadBackupToGoogleDrive`, `refreshGoogleDriveBackups`, `restoreGoogleDriveBackup`, `deleteGoogleDriveBackup`, `disconnectGoogleDrive`) wire these to the UI (`BackupSection` under Settings > Data Management) with toast feedback. Drive quota/rate errors surface as normal API errors (see [Error Handling](error-service.md)).

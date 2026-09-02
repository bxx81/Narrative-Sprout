---
type: Integration
title: Google APIs (v2)
description: Google Drive v3 and Google Identity Services OAuth usage in v2.
tags: [google, drive, oauth]
timestamp: 2026-09-02T00:00:00Z
source: src/features/backup/googleAuth.ts, driveClient.ts
---

# Overview

Two Google touchpoints: Drive v3 REST for backup files, and Google Identity Services (GIS) OAuth token flow for authorization. Scope is the minimal `https://www.googleapis.com/auth/drive.file`. No `gapi-script` dependency; GIS is loaded dynamically.

# Endpoints

| Endpoint | Use |
|----------|-----|
| `https://www.googleapis.com/drive/v3` | Folder lookup/create, file list, download, delete. |
| `https://www.googleapis.com/upload/drive/v3` | Multipart upload of `.nsbak` envelopes. |
| GIS `initTokenClient` | User-gesture access-token acquisition. |

Auth: Bearer access token (memory-only). 401 → `DriveUnauthorizedError` → store clears the token and the UI re-prompts.

# Setup & Scoping

Only the embedded OAuth **client id** (`VITE_GOOGLE_CLIENT_ID`, restricted to the app's origins in Google Cloud Console) ships in the build — there is no Google API key. `drive.file` scope limits access to app-created files inside `NarrativeSproutBackup`. Setup steps: see README "Google Drive setup". Only encrypted envelopes are ever uploaded (see [Google Drive Integration](/services/google-drive.md)).

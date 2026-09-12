---
type: Reference
title: Security Model (v2)
description: Secret handling, repository hygiene, encrypted-only backups, and the honest threat model of local data storage in Narrative Sprout v2.
tags: [security, secrets, threat-model, encryption]
timestamp: 2026-09-12T00:00:00Z
source: REDESIGN.md §3 (retired), .env.example, src/lib/crypto.ts, src/db/credentialsRepository.ts, README, CONTRIBUTING.md
---

# Repository Hygiene

- **No secret ever enters the repository** — CI runs gitleaks over full history; the GitHub repo has Secret Scanning and Push Protection enabled, plus Dependabot. `.env*` files are gitignored except `.env.example` (empty values only).
- **`VITE_` variables are public.** They are embedded into the deployed JavaScript. Adding a new one requires explicit PR review (CONTRIBUTING.md).
- `dist/` build output is never committed (gitignored on every branch).

# Runtime Credentials

- API keys/tokens are **user-entered in the app** and stored in exactly one place: the `credentials` table (web: IndexedDB; desktop: Stronghold Vault — see [Desktop App](/operations/desktop-app.md)). There are deliberately **no per-game token copies** (the v1 structure that forced export "sanitizing" code is gone).
- `credentialsRepository` is the only module allowed to read/write secrets. Export/backup code paths must never import it; `plaintextLeak.test.ts` proves at the local-download and Drive-upload boundaries that no plaintext story text, settings, or credentials cross the boundary.
- There is intentionally **no Google API key** in this app — only an OAuth client id for Drive (see [Google APIs](/integrations/google-apis.md)).

# Embedded Values

| Value | Where | Protection |
|-------|-------|------------|
| `VITE_GOOGLE_CLIENT_ID` (web) | public build | Not secret by design; restricted to the app's origins in Google Cloud Console. |
| Desktop Google OAuth client secret | `.env.tauri` → compiled into the desktop binary | Installed apps cannot keep a secret; scope is limited to `drive.file`. Never commit the values; treat built binaries accordingly. |

# Backups Are Always Encrypted

Every backup path (local `.nsbak` download and Google Drive) wraps all data in the `ns-backup` envelope: PBKDF2-SHA256 (600,000 iterations) → AES-GCM-256, WebCrypto only. **No unencrypted backup path exists** — this is a design invariant, not a default. Details: [Backup & Restore](/features/backup-restore.md).

# Threat Model (honest wording)

- **Web**: IndexedDB contents are readable by the same user via DevTools. The browser's Same-Origin Policy protects data from *other* sites, but not from the user's own browser — that is the honest protection level of a client-side app. The desktop Vault's difference is that no plaintext credential file ever rests on disk.
- **Desktop**: the Stronghold Vault defeats file inspection and off-machine reads; bulk data (stories, images) relies on the OS user-account boundary. Same-account processes are outside the protection boundary. Details: [Desktop App](/operations/desktop-app.md).
- Documentation must never claim more protection than this (the "honest disclosure" rule — no misleading "app-side encryption" phrasing for bulk data).
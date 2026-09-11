# Narrative Sprout

An AI-powered interactive visual novel that runs entirely in your browser. You provide a theme — the AI writes branching scenes, draws illustrations, and remembers the story as it grows.

- **Client-side only**: there is no game server. Your save data stays in your browser (IndexedDB). Data leaves your device only when you export it or enable encrypted cloud backup.
- **Your own API keys**: text and image generation use API keys you enter in the app. Keys are stored locally and are never bundled with this repository or the public site.
- **Offline capable**: installable as a PWA.

> **Note for v1 players**: This is a clean rebuild ("2.0"). Save data from the legacy app is not compatible. If you played the legacy version, export your stories from it before switching. The legacy codebase is archived for reference.

## Development

Prerequisites: [Bun](https://bun.sh/)

```sh
bun install
bun dev           # local dev server
bun test          # unit tests (bun test + happy-dom)
bun run test:e2e  # end-to-end tests (Playwright, chromium + webkit)
bun run lint      # ESLint
bun run build     # type-check + production build
```

Copy `.env.example` to `.env.local` and fill in values for local development. **Never commit real keys** — see [CONTRIBUTING.md](CONTRIBUTING.md).

## Testing

- **Unit tests** (`bun test`) colocate with sources (`*.test.ts`). IndexedDB-backed tests run against fake-indexeddb; LLM/Drive code is tested with stubbed network.
- **E2E tests** (`bun run test:e2e`) drive the real app in Chromium and WebKit: title/setup/load/settings smoke, route guards, save/branch/wipe deletions, and a mocked-LLM two-turn playthrough. First run needs browsers: `bunx playwright install chromium webkit`. No real API keys or network are used — the LLM endpoint is mocked and fixtures are seeded straight into IndexedDB.
- Details: `knowledge/operations/testing.md`.

## Backup & Restore

- **Download backup** creates an encrypted `.nsbak` file: every save plus your non-secret settings, wrapped in a `ns-backup` envelope (PBKDF2-SHA256, 600,000 iterations → AES-GCM 256, WebCrypto only). There is deliberately **no unencrypted backup path**.
- **Restore from file** decrypts a `.nsbak` with its passphrase and merges the records back by id. Restore refuses files from newer format versions instead of guessing (non-destructive policy).
- **Import ns-save ZIP** re-imports a single exported save (`ns-save` format).
- **Google Drive** uploads/downloads the same encrypted envelope to a `NarrativeSproutBackup` folder in your Drive. Only the encrypted envelope ever leaves the device — API keys are structurally excluded from backups.

**Losing the passphrase means losing the backup.** There is no recovery mechanism; this is by design.

## Google Drive setup

The Drive backup uses Google Identity Services (OAuth implicit token flow) and needs one embedded value: an OAuth **client id** (there is intentionally no Google API key in this app).

1. Open [Google Cloud Console](https://console.cloud.google.com/) → create (or pick) a project.
2. **APIs & Services → Library**: enable **Google Drive API**.
3. **APIs & Services → OAuth consent screen**: External, add the scope `https://www.googleapis.com/auth/drive.file`.
4. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**
   - **Authorized JavaScript origins**: your exact origins, e.g. `https://narrative-sprout.pages.dev`, `http://localhost:5173` (and your Cloudflare preview domains if you want to test them)
   - No redirect URI is needed (token flow).
5. Put the client id (`…apps.googleusercontent.com`) into `VITE_GOOGLE_CLIENT_ID` for local development, and into the Pages environment variables for production.

The client id is embedded in the public build by design; restricting it to your origins is what protects it from being reused elsewhere. The Drive access token is kept in memory only and never persisted.

### Desktop app variant

The desktop build needs a **Desktop** application-type OAuth client (same project) instead of the web client above, because consent runs in the OS browser against a temporary localhost server. Google requires the client secret at the token endpoint even for Desktop clients.

1. **APIs & Services → Credentials → Create credentials → OAuth client ID**: Application type **Desktop app**. No redirect URI registration is needed (any localhost port is allowed).
2. Create `.env.tauri` next to `package.json` (gitignored — never commit it) with the two values:
   - `VITE_GOOGLE_CLIENT_ID_TAURI=` — the Desktop client id
   - `VITE_GOOGLE_CLIENT_SECRET_TAURI=` — its client secret
3. Rebuild the app. Without these, the desktop build falls back to `VITE_GOOGLE_CLIENT_ID`, which fails at the token exchange.

The Desktop client secret is embedded in the desktop build by design (installed apps cannot keep a secret). It authorizes only the narrow `drive.file` scope and cannot touch billing — but treat the built binary accordingly and never put the values in the repository (`.env.example` stays empty).

## Desktop app (Tauri)

The same codebase builds a Windows desktop app from `main` (no separate branch — `src-tauri/` lives alongside the web app; only build outputs are ignored).

```sh
bun run tauri:dev    # Vite dev server in `--mode tauri` + Tauri window
bunx tauri build     # NSIS installer (frontend built with PWA disabled)
```

Notes:

- **Credentials**: API keys/tokens are kept in an encrypted Stronghold Vault, unlocked by a random password in the OS credential store — never as plaintext files. Bulk data (stories, images) is protected by the OS user account boundary, like other desktop apps.
- **OAuth** (OpenRouter key setup, Google Drive) opens the OS browser and returns through a temporary localhost server; consent never happens inside the app window.
- **Files**: OS-level drag & drop onto the window works for attachments and save imports; fonts/images ship as native resources instead of web assets.
- **Single instance**: launching twice focuses the first window instead of starting a second process.
- The honest threat model (what the Vault does and does not protect against) is documented in `REDESIGN.md` §3.4 — same-account processes are outside the protection boundary.

## Security

- API keys you enter in the app are stored separately from game settings and are excluded from exports and backups by default. On the web they live in IndexedDB; on desktop in the encrypted Stronghold Vault (see above). Optional cloud backups are always encrypted with your passphrase (AES-GCM via WebCrypto).
- The public site is built from this repository by Cloudflare Pages; build artifacts are never committed.
- For the honest threat model of local data storage, see the design document (`REDESIGN.md` §3).

## Documentation

- Design decisions: `REDESIGN.md`
- Contributor rules: `CONTRIBUTING.md`
- AI-agent conventions: `AGENTS.md`
- Knowledge base (architecture, features, services, data models): `knowledge/` — start at `knowledge/index.md`

## License

MIT — see `LICENSE`.

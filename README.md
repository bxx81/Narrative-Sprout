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
bun dev        # local dev server
bun test       # run tests
bun run build  # type-check + production build
```

Copy `.env.example` to `.env.local` and fill in values for local development. **Never commit real keys** — see [CONTRIBUTING.md](CONTRIBUTING.md).

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

## Security

- API keys you enter in the app are stored separately from game settings and are excluded from exports and backups by default. Optional cloud backups are always encrypted with your passphrase (AES-GCM via WebCrypto).
- The public site is built from this repository by Cloudflare Pages; build artifacts are never committed.
- For the honest threat model of local data storage, see the design document (`REDESIGN.md` §3).

## Documentation

- Design decisions: `REDESIGN.md`
- Contributor rules: `CONTRIBUTING.md`
- AI-agent conventions: `AGENTS.md`
- Knowledge base (architecture, features, services, data models): `knowledge/` — start at `knowledge/index.md`

## License

MIT — see `LICENSE`.

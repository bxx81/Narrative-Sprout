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

## Security

- API keys you enter in the app are stored separately from game settings and are excluded from exports and backups by default. Optional cloud backups are always encrypted with your passphrase (AES-GCM via WebCrypto).
- The public site is built from this repository by Cloudflare Pages; build artifacts are never committed.
- For the honest threat model of local data storage, see the design document (`REDESIGN.md` §3).

## Documentation

- Design decisions: `REDESIGN.md`
- Contributor rules: `CONTRIBUTING.md`
- AI-agent conventions: `AGENTS.md`

## License

MIT — see `LICENSE`.

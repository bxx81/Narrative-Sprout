# Contributing

Thanks for your interest! A few project-specific rules matter more than usual here — please read before opening a PR.

## Security rules (required)

- **Never commit secrets.** API keys, tokens, `.env` files. CI runs gitleaks and GitHub Secret Scanning is enabled; commits containing secrets will be rejected and must be purged from history.
- **`VITE_*` environment variables are public.** They are embedded into the deployed JavaScript and readable by anyone. Adding a new `VITE_` variable requires explicit PR review discussion. If a value must stay secret, it cannot be a `VITE_` variable — it belongs in the app's user-entered credentials store instead.
- User credentials (API keys entered in the app) must never flow into exports, backups, or logs in plaintext. Backups that include credentials must be encrypted (see REDESIGN.md §3.3).

## Code rules

- Follow `AGENTS.md` (naming glossary, Zod rules, Zustand discipline, asset handling).
- This project does **not** carry compatibility with the legacy v1 save formats; do not add converters for them.

## Checks

CI runs: ESLint, `tsc --noEmit`, `bun test`, Prettier check, gitleaks. Please run `bun run lint` and `bun test` before pushing.

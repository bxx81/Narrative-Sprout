# AGENTS.md — Narrative Sprout

Guidance for AI coding agents (and humans) working in this repository.
Design rationale, architecture, and the security/threat model live in the `knowledge/` bundle (start at `knowledge/index.md`); this file is the working rulebook.

**Knowledge base**: `knowledge/` contains a structured knowledge bundle (OKF) describing the project — architecture, features, services, data models, integrations, configuration, and operations. Start from `knowledge/index.md` and consult the relevant pages before working on unfamiliar areas.

## Project shape

- React 19 + Vite 7 + Tailwind CSS 4 + TypeScript, runtime/tooling via Bun.
- Persistence: IndexedDB via Dexie (`src/db/`). No OPFS, no json.gz files.
- State: Zustand (`src/store/`). No React Context for app state.
- Validation: Zod v4. Schemas live next to types in `src/types/`.
- PWA via `vite-plugin-pwa`. Deployed by Cloudflare Pages (Git integration).
- Static files live in `public/` (Vite default). Cloudflare Pages Functions, if ever needed, live in `functions/` at repo root — nowhere else is recognized.

## Hard rules (do not violate)

1. **No secrets in the repo.** No API keys, tokens, `.env*` files (except `.env.example` with empty values). gitleaks runs in CI.
2. **No build output in the repo.** `dist/` is gitignored on every branch.
3. **Secrets never enter save data, exports, or backups as plaintext.** User credentials live only in the `credentials` store (see `knowledge/overview/security.md`). Export/backup code paths must not be able to reach them.
4. **Zod**: never use `.catch()` / `.default()` on record or array schemas as a whole — validate element-wise with `safeParse`, skip failures with a warning log. Migration code always runs _before_ `safeParse` (Zod strips unknown keys).
5. **Zustand discipline**: components and features must not call `set` directly. All state changes go through action functions defined in the corresponding slice. Do not use the `persist` middleware — persistence is IndexedDB only.
6. **Naming**: follow the glossary in `knowledge/overview/glossary.md` (Game / StoryNode / Scene / Memory / Asset / Credential). No generic names (`data`, `info`, `item`). No abbreviations. ID fields name their target (`parentNodeId`, not `parentId`).
7. **Image assets**: keyed 1:1 by `nodeId`. Node deletion and asset deletion happen in one transaction. Never hardcode the string `".webp"` — derive extensions from `imageFileExtensions`.
8. **Old-version compatibility code is not allowed.** No importers/converters for the legacy (v1) on-disk formats.

## Commands

- `bun dev` — dev server
- `bun test` — unit tests (bun test + happy-dom; `e2e/` excluded via `--path-ignore-patterns`)
- `bun run test:e2e` — E2E tests (Playwright, chromium + webkit; needs `bunx playwright install chromium webkit`)
- `bun run build` — `tsc --noEmit` + production build
- `bun run lint` — ESLint

## Conventions

- Feature modules under `src/features/<name>/` expose only their `api.ts`; internals stay private.
- New `VITE_` env vars require PR review: they are embedded in the public build.
- Async operations in the UI store use the `AsyncOperation<TPayload, TResult>` union (`knowledge/data-model/state-management.md`) — no ad-hoc `*_PENDING` flags.
- **E2E**: specs live in `e2e/` with shared helpers in `e2e/helpers/` (`seed.ts`, `mockLlm.ts`). No external network — mock the LLM endpoint, seed IndexedDB directly, use the dummy key `sk-or-test`. Each test gets a fresh browser context (empty IndexedDB). Scope confirm-dialog buttons to `getByRole("dialog")` and use `exact: true` where labels collide.

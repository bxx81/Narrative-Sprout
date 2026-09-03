---
type: Playbook
title: Development Setup (v2)
description: Dev environment, repository layout, and daily workflow for Narrative Sprout v2.
tags: [dev, setup, workflow]
timestamp: 2026-09-03T00:00:00Z
source: package.json, README, CONTRIBUTING.md, AGENTS.md, SESSION_HANDOFF.md, scripts/
---

# Overview

Prerequisites: [Bun](https://bun.sh/) 1.4.0 (see [Environment Configuration](/configuration/environment.md) for the 3-place pin) + a modern browser. No Rust/Tauri toolchain needed on `main` (Phase 7 lives on its own branch).

```sh
git checkout main && git pull
bun install
bun dev        # local dev server (HMR)
bun test       # unit tests
bun run lint   # ESLint
bun run build  # tsc --noEmit + production build
bun run update:icons  # regenerate the Material Symbols icon font subset (see below)
```

# Repository Layout

```
src/
  app/            # entry, router (ROUTES), providers (Confirmation, layout)
  screens/        # Title/ThemeSetup/Starting/Load/Game/History/Chronicle/Settings/DeletionComplete
  components/     # ui/* shared parts, game/*, settings/*, StoryCard/AttachmentPreview/BackupSection/ErrorDialog
  features/       # narrative/image/storytree/attachments/gameplay/export/backup/i18n/autoplay/memory/theme/openrouter (+ api.ts each)
  store/          # gameStore (+ AsyncOperation), streamStore
  db/             # database, game/asset/settings/credentials/restore/wipe repositories, migrations
  lib/            # crypto, openAiClient, modelOptions, errorClassification, debugLog, image utils
  types/          # ids/game/scene/asset/credential/settings (+ Zod schemas)
  hooks/          # navigation, lazy images, confirm, breakpoint, fullscreen, …
public/           # icons, images (title art per aspect), s/ (fonts + css)
scripts/          # maintenance scripts (update-icon-font.ts)
knowledge/        # this OKF bundle
functions/        # reserved for Pages Functions (absent until needed)
```

Feature modules expose only `api.ts`; `gameplay/` is the exception (orchestrator `turnService.ts`, no `api.ts`).

# Workflow Rules

- `main` stays deployable. Work on `feature/*` branches → PR → squash merge. PRs get Cloudflare preview URLs.
- **Git operations (commit/push/PR/merge) always need the user's explicit approval each time.**
- New `VITE_` env vars need PR review (public build embedding).
- Follow `AGENTS.md` hard rules: no secrets, no `dist/`, no plaintext credentials in export/backup, element-wise Zod, no direct Zustand `set`, glossary naming, 1:1 nodeId assets, no v1 format importers.
- Design rationale: `REDESIGN.md`. Session state: `SESSION_HANDOFF.md` (read both before starting work, after `git pull`).

# Icon Font Subset (`update:icons`)

`bun run update:icons` (`scripts/update-icon-font.ts`) regenerates the self-hosted Material Symbols Rounded subset at `public/s/font.woff2`. Run it after adding or removing entries in the `IconName` union in `src/components/ui/Icon.tsx` — that union is the single source of truth for the icon set.

1. Extracts icon names from the `IconName` union (deduplicated, sorted alphabetically — sorting the names is required) and builds the Google Fonts CSS2 query `family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,300,0,0&icon_names=<names>`.
2. Fetches the CSS with a modern browser `User-Agent` header (required, otherwise Google does not answer with WOFF2).
3. Extracts the font URL from the CSS via `format('woff2')` — subset URLs look like `https://fonts.gstatic.com/l/font?kit=…` and have no `.woff2` extension.
4. Downloads it and overwrites `public/s/font.woff2`.

Notes:

- The script only *reads* `Icon.tsx`; it never rewrites it. Keep the union tidy manually.
- Axis settings in the query (`@24,300,0,0`) must stay in sync with the static `@font-face` in `public/s/icons.css` (which always points at `/s/font.woff2`, weight 300). The generated CSS is discarded — only the font bytes are saved.
- Network-dependent. Exits non-zero and prints the response body on failure.
- `scripts/` is outside `tsconfig.json`'s `include`; the script declares a minimal local `Bun` type instead of relying on `bun-types`.

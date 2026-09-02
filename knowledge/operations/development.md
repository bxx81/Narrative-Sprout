---
type: Playbook
title: Development Setup (v2)
description: Dev environment, repository layout, and daily workflow for Narrative Sprout v2.
tags: [dev, setup, workflow]
timestamp: 2026-09-02T00:00:00Z
source: package.json, README, CONTRIBUTING.md, AGENTS.md, SESSION_HANDOFF.md
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

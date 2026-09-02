---
type: Reference
title: Narrative Sprout v2 — Project Overview
description: An AI-driven interactive visual novel game that runs in the browser (v2 clean rebuild). Players input a theme and the AI generates branching narratives, images, and choices in real time.
tags: [overview, visual-novel, ai-game]
timestamp: 2026-09-02T00:00:00Z
source: README, package.json, REDESIGN.md
---

Narrative Sprout v2 is a client-side, AI-powered interactive visual novel and a **clean rebuild** of the legacy v1 app. There is no server — everything runs in the user's browser. The game uses a minimal fetch-based `OpenAiCompatibleClient` to call LLM APIs (defaulting to [OpenRouter](https://openrouter.ai/)) for text generation, and supports multiple backends for image generation.

v2 keeps v1's features and look but redesigns internals: IndexedDB persistence instead of OPFS gzip files, Zustand instead of useReducer + Context, strict naming glossary, and mandatory backup encryption. **Save data is not compatible with v1** (see [Data Migration](/operations/data-migration.md)).

# Key Features

- **AI narrative generation**: The LLM writes each scene as literary prose with branching choices (three per turn).
- **AI image generation**: Each scene is accompanied by a generated illustration. Supports cloud (Hugging Face Spaces, NVIDIA NIM) and local (AUTOMATIC1111, ComfyUI) backends.
- **Branching story tree**: Every choice creates a new node. Players can rewind, branch, redo, refine, and explore alternate paths within the same playthrough.
- **Attachment system**: Players can attach text/markdown scenario files (YAML front matter), `.b64` files, and images as source material. The AI uses these as the primary world-building reference.
- **Long-term memory**: The AI maintains persistent `notes` (key-value store) and a `storyLog` (array of scene summaries, periodically compacted) across turns for narrative consistency.
- **IndexedDB persistence**: All save data, settings, images, and credentials are stored in IndexedDB via Dexie. Data never leaves the device unless the user exports or enables encrypted backup.
- **Encrypted backup**: Local `.nsbak` download and Google Drive backup are always AES-GCM encrypted with a user passphrase. There is no unencrypted backup path.
- **i18n**: 5 built-in languages, plus AI-powered dynamic translation to any language.
- **Streaming**: Live scene-text display during generation, with per-model opt-out.
- **Autoplay**: A player-AI can play turns on its own, with its reasoning chain persisted per node.
- **PWA**: Fully offline-capable, installable as a standalone app in the browser.

# Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | [Bun](https://bun.sh/) 1.4.0 (pinned in `packageManager` / `.bun-version` / Pages `BUN_VERSION`) |
| Framework | [React 19](https://react.dev/) |
| Build | [Vite 7](https://vite.dev/) |
| Styling | [Tailwind CSS v4](https://tailwindcss.com/) |
| AI SDK | Custom fetch-based `OpenAiCompatibleClient` (OpenAI-compatible) |
| Validation | [Zod](https://zod.dev/) v4 (full bundle, element-wise validation) |
| Persistence | [Dexie.js](https://dexie.org/) (IndexedDB) |
| State | [Zustand](https://zustand.docs.pmnd.rs/) v5 |
| Routing | [React Router](https://reactrouter.com/) v7 |
| i18n | [i18next](https://www.i18next.com/) (bundled locales, no http-backend) |
| Web (PWA) | [Cloudflare Pages](https://pages.cloudflare.com/) — also installable as offline-capable PWA. |
| Desktop (Tauri) | Planned for Phase 7 (own branch, stronghold for credentials). Not started. |

# Live Site

[https://narrative-sprout.pages.dev/](https://narrative-sprout.pages.dev/)

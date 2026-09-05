---
okf_version: "0.1"
title: Narrative Sprout Knowledge Bundle (v2)
description: A complete OKF knowledge bundle describing the Narrative Sprout v2 clean rebuild — architecture, features, services, data models, integrations, configuration, operations, and references.
timestamp: 2026-09-04T00:00:00Z
---

# Overview

* [Project Overview](overview/project-overview.md) — High-level project description and tech stack.
* [Architecture](overview/architecture.md) — Application architecture, state flow, and design decisions.

# Features

* [Game Loop](features/game-loop.md) — Core game lifecycle, states, and turn flow.
* [Narrative Generation](features/narrative-generation.md) — AI narrative generation, model configuration, memory strategies.
* [Streaming](features/streaming.md) — SSE streaming delivery, display store, per-model opt-out.
* [Autoplay](features/autoplay.md) — Player-AI auto-play with persisted reasoning chain.
* [Image Generation](features/image-generation.md) — Scene image generation, backends, and configuration.
* [Attachment System](features/attachment-system.md) — File attachments, scenario front matter, random choice.
* [History & Saves](features/history-and-saves.md) — Save/load, branching, rewind, redo, chronicle.
* [Scene Correction (Refine)](features/scene-correction.md) — AI-driven scene refinement, redo, manual editing.
* [Conditional Text (Flag-Gated Disclosure)](features/conditional-text.md) — Flag-based disclosure of theme and attachment content.
* [Theme Generation](features/theme-generation.md) — AI-generated theme ideas (Generate Idea).
* [Sound Effects](features/sound-effects.md) — UI chimes for generation completion, toasts, and the error dialog.
* [Wake Lock](features/wake-lock.md) — Screen wake lock during generation, autoplay, translation, image regeneration, and backup/Drive transfers.
* [Settings System](features/settings-system.md) — All user-configurable settings and developer options.
* [Story Export (ns-save)](features/story-export.md) — Single-save ZIP export and re-import.
* [Backup & Restore (ns-backup)](features/backup-restore.md) — Encrypted backup envelope and restore.

# Services

* [Storage Service](services/storage-service.md) — IndexedDB (Dexie) persistence for games, nodes, assets, settings.
* [LLM Service](services/llm-service.md) — OpenAI-compatible client, model options, streaming transport, PKCE auth.
* [Google Drive Integration](services/google-drive.md) — Encrypted cloud backup and restore.
* [Error Handling](services/error-service.md) — Error classification, dialog, retry, 429 auto-retry.

# Data Model

* [GameState & Records](data-model/game-state.md) — Core persisted records: Game, StoryNode, Asset, Credential, Settings.
* [Scene Structure](data-model/scene.md) — Scene, MemoryState, MemoryDelta, and the wire format.
* [State Management](data-model/state-management.md) — Zustand store, AsyncOperation, streaming store, turn orchestration.

# Integrations

* [AI Providers](integrations/ai-providers.md) — LLM provider configuration and OpenRouter details.
* [Image Generator Backends](integrations/image-generators.md) — Hugging Face, A1111, ComfyUI, NVIDIA NIM.
* [Google APIs](integrations/google-apis.md) — Google Drive and OAuth integration.

# Configuration

* [Build System](configuration/build-system.md) — Vite, TypeScript, chunk splitting, and build toolchain.
* [Environment Configuration](configuration/environment.md) — Environment variables and deployment.
* [PWA Setup](configuration/pwa-setup.md) — Progressive Web App, service worker, offline.
* [Linting & Code Quality](configuration/linting.md) — ESLint, Prettier, gitleaks.
* [Localization](configuration/localization.md) — i18n, built-in languages, AI translation, fonts.

# Operations

* [Development Setup](operations/development.md) — Dev environment, workflow, and scripts.
* [Testing Strategy](operations/testing.md) — Test framework, conventions, and CI.
* [Build & Deploy](operations/build-and-deploy.md) — Production build and Cloudflare Pages deployment.
* [Data Migration](operations/data-migration.md) — Schema versions, migration chain, validation policy.

# References

* [Key Dependencies](references/key-dependencies.md) — Major third-party libraries.
* [External API Reference](references/external-apis.md) — All external API endpoints.
* [Asset Inventory](references/asset-inventory.md) — Images, fonts, icons, and locales.

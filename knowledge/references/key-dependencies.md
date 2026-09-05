---
type: Reference
title: Key Dependencies (v2)
description: Major third-party libraries used by Narrative Sprout v2.
tags: [dependencies, libraries]
timestamp: 2026-09-05T00:00:00Z
source: package.json, bun.lock
---

# Runtime

| Package | Version | Purpose |
|---------|---------|---------|
| react / react-dom | 19.x | UI framework. |
| react-router | 8.x | Route-based screens + `RequireActiveGame` guards. |
| zustand | 5.x | App store (`devtools` + `subscribeWithSelector`; no `persist`). |
| dexie | 4.x | IndexedDB wrapper (5-table schema, transactions). |
| zod | 4.x | Schemas + `z.infer` types + `z.toJSONSchema` for structured outputs (full bundle; mini rejected, see [Build System](/configuration/build-system.md)). |
| i18next / react-i18next | 26.x / 17.x | UI localization with bundled resources (no http-backend). |
| react-hot-toast | 2.6.0 | Toast notifications. |
| fflate | 0.8.x | ZIP build/parse for `ns-save` and backup payloads. |
| yaml | 2.x | Scenario front-matter parsing. |
| @gradio/client | 2.5.x | Hugging Face Spaces image backend (lazy import). |

# Development

| Package | Purpose |
|---------|---------|
| typescript | 7.x native (`@typescript/native` = `typescript@7`, Go port) provides `tsc` used in build + CI (`tsc --noEmit`, strict). JS-based `typescript` 6.x (`@typescript/typescript6`) is kept aliased for API consumers like typescript-eslint. |
| vite | 7.x build + dev server. |
| @vitejs/plugin-react | 5.x React plugin for Vite. |
| @tailwindcss/vite / tailwindcss | v4 styling. |
| vite-plugin-pwa | 1.x manifest + service worker. |
| eslint / @eslint/js / typescript-eslint | Lint (+ record/array `.catch()` ban). |
| prettier | Formatting (`format:check` in CI). |
| fake-indexeddb | Dexie tests under `bun test`. |
| happy-dom | DOM for hook/component tests. |
| bun-types | Bun runtime types. |

No OpenAI SDK (custom client), no `gapi-script` (dynamic GIS), no Tauri packages on `main` (Phase 7 branch).

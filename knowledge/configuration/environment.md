---
type: Configuration
title: Environment Configuration (v2)
description: Environment variables, Bun pinning, and deployment targets of Narrative Sprout v2.
tags: [env, config, deploy, bun]
timestamp: 2026-09-02T00:00:00Z
source: .env.example, package.json, .bun-version, vite.config.ts, README
---

# Overview

Only one `VITE_` variable exists; it is embedded in the public build by design and restricted by origin, not secrecy.

| Variable | Purpose | Secret? |
|----------|---------|---------|
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth client id for Drive backup (token flow, no redirect URI). | No — but must be origin-restricted in Google Cloud Console (see README "Google Drive setup"). |

Copy `.env.example` → `.env.local` for local dev. **Never commit real values** (`.env*` gitignored except `.env.example`; gitleaks + Secret Scanning enforced). Adding a new `VITE_` variable requires explicit PR review (CONTRIBUTING.md).

# Bun Pinning

Bun **1.4.0** is pinned in three places that must agree: `package.json#packageManager` (`bun@1.4.0`), `.bun-version` (`1.4.0`), and the Pages `BUN_VERSION` environment variable. `.gitattributes` enforces LF line endings.

# Deployment

Cloudflare Pages with Git integration: push to `main` → production build from source (`bun run build` → `dist/`); PRs get preview URLs. `dist/` is gitignored on every branch and never committed. Branch strategy: `main` always deployable; work on `feature/*` → PR → squash merge. Cloudflare Pages Functions, if ever needed, live in repo-root `functions/` (not present yet). Static files live in Vite-standard `public/`.

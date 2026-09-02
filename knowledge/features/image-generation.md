---
type: Feature
title: Image Generation
description: Scene image generation with pluggable backends, WebP storage, and per-node regeneration in v2.
tags: [image, webp, generators]
timestamp: 2026-09-02T00:00:00Z
source: src/features/image/generateImage.ts, buildImageGenConfig.ts, assetHelpers.ts, imageGeneratorFactory.ts, generators/
---

# Overview

Every generated scene carries an English `imagePrompt` (+ optional `negativeImagePrompt`). `generateSceneImage` renders it through the configured backend, returning a data URL that is converted to WebP and stored in the `assets` table keyed 1:1 by node id.

# Backends

Selected by `settings.imageGenerator`; config comes from `buildImageGenConfig(settings, tokens)`:

| Backend | Setting | Description |
|---------|---------|-------------|
| Disabled | `disabled` (default) | No network call — the turn flow skips generation entirely; the UI layer renders a transparent placeholder. (`DisabledImageGenerator.generate` itself returns the fallback SVG but is never reached.) |
| Hugging Face Spaces | `huggingface` | Cloud Space (`huggingFaceSpaceId`, default `mrfakename/Z-Image-Turbo`) via `@gradio/client`, lazily imported. Token from `credentials`. |
| AUTOMATIC1111 | `a1111` | Local endpoint (default `http://127.0.0.1:7860`) + config JSON (`steps`, `sampler_name`, `cfg_scale`, `width`/`height`, `{prompt}` / `{negative_prompt}` placeholders). Progress callback for the loading bar. |
| ComfyUI | `comfyui` | Local endpoint (default `http://127.0.0.1:8188`) + workflow JSON (`##prompt##` / `##negative_prompt##` placeholders). Workflow queued via POST `/prompt`; progress/execution tracked over a WebSocket (`/ws?clientId=…`), not polling. Progress callback. |
| NVIDIA NIM | `nvidia_nim` | Cloud endpoint (Flux default) + config JSON. Token from `credentials`. |

Per-generator timeouts abort with descriptive errors; any failure falls back to a "Image Generation Failed" SVG (regenerable) instead of failing the turn. The image prompt follows a 4-step recipe (decisive instant, cinematic framing, in-frame only, atmosphere) consistent with `char:*` + `status:*` memory.

# Storage

`assetRecordFromDataUrl(nodeId, dataUrl, quality)` converts to WebP at `webpQualityForCompression(compression)` (`normal` → 0.9, `high` → 1.0); small WebPs already under ~100 KB pass through. `mimeType` is always `image/webp` today; extensions are derived from `imageFileExtensions`, never hardcoded (see [Storage Service](/services/storage-service.md)).

# Regeneration

`regenerateImage(nodeId)` re-renders the same scene's `imagePrompt` and overwrites the same asset key (`updatedAt` bumped), tracked as `imageRegeneration: AsyncOperation`. A1111/ComfyUI report progress % into `imageGenerationProgress`. The loading overlay follows `generationStage === "image"`.

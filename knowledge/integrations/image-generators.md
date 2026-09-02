---
type: Integration
title: Image Generator Backends (v2)
description: Hugging Face Spaces, AUTOMATIC1111, ComfyUI, NVIDIA NIM, and disabled backends in v2.
tags: [image, backends, hf, a1111, comfyui, nim]
timestamp: 2026-09-02T00:00:00Z
source: src/features/image/generators/, imageGeneratorFactory.ts, buildImageGenConfig.ts
---

# Overview

`imageGeneratorFactory` builds one of five generators from `settings.imageGenerator`. Tokens come from `credentials` (HF/NIM); endpoints/configs from global settings. Generation returns a data URL → WebP asset (see [Image Generation](/features/image-generation.md)).

| Backend | Effort | Cost | GPU | Notes |
|---------|--------|------|-----|-------|
| Hugging Face Spaces (cloud) | Easy | Free tier varies | None local | Space id + config JSON; `@gradio/client` lazily imported. |
| AUTOMATIC1111 (local) | Medium | Free | Local GPU | Endpoint + config JSON (`steps/sampler_name/cfg_scale/width/height`, `{prompt}` placeholders); progress callback. |
| ComfyUI (local) | Medium | Free | Local GPU | Endpoint + workflow JSON (`##prompt##` placeholders); `/prompt` polling; progress callback. |
| NVIDIA NIM (cloud) | Easy | Key required | None local | Endpoint + config JSON; Bearer token. |
| Disabled | — | — | — | Transparent placeholder; no network. |

# Flow

`generateSceneImage({ imagePrompt, negativeImagePrompt, config, onProgress, signal })` → backend data URL → `assetRecordFromDataUrl` (WebP) → stored under the node id. Failures yield the fallback SVG (turn still succeeds; image is regenerable). Per-generator timeouts abort with descriptive errors; user Stop aborts via the stream signal.

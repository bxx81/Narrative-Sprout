---
type: Feature
title: Image Generation
description: Scene image generation with pluggable backends, WebP storage, and per-node regeneration in v2.
tags: [image, webp, generators]
timestamp: 2026-09-08T00:00:00Z
source: src/features/image/generateImage.ts, buildImageGenConfig.ts, assetHelpers.ts, imageGeneratorFactory.ts, generators/
---

# Overview

Every generated scene carries an English `imagePrompt` (+ optional `negativeImagePrompt`). `generateSceneImage` renders it through the configured backend, returning a data URL that is converted to WebP and stored in the `assets` table keyed 1:1 by node id.

# Backends

Selected by `settings.imageGenerator`; config comes from `buildImageGenConfig(settings, tokens)`:

| Backend | Setting | Description |
|---------|---------|-------------|
| Disabled | `disabled` (default) | No network call — the turn flow skips generation entirely; the UI layer renders a transparent placeholder. (`DisabledImageGenerator.generate` itself returns the fallback SVG but is never reached.) A failed generation ends in exactly the same state (no asset stored). |
| Hugging Face Spaces | `huggingface` | Cloud Space (`huggingFaceSpaceId`, default `mrfakename/Z-Image-Turbo`) via `@gradio/client`, lazily imported. Token from `credentials`. |
| AUTOMATIC1111 | `a1111` | Local endpoint (default `http://127.0.0.1:7860`) + config JSON (`steps`, `sampler_name`, `cfg_scale`, `width`/`height`, `{prompt}` / `{negative_prompt}` placeholders). Progress callback for the loading bar. |
| ComfyUI | `comfyui` | Local endpoint (default `http://127.0.0.1:8188`) + workflow JSON (`##prompt##` / `##negative_prompt##` placeholders). Workflow queued via POST `/prompt`; progress/execution tracked over a WebSocket (`/ws?clientId=…`), not polling. Progress callback. |
| NVIDIA NIM | `nvidia_nim` | Cloud endpoint (Flux default) + config JSON. Token from `credentials`. |

Per-generator timeouts abort with descriptive errors. The image prompt follows a 4-step recipe (decisive instant, cinematic framing, in-frame only, atmosphere) consistent with `char:*` + `status:*` memory.

# Failure handling

A failed image generation never fails the turn and never stores an asset — byte-for-byte the Disabled-backend state (see [Image Generator Backends](/integrations/image-generators.md)):

| Surface | Behaviour |
|---------|-----------|
| Game screen / zoom overlay | Transparent placeholder (`TRANSPARENT_IMAGE_URL`), identical to the Disabled backend. `ImageDisplay`'s own fallback SVG is reserved for decoding a *stored* blob. |
| Load, History, Chronicle cards | `LOAD_SCREEN_FALLBACK_URL` ("Image Not Available"). `useLazyNodeImage` receives it as `fallbackUrl`, and `applyLoadScreenFallback` on `<img onError>` covers assets that exist but fail to decode. |
| Reporting (in-turn) | `turnService` invokes `options.onImageGenerationFailed(error)` on every image failure for start/choice/refine/redo — user Stop (`AbortError`, or an aborted stream signal) is excluded. gameStore routes it to `notifyImageGenerationFailure` (`features/image/notifications.ts`), which shows a single replaceable toast (`id: image-generation-failed`, so autoplay cannot stack one per turn and the notification chime fires once) with the `imageGenerationFailedToast` headline plus the classified reason truncated to `IMAGE_FAILURE_REASON_MAX_LENGTH`. |
| Reporting (regeneration) | Unchanged: `imageRegeneration` settles `failed` → the retryable `ErrorDialog` (payload retained for Retry / 429 auto-retry). A failed regeneration writes nothing, so a previously generated image survives. |

Stop during the image stage still commits the node with no asset (legacy behaviour): the scene is kept, the image is simply absent and can be regenerated.

# Connectivity Test

The A1111 (`GET /` — the Gradio root always exists), ComfyUI (`GET /system_stats` — lightweight read-only JSON), and NIM (bare generation URL, probed with the Bearer token since `nimEndpoint` is POSTed to as-is) settings panels embed `EndpointConnectionTest` next to the endpoint input, testing the currently typed values. Hugging Face has a fixed Space URL, so its panel embeds `HuggingFaceZeroGpuQuotaTest` instead: the same button shape fetches `GET /api/spaces/zero-gpu/quota` with the typed token (account-level, so it doubles as a token check) and shows the ZeroGPU quota — remaining GPU-seconds, reset time, run window, overquota use. Result classes and local-`AsyncOperation` discipline are shared with the LLM probe (see [Settings System](/features/settings-system.md#connectivity-test)).

# Storage

`assetRecordFromDataUrl(nodeId, dataUrl, quality)` converts to WebP at `webpQualityForCompression(compression)` (`normal` → 0.9, `high` → 1.0); small WebPs already under ~100 KB pass through. `mimeType` is always `image/webp` today; extensions are derived from `imageFileExtensions`, never hardcoded (see [Storage Service](/services/storage-service.md)). SVG data URLs are rejected (return `null` → no asset) as a defensive guard; no code path produces one today.

# Regeneration

`regenerateImage(nodeId)` re-renders the same scene's `imagePrompt` and overwrites the same asset key (`updatedAt` bumped), tracked as `imageRegeneration: AsyncOperation`. A1111/ComfyUI report progress % into `imageGenerationProgress`. The loading overlay follows `generationStage === "image"`.

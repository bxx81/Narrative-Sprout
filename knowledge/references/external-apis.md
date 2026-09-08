---
type: Reference
title: External API Reference (v2)
description: All external API endpoints contacted by Narrative Sprout v2.
tags: [api, endpoints, reference]
timestamp: 2026-09-08T00:00:00Z
source: src/lib/openAiClient.ts, modelOptions.ts, src/features/backup/, src/features/image/generators/, src/features/openrouter/
---

# LLM / Text

| Endpoint | Use |
|----------|-----|
| `https://openrouter.ai/api/v1` (default `--BaseURL`) | Narrator, memory-keeper, archivist, autoplay, AI translation, theme ideas (chat completions, bulk + SSE). |
| Custom `--BaseURL` (any OpenAI-compatible) | Same calls against user endpoints (Ollama/LM Studio/NIM-compatible). |
| `https://openrouter.ai/auth` | PKCE authorization redirect (key auto-setup). |
| OpenRouter code-exchange endpoint | `exchangeCodeForApiKey` (15 s timeout) — callback `?code=&state=`. |
| `https://openrouter.ai/api/v1/models` | Model list for the Settings picker; also the `{baseUrl}/models` connectivity-probe target (Bearer key, 15 s timeout). |

Auth: Bearer API key (`credentials.openrouterApiKey`), except PKCE round-trip. Attribution headers (`HTTP-Referer` / `X-OpenRouter-Title` / `X-OpenRouter-Categories`) only on the default base URL.

# Images

| Endpoint | Use |
|----------|-----|
| Per-Space URL from `huggingFaceSpaceId` | HF Spaces generation via `@gradio/client`. |
| `a1111Endpoint` (default `http://127.0.0.1:7860`) | Local A1111 generation + progress. |
| `comfyuiEndpoint` (default `http://127.0.0.1:8188`) | Local ComfyUI workflow + polling + progress. |
| `nimEndpoint` (Flux default) | NVIDIA NIM generation (Bearer `credentials.nvidiaNimToken`). |

Connectivity probes (Settings, `src/features/connectivity/`): A1111 `GET /`, ComfyUI `GET /system_stats`, NIM bare generation URL — any HTTP answer proves reachability + CORS. HF has no probe (fixed Space URL).

# Google

| Endpoint | Use |
|----------|-----|
| Google Identity Services (`initTokenClient`) | OAuth token flow (scope `drive.file`). |
| `https://www.googleapis.com/drive/v3` | Backup folder/files CRUD. |
| `https://www.googleapis.com/upload/drive/v3` | Multipart `.nsbak` upload. |

Auth: memory-only Bearer token; 401 → reconnect. Only encrypted envelopes transit.

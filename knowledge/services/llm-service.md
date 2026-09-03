---
type: Service
title: LLM Service (OpenAI-Compatible Client)
description: Minimal fetch-based chat client, model-string options, JSON schema handling, streaming transport, and OpenRouter PKCE auth in v2.
tags: [llm, openrouter, client, pkce]
timestamp: 2026-09-02T00:00:00Z
source: src/lib/openAiClient.ts, modelOptions.ts, src/features/narrative/generateScene.ts, src/features/openrouter/pkceAuth.ts
---

# Overview

All LLM traffic (narration, memory-keeper, archivist, autoplay decisions, AI translation, theme ideas) goes through `OpenAiCompatibleClient` (`src/lib/openAiClient.ts`): `createChatCompletion` (bulk) and `createStreamingChatCompletion` (SSE). No OpenAI SDK dependency.

# Client

- **Bulk**: POST chat completions, `ApiError(status, displayMessage)` on HTTP errors (`error.message` extracted when present). Retryable statuses: 429/502/503/504.
- **Streaming**: `stream: true` + `stream_options: { include_usage: true }`, hand-written SSE parser, 60 s idle watchdog after content starts, mid-stream `error` captured and thrown as `ApiError(500, …)` after the stream ends, final reassembly into a normal response. `onDelta` gets accumulated text; abort via `AbortSignal` (`AbortError` → user-abort classification).
- **App headers**: `OPENROUTER_APP_HEADERS` (`HTTP-Referer`, `X-OpenRouter-Title`, `X-OpenRouter-Categories`) sent only for the default base URL, never for custom `--BaseURL`.

# Model Options

Full reference: see [Narrative Generation](/features/narrative-generation.md#model-configuration). `parseTextModelOptions` parses the settings string into `TextModelOptions` (`model`, `baseUrl`, `stream`, `strict`, `maxTokens` default 10240, `timeoutMs` default 600000, sampling fields, `reasoning`, `reasoningEffort`, `kwargsReasoning`, `only`, `isValid`). `buildSamplingParams` maps them onto the request body. `isStreamingEnabledForSettings` ANDs the global toggle with per-model `--stream`.

# Response Formats & Schema Cleaning

- `--strict=true` (default): `response_format: { type: "json_schema", json_schema: { name, schema, strict: true } }`.
- `--strict=false`: `response_format: { type: "json_object" }` + schema text (`buildSchemaPromptText`) appended to the system prompt.
- `cleanJsonSchemaForStructuredOutputs` recursively strips `propertyNames` (zod v4 emits it for `z.record`, e.g. `notes`) and top-level `$schema`, which strict-unaware providers reject with 400. Applied to both the response format and the prompt-embedded schema.
- Empty content / invalid JSON / Zod failure → `NarrationError` (retryable). `countWords` (in `wordCount.ts`) counts `isWordLike` segments via `Intl.Segmenter` built from the narrative language (`settings.language` → IETF tag via `getLanguageCode`, refreshed from the App settings effect through `setWordCountLanguage`); whitespace-word fallback when unset/invalid.

# PKCE Auth (OpenRouter API key without copy-paste)

`src/features/openrouter/pkceAuth.ts`: `startPkceAuth` (UUID state + double-UUID verifier → S256 challenge → redirect to `https://openrouter.ai/auth?...`), `exchangeCodeForApiKey` (15 s hard timeout, verifier deleted immediately to prevent double exchange, `fetchImpl` injectable), `consumePkceCallback` (state match = CSRF defense, mismatch → null + console.error), `stripPkceCallbackFromUrl` (replaceState, no reload replay), `readPkceCallback`. Round-trip state lives in localStorage (`nsOAuthState` / `nsOAuthCodeVerifier`) only. Settings shows an "Automatic API Key Setup" section that processes the callback once (ref guard) and saves via `saveApiKey`. Manual key entry applies a soft `sk-or-` prefix warning on the default base URL.

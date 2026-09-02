---
type: Integration
title: AI Providers (v2)
description: LLM provider configuration, OpenRouter defaults, and custom endpoints in v2.
tags: [llm, openrouter, providers]
timestamp: 2026-09-02T00:00:00Z
source: src/lib/modelOptions.ts, openAiClient.ts, src/store/gameStore.ts
---

# Overview

The default provider is OpenRouter (`https://openrouter.ai/api/v1`) with 200+ models. Any OpenAI-compatible endpoint works via `--BaseURL` (verified live against NVIDIA NIM endpoints). Auth is always a Bearer key: the OpenRouter key from `credentials`, or whatever the custom endpoint expects.

# Configuration Patterns

- **Default**: `openai/gpt-4o-mini` (the `DEFAULT_TEXT_MODEL`).
- **Custom endpoint**: `<model> --BaseURL=http://127.0.0.1:11434/v1` (Ollama), `:1234` (LM Studio), or any OpenAI-compatible URL (http/https validated). Custom base URLs drop the OpenRouter attribution headers.
- **Provider pinning**: `--only=google-ai-studio` maps to `provider.only` (e.g. `google/gemini-2.0-flash --only=google-ai-studio`).
- **Key acquisition**: manual paste (with soft `sk-or-` prefix warning on the default URL) or OpenRouter PKCE auto-setup (`Automatic API Key Setup` in Settings; see [LLM Service](/services/llm-service.md)).

# Request Mapping

`buildSamplingParams` maps the model string onto the body: `temperature`/`top_p` passthrough, `max_tokens` → `max_completion_tokens`, `reasoning` → `reasoning.effort` (passed through verbatim — `--reasoning=true` sends `effort: "true"`, no `medium`/`none` translation), `kwargs_reasoning` → `chat_template_kwargs`, `only` → `provider: { only: [<value>] }`. Timeouts combine with abort (`AbortSignal.any([signal, timeout])`).

# Reliability

- 429/502/503/504 are retryable (`classifyError`); 429 can auto-retry on a countdown (`autoRetrySeconds`).
- Stream-rejecting endpoints (400/404/415/422 on `stream: true`) fall back to one bulk attempt.
- `cleanJsonSchemaForStructuredOutputs` avoids 400s from strict-unaware providers (strips `propertyNames`/`$schema`); `--strict=false` uses `json_object` + prompt-embedded schema for maximal compatibility.

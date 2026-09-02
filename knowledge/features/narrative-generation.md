---
type: Feature
title: AI Narrative Generation
description: How the AI generates story scenes, branching choices, and maintains narrative consistency across turns in v2.
tags: [ai, narrative, llm]
timestamp: 2026-09-02T00:00:00Z
source: src/features/narrative/generateScene.ts, promptBuilder.ts, systemPrompt.ts, sceneSchema.ts, memoryMerge.ts, resolveMemoryStrategy.ts, src/lib/modelOptions.ts
---

# Overview

The narrative system uses an LLM (via the fetch-based `OpenAiCompatibleClient`) to produce each scene. The system prompt (`buildNarratorSystemPrompt`, ported from legacy) instructs the AI to act as a literary novelist writing vivid third-person prose with three branching choices.

# Model Configuration

Users specify a model string in the format:

```
<model-id> --option=value --option=value ...
```

**Example:**

```
x-ai/grok-4.1-fast --BaseURL=https://example.test/v1 --reasoning=true
```

Parsed by `parseTextModelOptions` (`src/lib/modelOptions.ts`); `isValid === false` marks unrecognized options or bad values (shown red in Settings). `buildSamplingParams` maps options onto the request body (`max_tokens` → `max_completion_tokens`, `reasoning` → `{ effort }`, `kwargs_reasoning` → `chat_template_kwargs`, `only` → `provider.only`).

## Available Options

| Option | Values | Default | Description |
|--------|--------|---------|-------------|
| `--BaseURL` | http(s) URL | `https://openrouter.ai/api/v1` | API endpoint base URL. Supports any OpenAI-compatible API. |
| `--reasoning` | `true` / `false` / `none` / `minimal` / `low` / `medium` / `high` / `xhigh` | undefined | Reasoning effort for models that support chain-of-thought. |
| `--reasoning_effort` | string | undefined | Explicit effort level override. |
| `--temperature` | 0.0 – 2.0 | undefined | Sampling temperature. Higher = more random. |
| `--top_p` | 0.0 – 1.0 | undefined | Nucleus sampling threshold. |
| `--top_k` | integer | undefined | Top-k sampling. |
| `--frequency_penalty` | -2.0 – 2.0 | undefined | Penalizes frequent tokens. |
| `--presence_penalty` | -2.0 – 2.0 | undefined | Penalizes repeated topics. |
| `--repetition_penalty` | 0.0 – 2.0 | undefined | Repetition penalty (OpenRouter extension). |
| `--min_p` | 0.0 – 1.0 | undefined | Minimum probability threshold. |
| `--top_a` | 0.0 – 1.0 | undefined | Top-a sampling. |
| `--max_tokens` | integer | `10240` | Maximum completion tokens. |
| `--timeout` | milliseconds | `600000` (10 min) | Request timeout (combined with abort via `AbortSignal.any`). |
| `--only` | provider string | undefined | Restrict to a specific provider (e.g., `--only=google-ai-studio`). |
| `--strict` | `true` / `false` | `true` | `json_schema` structured outputs. `false` falls back to `json_object` with the schema embedded in the system prompt. |
| `--stream` | `true` / `false` | `true` | Per-model streaming override. See [Streaming](streaming.md). |
| `--kwargs_reasoning` | `true` / `false` | undefined | vLLM-style thinking toggle sent as `chat_template_kwargs`. |

## Default Headers

When using the default OpenRouter base URL, attribution headers are sent (`OPENROUTER_APP_HEADERS` in `src/lib/openAiClient.ts`):

- `HTTP-Referer`: `https://narrative-sprout.pages.dev`
- `X-OpenRouter-Title`: `Narrative Sprout`
- `X-OpenRouter-Categories`: `game`

Custom `--BaseURL` removes these headers.

# Scene Length Settings

`sceneTextLength` values and targets (`promptBuilder.ts` `LENGTH_INSTRUCTIONS`):

| Setting | Target | Description |
|---------|--------|-------------|
| `short` / `default` | 50–100 words | Standard scene length. |
| `medium` | 100–200 words | Default for new saves. |
| `detailed` | 100–200 words | Unfolding like a detailed short story. |
| `long` | 200–400 words | Longer scenes. |
| `verbose` | 200+ words | Highly descriptive prose. |
| `novel` | 400–1200 words | Novel-length passages. |
| `novel2` | 800–1600 words | Longer novel passages. |

The target is injected into the user message (`Target scene length: …`), not the system prompt. Each save snapshots `sceneTextLength` at creation; later turns use the snapshot (`activeGame.sceneTextLength ?? settings.sceneTextLength`), with old saves falling back to the global setting.

# Memory Strategy

`memoryStrategy` (`auto` / `single` / `split`) controls how long-term memory (`notes` + `sceneSummary`) is updated each turn. Resolved by `resolveMemoryStrategy`: `split` stays `split`, `auto` picks `split` for `novel`/`novel2` and `single` otherwise.

| Value | Behavior |
|-------|----------|
| `single` (default) | One LLM call per turn: the scene call also emits the memory update. Cheaper and faster, but the single call juggles both tasks. |
| `split` | Two LLM calls per turn. The scene call returns scene data **without** memory (`narratorSceneOnlyResponseSchema`, with a throwaway `notesDraft` hint); a separate memory-keeper call produces the delta (`memoryUpdateResponseSchema`). More accurate, extra tokens. |
| `auto` | Picks `split` for long scenes (`novel`, `novel2`) and `single` otherwise. |

Split-mode details:

- **Scene-only prompt**: the scene call omits `sceneSummary`/`notes`; past-turn history passes `omitMemoryFields` so `sceneToWireResponse` strips them (non-strict models otherwise mimic history and fail validation).
- **Memory-keeper prompt** (`buildMemoryUpdatePrompt`): archivist-style keeper prompt fed by the shared prefix (attachments + latest memory, identical for both calls to allow prompt caching), the new `sceneText`, and the `notesDraft` hint. (`buildMemoryUpdatePrompt` has an optional `memoryReminder` parameter, but no caller passes it — currently unused.)
- **Merge**: `applyMemoryDelta` (`memoryMerge.ts`) folds the delta into the parent's memory. In `single` mode the flow is sequential: scene call → image generation.

# AI Memory System

## `notes` (Key-Value Store)

A free-form `Record<string, string | null>`. The AI chooses keys by convention:

| Key Pattern | Purpose |
|-------------|---------|
| `char:Name` | Character's ENDURING profile: appearance, personality, background, items, lasting injuries, relationships. Edited in place when a durable fact changes; rarely deleted. |
| `status:Name` | Character's CURRENT situation: location, activity, expression/mood. Overwritten freely; `status:reader` for the protagonist. Stale entries are nulled. |
| `lore:topic` | Persistent world facts, mysteries, items. |
| `flag:name` | Plot flags (boolean/state strings). Scene-wide events live here once instead of being duplicated into every status. |
| `num:name` | Numeric state encoded as strings. |

First turn populates `notes` from attachments and theme; later turns output **only changed keys** (`null` deletes). Corrupt values (e.g. `[object Object]`) may be repaired in place.

## `storyLog` / `storyLogSummary` & Compaction

`storyLog` is an ever-growing array of per-turn one-line summaries. When it exceeds `STORY_LOG_ARCHIVE_THRESHOLD` (30), an archivist call (`generateStoryLogCompaction`, prompt from `buildCompactionPrompt` including resolved attachment texts and current flags) compresses older entries into `storyLogSummary`, keeping the recent `RECENT_STORY_LOG_COUNT` (20) verbatim. Durable facts (`flag:`/`num:`/`lore:`) are merged additively via `mergeArchivedFacts` (live notes win, `null`s ignored). Compaction failure is swallowed (keeps the full log). Governed by the global `enableStoryLogCompaction` toggle (default on); see [Settings System](settings-system.md).

## `sceneSummary`

Per-turn factual one-line summary (top-level field, NOT inside `notes`). Stored per node as `memoryDelta.sceneSummary`.

# API Call Structure

```
System Prompt (role + theme + instructions)
  ↓
Attachment context (user → assistant ack, text parts only, flags resolved)
  ↓
Internal Monologue summary (latest notes + storyLog + storyLogSummary)
  ↓
Past turns (promptSent → scene JSON, up to 5 turns, oldest first)
  ↓
Current user choice + word count reminder
```

`buildOpeningPrompt` covers turn 1; `buildTurnPrompt` covers later turns. History MUST be replayed in wire format (`sceneToWireResponse`: `choice1..3`, no `choices` array) — see [Scene Structure](/data-model/scene.md).

# Output Schema (Zod)

The narrator response (`narratorSceneResponseSchema`): `sceneText`, `locationContext` (nullable), `imagePrompt`, `negativeImagePrompt` (nullable), `choice1/2/3`, `isStoryOver`, `finalEndingPassage`, `sceneSummary`, `notes` (delta). `z.toJSONSchema` output is cleaned by `cleanJsonSchemaForStructuredOutputs` (strips `propertyNames` + `$schema` that some structured-output providers reject with 400); see [LLM Service](/services/llm-service.md).

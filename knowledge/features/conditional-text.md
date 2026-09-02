---
type: Feature
title: Conditional Text (Flag-Gated Disclosure)
description: Flag-based conditional disclosure of theme and attachment content in v2.
tags: [conditional-text, flags, memory]
timestamp: 2026-09-02T00:00:00Z
source: src/features/attachments/conditionalText.ts, src/features/narrative/promptBuilder.ts
---

# Overview

Theme text and attachment texts can contain flag-gated blocks so only setting information relevant to the current story stage reaches the model. `resolveConditionalText(source, flags)` is pure and strips markup; `createFlagMap(notes)` adapts `MemoryState.notes`.

# Tag Syntax

| Tag | Shows content when… |
|-----|---------------------|
| `<flag:NAME>…</flag:NAME>` | `notes["flag:NAME"]` is truthy (`flag:` prefix auto-added). |
| `<flag-not:NAME>…</flag-not:NAME>` | the flag is falsy or missing. |
| `<if:KEY=VALUE>…</if:KEY=VALUE>` | `notes[KEY]` equals `VALUE` verbatim (e.g. a `status:` entry). |
| `<if-not:KEY=VALUE>…</if-not:KEY=VALUE>` | not equal. |

Semantics: truthy = present and not one of `false/0/no/off/""` (case-insensitive); absent = `null` (flag hidden, flag-not shown, `if` fails, `if-not` passes). Nested tags supported (same-kind nesting aware). A missing close tag returns the source unchanged.

# Application Points

- **Attachments**: resolved in `buildAttachmentMessages` against current `notes` every turn (turn 1 uses `{}`), and in `buildCompactionPrompt` for the archivist call. Raw texts stay stored unresolved.
- **Theme**: NOT resolved. The theme is embedded verbatim into the system prompt (`<world_theme>…</world_theme>` in `buildNarratorSystemPrompt`); conditional markup in the theme reaches the model unresolved.
- **Memory prompt**: resolved attachment text is part of the shared context prefix, so scene and memory-keeper calls see identical disclosure.

Flags are simply the AI's own `notes` keys, so the story progressively unlocks its own setting as flags are set.

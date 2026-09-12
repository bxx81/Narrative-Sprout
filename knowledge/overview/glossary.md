---
type: Reference
title: Domain Glossary & Naming Rules
description: The single source of truth for domain terms (Game, StoryNode, Scene, Memory, Asset, Credential) and naming principles in Narrative Sprout v2.
tags: [naming, glossary, conventions]
timestamp: 2026-09-12T00:00:00Z
source: REDESIGN.md §6 (retired), AGENTS.md rule 6
---

# Naming Principles

1. **Searchability**: names must be unique enough that a global search finds exactly the intended concept. Generic names (`data`, `info`, `item`) are forbidden.
2. **One concept, one term**: the glossary below is the only truth; synonyms for the same concept are not allowed.
3. **No abbreviations**: `settings`, not `cfg`; `gameRecord`, not `log`.
4. **Booleans** use `is`/`has`/`can`/`should` prefixes; async functions start with a verb (`fetchScene`, `saveNode`).
5. **ID fields name their target**: `parentNodeId`, never `parentId`.

# Glossary

| Term | Definition | Legacy (v1) names seen in the wild |
|------|------------|------------------------------------|
| **Game** | One complete playthrough | GameLog, Log, Save |
| **StoryNode** | One turn of the story (a tree node) | LogEntry, Node, Entry |
| **Scene** | The display content inside a node | SceneData, ReceivedScene |
| **Memory** | The AI's long-term memory (`notes` + `storyLog`) | InternalMonologue, implicit state |
| **Asset** | Binary data such as the scene illustration | Image, File (mixed) |
| **Credential** | API keys / tokens the user entered | Part of settings |

Enforcement is via review (AGENTS.md rule 6). The v1 rename table (`GameLog → GameRecord`, `userContent → promptSent`, …) is historical — v2 carries no compatibility layer, so old names should never reappear in code.
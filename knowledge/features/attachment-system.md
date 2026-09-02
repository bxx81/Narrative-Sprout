---
type: Feature
title: Attachment System
description: File attachments for world-building in v2 — scenario front matter, random choice, conditional disclosure, and base64 files.
tags: [attachments, world-building, scenario]
timestamp: 2026-09-02T00:00:00Z
source: src/features/attachments/parseScenarioFile.ts, attachmentProcessor.ts, randomChoice.ts, conditionalText.ts, src/features/narrative/promptBuilder.ts
---

# Overview

Attachments are the PRIMARY source of truth for world-building. Text attachments are re-injected every turn as a user→assistant prefix; images are display/reference only at generation time. Supported inputs: `.txt` / `.md` (text or scenario files), `.b64` (base64-encoded text, decoded first), images (jpg/jpeg/png/gif/webp).

# Scenario Files (YAML Front Matter)

`parseScenarioFile(content)` (pure, never throws) implements REDESIGN §4.4:

```markdown
---
title: Twilight Kingdom
theme: |
  The kingdom sinks into twilight...
---

# World (attachment text passed to the AI)
```

| File | Treatment |
|------|-----------|
| Front matter with a string `theme` key | **Scenario file**: `theme` becomes the game theme, `body` becomes attachment text. |
| No front matter / parse failure / non-string `theme` | Plain attachment (whole file is the text). Unknown keys are ignored. |
| Images / `.b64` | Unchanged paths (images skipped for text; `.b64` decoded before other steps). |

Rules: front matter is recognized only when the file starts with `---` + newline and the closing `---` is on its own line (body `---` rules never confuse it). The **first** file with a valid theme wins over the form input (`themeSource`); later themes fall back to plain attachments. Warnings are returned, not thrown.

# Processing Pipeline

`processAttachmentFiles(files, baseTheme)` (browser `File` → text) / `processAttachmentContents(entries, baseTheme)` (pure):

1. `.b64` decode (failures skipped), `.txt`/`.md` as text, images skipped for the text list.
2. Front-matter theme extraction (first wins).
3. `{a|b}` random-choice resolution per file (`processRandomChoice`: nested `{opt1|opt2|…}` + `{##marker##|…}` random-insertion markers, legacy-compatible).
4. Wrapped as `--- Attachment: <name> ---\n…\n--- End Attachment ---`.

Conditional tags are NOT resolved here — raw texts persist on the game (`GameRecord.attachmentTexts`) and are resolved at prompt-build time against current memory. `ThemeSetupScreen` additionally previews a front-matter `theme` into the textarea before Start.

# Prompt Injection

`buildAttachmentMessages` resolves each text via `resolveConditionalText(text, createFlagMap(notes))`, drops empties, and emits one user message + an assistant ack. Turn 1 resolves against `{}` (no memory yet); later turns and the archivist call resolve against current `notes`. See [Conditional Text](conditional-text.md).

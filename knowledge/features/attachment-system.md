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

`parseScenarioFile(content)` (pure, never throws) implements the scenario format:

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
| Front matter with a string `theme` key | **Scenario file**: `theme` is copied into the setup form at upload time (editable afterwards), `body` becomes attachment text. |
| No front matter / parse failure / non-string `theme` | Plain attachment (whole file is the text). Unknown keys are ignored. |
| Images / `.b64` | Images skipped for text; `.b64` is decoded first and then handled exactly like `.txt`/`.md` everywhere (upload pre-fill included). |

Rules: front matter is recognized only when the file starts with `---` + newline and the closing `---` is on its own line (body `---` rules never confuse it). Files never carry a theme into generation — reading a file may overwrite the theme form once, and from then on only the form value is sent (it stays editable). Warnings are returned, not thrown.

# Processing Pipeline

`processAttachmentFiles(files, baseTheme)` (browser `File` → text) / `processAttachmentContents(entries, baseTheme)` (pure):

1. `.b64` decode (failures skipped), `.txt`/`.md` as text, images skipped for the text list.
2. Front matter stripped from the body (a file's `theme` key is ignored here — the form input is the single source of truth).
3. `{a|b}` random-choice resolution per file and on the form theme (`processRandomChoice`: nested `{opt1|opt2|…}` + `{##marker##|…}` random-insertion markers, legacy-compatible).
4. Wrapped as `--- Attachment: <name> ---\n…\n--- End Attachment ---`.

Conditional tags are NOT resolved here — raw texts persist on the game (`GameRecord.attachmentTexts`) and are resolved at prompt-build time against current memory. `ThemeSetupScreen` (`readScenarioFile`) copies a front-matter `theme` into the textarea when a file is read; that copy is the last thing attachments do to the theme.

**Gotcha (file inputs)**: never pass a live `FileList` into a `setState` updater closure — `input.value = ""` empties it before the updater evaluates, so nothing is added (a timing-dependent bug shipped once). Handlers must snapshot immediately (`Array.from(files)` / `dataTransfer.files`) before touching `value = ""`.

# Prompt Injection

`buildAttachmentMessages` resolves each text via `resolveConditionalText(text, createFlagMap(notes))`, drops empties, and emits one user message + an assistant ack. Turn 1 resolves against `{}` (no memory yet); later turns and the archivist call resolve against current `notes`. See [Conditional Text](conditional-text.md).

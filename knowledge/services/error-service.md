---
type: Service
title: Error Handling (Classification, Dialog, Retry)
description: Error classification, global dialog, generation retry, 429 auto-retry, and toast notifications in v2.
tags: [error, retry, dialog, toast]
timestamp: 2026-09-02T00:00:00Z
source: src/lib/errorClassification.ts, src/components/ErrorDialog.tsx, src/store/gameStore.ts, src/app/App.tsx
---

# Overview

Generation failures (start/choose/refine/redo/image-regen) land in `AsyncOperation.failed` with their payload retained; a global dialog offers retry/dismiss, toasts report background operations, and 429s can auto-retry on a countdown.

# Classification

`classifyError` (`src/lib/errorClassification.ts`, legacy errorService port):

| Error | Message | Retryable | Buttons |
|-------|---------|-----------|---------|
| `ApiError` 429 | `errorApiOverloaded` (i18n key) | yes | Retry + Dismiss (+ countdown when configured) |
| `ApiError` 401/402/403 | status hint (`Invalid credentials` / `Insufficient credits` / `Forbidden`) | no | Dismiss only |
| Other `ApiError` | `"<status>: <hint>"` or server message | yes | Retry + Dismiss |
| `AbortError` (user cancel) | `errorAborted` | no | Dismiss only (`onlyInformation`) |
| `TimeoutError` | `errorApiGeneric` | yes | Retry + Dismiss |
| Other `Error` (empty content, bad JSON, validation) | original message | yes | Retry + Dismiss |

# Dialog & Retry

`ErrorDialog` (legacy ErrorDisplay modal port) mounts globally in `AppLayout` and shows for `generation` / `imageRegeneration` failures. Retryable titles use `errorStumbleTitle`, otherwise `errorOccurredTitle`; >7-line messages collapse behind `errorShowMore/Less`. Non-informational failures always offer a "Start Over" button alongside Retry/Dismiss. `retryGeneration()` re-runs the retained payload (`start` → `startNewGame`, `choice` → `choose`, `refine` → `refine`, `redo`/`rootRedo` → `redoScene`, image payload → `regenerateImage`). `dismissError()` returns to idle; dismissing a failed start additionally routes to `/setup`. The Starting screen and game screen carry no inline failure UI of their own. Opening the dialog with a fresh failure also plays the error chime (see [Sound Effects](/features/sound-effects.md)).

# 429 Auto-Retry

`settings.autoRetrySeconds` (`0` = Never, else seconds up to 300; Developer Options section) starts a countdown in the dialog (`errorAutoRetry`) and retries automatically on expiry.

# Toasts

`react-hot-toast` 2.6.0 (`<Toaster position="top-center">` in `App.tsx`, legacy-style card). Used for backup/Drive/PKCE/import/export/AI-translation/theme-generation results. A new toast also plays the notification chime (see [Sound Effects](/features/sound-effects.md)). Promise-based confirms use `ConfirmationProvider` + `useConfirm()` (native `<dialog>`, incl. 3-way `neutralLabel` for redo).

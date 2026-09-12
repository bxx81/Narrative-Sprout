import { useEffect, useState } from "react";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { debug } from "../../lib/debugLog";
import { isTauri } from "./detectEnvironment";

export interface TauriFileDropState {
  hovering: boolean;
  files: File[];
}

/** Minimal extension → MIME map for dropped files (legacy used `mime`). */
function guessMimeTypeFromPath(path: string): string {
  const extension = path.split(".").pop()?.toLowerCase() ?? "";
  switch (extension) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "avif":
      return "image/avif";
    case "svg":
      return "image/svg+xml";
    case "ico":
      return "image/x-icon";
    case "md":
      return "text/markdown";
    case "txt":
      return "text/plain";
    case "json":
      return "application/json";
    default:
      return "";
  }
}

async function readDroppedFile(path: string): Promise<File> {
  const { readFile } = await import("@tauri-apps/plugin-fs");
  const content = await readFile(path);
  const name = path.split(/[/\\]/).pop() ?? path;
  return new File([content], name, { type: guessMimeTypeFromPath(path) || undefined });
}

// Tauri v2 delivers file-drop events via window-scoped listeners. The drag
// payload carries raw OS paths (the WebView has no File access), so each
// path is read back through plugin-fs.
async function extractDroppedFiles(payload: unknown): Promise<File[]> {
  if (
    payload &&
    typeof payload === "object" &&
    "paths" in payload &&
    Array.isArray((payload as { paths: unknown }).paths)
  ) {
    const paths = (payload as { paths: unknown[] }).paths.filter(
      (entry): entry is string => typeof entry === "string",
    );
    return Promise.all(paths.map((path) => readDroppedFile(path)));
  }
  return [];
}

/**
 * OS-level file drop onto the Tauri window (legacy useTauriFileDrop port).
 * Outside Tauri this is inert (`hovering: false`, no files). Consumers merge
 * `files` into their own state and call `clearFiles()` afterwards.
 */
export function useTauriFileDrop() {
  const [state, setState] = useState<TauriFileDropState>({ hovering: false, files: [] });

  useEffect(() => {
    if (!isTauri) return;
    const unlistenFunctions: UnlistenFn[] = [];
    let cancelled = false;

    async function setup(): Promise<void> {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      if (cancelled) return;
      const windowHandle = getCurrentWindow();
      unlistenFunctions.push(
        await windowHandle.listen("tauri://drag-enter", () => {
          setState((previous) => ({ ...previous, hovering: true }));
        }),
        await windowHandle.listen("tauri://drag-over", () => {
          setState((previous) => ({ ...previous, hovering: true }));
        }),
        await windowHandle.listen("tauri://drag-drop", (event) => {
          void extractDroppedFiles(event.payload)
            .then((files) =>
              setState((previous) =>
                files.length > 0 ? { hovering: false, files } : { ...previous, hovering: false },
              ),
            )
            .catch((error: unknown) => {
              debug.error("Failed to read dropped files", error);
              setState((previous) => ({ ...previous, hovering: false }));
            });
        }),
        await windowHandle.listen("tauri://drag-leave", () => {
          setState((previous) => ({ ...previous, hovering: false }));
        }),
      );
    }

    void setup();
    return () => {
      cancelled = true;
      unlistenFunctions.forEach((unlisten) => unlisten());
    };
  }, []);

  const clearFiles = () => {
    setState((previous) => ({ ...previous, files: [] }));
  };

  return { ...state, clearFiles };
}

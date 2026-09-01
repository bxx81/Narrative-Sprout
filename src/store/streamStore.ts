import { countWords } from "../features/narrative/api";

/**
 * Display store for the in-flight streaming generation (ported from the
 * legacy streamStore). It deliberately bypasses the app store: raw deltas
 * arrive many times a second, so the partial `sceneText` is extracted from
 * the accumulated JSON with a lightweight scanner and notified through
 * `useSyncExternalStore`, batched on a 100 ms trailing flush. `end()` returns
 * the store to idle on completion/failure/abort — the final data always
 * renders through the regular success path.
 */

export interface StreamState {
  status: "idle" | "streaming" | "generating";
  /** Partially extracted sceneText (empty until the first chunk; falls back to the spinner). */
  sceneText: string;
  /** Word count of the received prose so far (pseudo progress). */
  wordCount: number;
  /** Whether the closing quote of the sceneText value has been received. */
  sceneTextComplete: boolean;
}

const FLUSH_INTERVAL_MS = 100;

/**
 * Extracts the value of the LAST `"sceneText"` key occurrence using a small
 * escape-aware scanner. `complete` reports whether the closing quote was
 * seen (i.e. the value is final).
 */
export function scanSceneText(raw: string): { text: string; complete: boolean } {
  const pattern = /"sceneText"\s*:\s*"/g;
  // Adopt the LAST occurrence so key mentions in prose are ignored.
  let match: RegExpExecArray | null = null;
  for (const m of raw.matchAll(pattern)) {
    match = m;
  }
  if (!match) return { text: "", complete: false };

  let i = match.index + match[0].length;
  let out = "";
  while (i < raw.length) {
    const ch = raw[i];
    if (ch === "\\") {
      const escaped = raw[i + 1];
      i += 2;
      switch (escaped) {
        case '"':
          out += '"';
          break;
        case "\\":
          out += "\\";
          break;
        case "/":
          out += "/";
          break;
        case "n":
          out += "\n";
          break;
        case "t":
          out += "\t";
          break;
        case "u": {
          const hex = raw.slice(i, i + 4);
          if (/^[0-9a-fA-F]{4}$/.test(hex)) {
            out += String.fromCharCode(Number.parseInt(hex, 16));
            i += 4;
          }
          break;
        }
        default:
          break;
      }
      continue;
    }
    if (ch === '"') {
      return { text: out, complete: true };
    }
    out += ch;
    i++;
  }
  // No closing quote yet: the value is still arriving.
  return { text: out, complete: false };
}

const IDLE_STATE: StreamState = {
  status: "idle",
  sceneText: "",
  wordCount: 0,
  sceneTextComplete: false,
};

let state: StreamState = IDLE_STATE;
let latestRaw = "";
let controller: AbortController | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

function flush(): void {
  flushTimer = null;
  if (state.status !== "streaming") return;
  const { text: sceneText, complete } = scanSceneText(latestRaw);
  if (
    sceneText.length === 0 &&
    state.sceneText.length === 0 &&
    !complete &&
    !state.sceneTextComplete
  ) {
    return;
  }
  const wordCount = countWords(sceneText);
  if (
    sceneText === state.sceneText &&
    wordCount === state.wordCount &&
    complete === state.sceneTextComplete
  ) {
    return;
  }
  state = { status: "streaming", sceneText, wordCount, sceneTextComplete: complete };
  notify();
}

export const streamStore = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  getSnapshot(): StreamState {
    return state;
  },

  /**
   * Starts a generation. Aborts any leftover controller from a previous run.
   * With `enableStreaming=false` the store only enables cancel support
   * (non-streaming generation keeps the spinner).
   */
  begin(enableStreaming: boolean = true): void {
    if (controller) controller.abort();
    controller = new AbortController();
    latestRaw = "";
    state = {
      status: enableStreaming ? "streaming" : "generating",
      sceneText: "",
      wordCount: 0,
      sceneTextComplete: false,
    };
    notify();
  },

  /** Receives the accumulated LLM output and schedules a batched notification. */
  pushDelta(accumulatedText: string): void {
    if (state.status !== "streaming") return;
    latestRaw = accumulatedText;
    if (flushTimer == null) {
      flushTimer = setTimeout(flush, FLUSH_INTERVAL_MS);
    }
  },

  /** Ends the generation (success, failure, abort alike) and returns to idle. */
  end(): void {
    if (flushTimer != null) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    controller = null;
    latestRaw = "";
    if (state.status !== "idle") {
      state = IDLE_STATE;
      notify();
    }
  },

  /** User-requested abort; the AbortError flows into the error classification. */
  cancel(): void {
    controller?.abort();
  },

  /** The AbortSignal bound to the in-flight generation, if any. */
  getSignal(): AbortSignal | null {
    return controller?.signal ?? null;
  },
};

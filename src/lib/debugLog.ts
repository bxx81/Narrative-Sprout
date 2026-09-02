/**
 * Debug mode switch and console logger (legacy `utils/debugLog.ts`).
 *
 * Legacy enabled debug mode via a `?debug=true` URL query. In v2 the flag is
 * resolved once at module load from, in order of precedence:
 *
 *   1. `?debug=true` / `?debug=false` URL query (also persisted to
 *      localStorage so the setting survives reloads / PWA sessions),
 *   2. the `nsDebug` localStorage flag (the Settings > Developer Options
 *      toggle writes it),
 *   3. `import.meta.env.DEV` (dev server always logs).
 *
 * The `debug` collection only executes when the flag is on — the methods are
 * bound once at module evaluation so call sites never branch.
 */

function resolveIsDebug(): boolean {
  try {
    if (typeof window !== "undefined" && window.location) {
      const params = new URLSearchParams(window.location.search);
      const param = params.get("debug");
      if (param !== null) {
        const enabled = param === "true";
        try {
          localStorage.setItem(DEBUG_STORAGE_KEY, enabled ? "1" : "0");
        } catch {
          // storage unavailable — the query still applies for this session
        }
        return enabled;
      }
      try {
        const stored = localStorage.getItem(DEBUG_STORAGE_KEY);
        if (stored === "1") return true;
        // An explicit "0" (set via the Settings toggle or ?debug=false) wins
        // over import.meta.env.DEV, otherwise debug mode could never be
        // turned off on the dev server.
        if (stored === "0") return false;
      } catch {
        // ignore
      }
    }
    return import.meta.env.DEV;
  } catch {
    return import.meta.env.DEV;
  }
}

export const DEBUG_STORAGE_KEY = "nsDebug";

/** Whether the app is in debug mode (read once at module load). */
export const isDebug = resolveIsDebug();

/**
 * Persists the debug flag for the next page load. The current module-scope
 * `isDebug` value is only re-evaluated on reload (Settings surfaces this via
 * the "requires page reload" label).
 */
export function setDebugMode(enabled: boolean): void {
  try {
    localStorage.setItem(DEBUG_STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    // storage unavailable — nothing we can do
  }
}

const noop = () => {};

/**
 * A collection of console logging methods that only execute if isDebug is
 * true. Using .bind(console) preserves the original context and allows for
 * more efficient execution by avoiding repetitive conditional checks at
 * runtime.
 */
export const debug = isDebug
  ? {
      log: console.log.bind(console),
      debug: console.debug.bind(console),
      error: console.error.bind(console),
      warn: console.warn.bind(console),
      info: console.info.bind(console),
      group: console.group.bind(console),
      groupCollapsed: console.groupCollapsed.bind(console),
      groupEnd: console.groupEnd.bind(console),
      groupLog: (header: unknown, ...body: unknown[]) => {
        console.groupCollapsed(header);
        console.log(...body);
        console.groupEnd();
      },
      time: console.time.bind(console),
      timeEnd: console.timeEnd.bind(console),
    }
  : {
      log: noop,
      debug: noop,
      error: noop,
      warn: noop,
      info: noop,
      group: noop,
      groupCollapsed: noop,
      groupEnd: noop,
      groupLog: noop,
      time: noop,
      timeEnd: noop,
    };

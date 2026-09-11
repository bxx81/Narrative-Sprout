/**
 * Desktop (Tauri) environment detection.
 *
 * This check is intentionally dependency-free: it only probes for the bridge
 * globals Tauri injects, so the web bundle and unit tests never load
 * `@tauri-apps/*` packages. Every value import from those packages must be
 * a dynamic `import()` behind this guard (`import type` is always fine —
 * it is erased at compile time).
 */
export function isTauri(): boolean {
  if (typeof window === "undefined") return false;
  const candidate = window as unknown as Record<string, unknown>;
  return "__TAURI__" in candidate || "__TAURI_INTERNALS__" in candidate;
}

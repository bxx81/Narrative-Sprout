/**
 * Desktop (Tauri) environment flag.
 *
 * `__TAURI_BUILD__` is a compile-time constant injected by `vite.config.ts`
 * (`true` only for `--mode tauri` builds). Vite replaces it with a literal
 * before bundling, so in web/PWA builds this export folds to `false` and
 * Rollup tree-shakes everything guarded by it — the `@tauri-apps/*` dynamic
 * imports behind those guards never reach the web bundle. This check is
 * intentionally dependency-free: every value import from `@tauri-apps/*`
 * packages must be a dynamic `import()` behind the `isTauri` guard
 * (`import type` is always fine — it is erased at compile time).
 *
 * Unit tests run without Vite, so the bun test preload seeds
 * `globalThis.__TAURI_BUILD__ = false` before any module is evaluated
 * (see `src/db/installFakeIndexedDb.ts`).
 */
declare const __TAURI_BUILD__: boolean;

function hasTauriBridgeGlobals(): boolean {
  if (typeof window === "undefined") return false;
  const candidate = window as unknown as Record<string, unknown>;
  return "__TAURI__" in candidate || "__TAURI_INTERNALS__" in candidate;
}

export const isTauri: boolean = __TAURI_BUILD__ && hasTauriBridgeGlobals();

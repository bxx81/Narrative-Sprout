// bun test preload (bunfig.toml [test].preload).
// 1. Registers fake-indexeddb BEFORE any module that captures the IndexedDB
//    API at evaluation time (Dexie does). Must run first.
// 2. Seeds `__TAURI_BUILD__` before any module importing
//    `src/features/desktop/detectEnvironment.ts` is evaluated: unit tests run
//    without Vite, so the compile-time constant must be provided as a plain
//    global and resolve the desktop flag to `false`.
import "fake-indexeddb/auto";

(globalThis as { __TAURI_BUILD__?: boolean }).__TAURI_BUILD__ = false;
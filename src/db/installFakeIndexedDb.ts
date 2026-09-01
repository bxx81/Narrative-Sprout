// bun test preload (bunfig.toml [test].preload).
// Registers fake-indexeddb BEFORE any module that captures the IndexedDB API
// at evaluation time (Dexie does). Must run first.
import "fake-indexeddb/auto";

import { describe, test, expect, beforeEach } from "bun:test";
import { DEBUG_STORAGE_KEY, setDebugMode } from "./debugLog";

/**
 * The `isDebug` flag itself is resolved once at module load (query →
 * localStorage → import.meta.env.DEV), so only the persistence helper used
 * by the Settings toggle is unit-testable directly. bun's test runtime has no
 * localStorage, so a minimal stub stands in for it here.
 */
describe("setDebugMode", () => {
  const backingStore = new Map<string, string>();
  const localStorageStub = {
    getItem: (key: string) => backingStore.get(key) ?? null,
    setItem: (key: string, value: string) => void backingStore.set(key, value),
    removeItem: (key: string) => void backingStore.delete(key),
  };

  beforeEach(() => {
    backingStore.clear();
    (globalThis as Record<string, unknown>).localStorage = localStorageStub;
  });

  test("writes the flag to localStorage for the next page load", () => {
    setDebugMode(true);
    expect(backingStore.get(DEBUG_STORAGE_KEY)).toBe("1");
    setDebugMode(false);
    expect(backingStore.get(DEBUG_STORAGE_KEY)).toBe("0");
  });
});

import { describe, test, expect } from "bun:test";
import { migrateCredentialRows } from "./credentialsRepository";
import type { CredentialBackend } from "../features/desktop/api";

/** In-memory backend stand-in (Map preserves insertion, starts empty). */
function makeMemoryBackend(
  initial: Array<{ key: string; value: string }> = [],
): CredentialBackend & { keys(): string[] } {
  const store = new Map(initial.map((row) => [row.key, row.value]));
  return {
    list: async () => [...store].map(([key, value]) => ({ key, value })),
    get: async (key) => store.get(key) ?? null,
    set: async (key, value) => {
      store.set(key, value);
    },
    delete: async (key) => {
      store.delete(key);
    },
    keys: () => [...store.keys()],
  };
}

describe("migrateCredentialRows", () => {
  test("moves every row to the target and empties the source", async () => {
    const source = makeMemoryBackend([
      { key: "openrouterApiKey", value: "sk-or-1" },
      { key: "huggingFaceToken", value: "hf-1" },
      { key: "legacyUnknownKey", value: "zzz" },
    ]);
    const target = makeMemoryBackend();

    const summary = await migrateCredentialRows(await source.list(), source, target);

    expect(summary).toEqual({ migratedKeyCount: 3 });
    expect(target.keys().sort()).toEqual([
      "huggingFaceToken",
      "legacyUnknownKey",
      "openrouterApiKey",
    ]);
    expect(await target.get("openrouterApiKey")).toBe("sk-or-1");
    // Plaintext proof: nothing remains on the source side.
    expect(await source.list()).toEqual([]);
  });

  test("empty source is a no-op", async () => {
    const source = makeMemoryBackend();
    const target = makeMemoryBackend();
    expect(await migrateCredentialRows(await source.list(), source, target)).toEqual({
      migratedKeyCount: 0,
    });
    expect(target.keys()).toEqual([]);
  });

  test("never overwrites a Vault value with a stale source row", async () => {
    const source = makeMemoryBackend([{ key: "openrouterApiKey", value: "sk-or-STALE" }]);
    const target = makeMemoryBackend([{ key: "openrouterApiKey", value: "sk-or-NEW" }]);

    const summary = await migrateCredentialRows(await source.list(), source, target);

    expect(summary).toEqual({ migratedKeyCount: 0 });
    expect(await target.get("openrouterApiKey")).toBe("sk-or-NEW");
    // The stale row is still dropped from the source (no plaintext left).
    expect(await source.list()).toEqual([]);
  });
});

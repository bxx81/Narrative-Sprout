/**
 * Pluggable secret backends (Phase 7.3).
 *
 * Web: IndexedDB (`credentials` store). Tauri: the Stronghold Vault via the
 * Rust `credential_*` commands — the Vault password never crosses into JS
 * (it lives in the OS credential store; see `src-tauri/src/lib.rs`).
 *
 * All `@tauri-apps/*` value imports are dynamic, so the web bundle and unit
 * tests never load them.
 */

/** String-keyed so unknown/legacy keys survive migration verbatim. */
export interface CredentialBackend {
  list(): Promise<Array<{ key: string; value: string }>>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

async function invokeVault<T>(command: string, args: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(command, args);
}

/** Stronghold Vault backend (Tauri only — callers guard with isTauri). */
export const vaultCredentialBackend: CredentialBackend = {
  // The Vault has no enumeration command; it is only ever a migration
  // target / live store, never a source.
  list: () => Promise.reject(new Error("The credential Vault cannot be enumerated.")),
  get: (key) => invokeVault<string | null>("credential_get", { key }),
  set: (key, value) => invokeVault<void>("credential_set", { key, value }),
  delete: (key) => invokeVault<void>("credential_delete", { key }),
};

import { db } from "./database";
import type { CredentialKey } from "../types";
import { isTauri, vaultCredentialBackend, type CredentialBackend } from "../features/desktop/api";

/**
 * The ONLY module allowed to read/write secrets (REDESIGN §5.4).
 * Export/backup features must never import this module.
 *
 * Web reads/writes IndexedDB; Tauri reads/writes the Stronghold Vault
 * (Phase 7.3 — no plaintext secret file in the WebView2 profile).
 */
const indexedDbCredentialBackend: CredentialBackend = {
  list: async () => (await db.credentials.toArray()).map(({ key, value }) => ({ key, value })),
  get: async (key) => (await db.credentials.get(key))?.value ?? null,
  set: async (key, value) => {
    // Unknown keys are preserved verbatim (forward-compat rows).
    await db.credentials.put({ key: key as CredentialKey, value });
  },
  delete: async (key) => {
    await db.credentials.delete(key);
  },
};

function activeCredentialBackend(): CredentialBackend {
  return isTauri ? vaultCredentialBackend : indexedDbCredentialBackend;
}

export const credentialsRepository = {
  async get(key: CredentialKey): Promise<string | null> {
    return activeCredentialBackend().get(key);
  },
  async set(key: CredentialKey, value: string): Promise<void> {
    await activeCredentialBackend().set(key, value);
  },
  async delete(key: CredentialKey): Promise<void> {
    await activeCredentialBackend().delete(key);
  },
};

export interface CredentialMigrationSummary {
  migratedKeyCount: number;
}

/**
 * Moves credential rows from `source` into `target`, then removes the source
 * rows. Idempotent: an empty source is a no-op, and rows whose key already
 * exists in the target are dropped from the source WITHOUT overwriting the
 * target (a previous partial run must never clobber a newer Vault value
 * with a stale IndexedDB row).
 */
export async function migrateCredentialRows(
  rows: Array<{ key: string; value: string }>,
  source: CredentialBackend,
  target: CredentialBackend,
): Promise<CredentialMigrationSummary> {
  let migratedKeyCount = 0;
  for (const row of rows) {
    if ((await target.get(row.key)) !== null) {
      await source.delete(row.key);
      continue;
    }
    await target.set(row.key, row.value);
    await source.delete(row.key);
    migratedKeyCount += 1;
  }
  return { migratedKeyCount };
}

/**
 * One-way first-launch migration (Tauri): IndexedDB → Vault, so no plaintext
 * secret remains in the WebView2 profile afterwards. Retried on every launch
 * until the IndexedDB side is empty.
 */
export async function migrateCredentialsToVault(): Promise<CredentialMigrationSummary> {
  const rows = await indexedDbCredentialBackend.list();
  return migrateCredentialRows(rows, indexedDbCredentialBackend, vaultCredentialBackend);
}

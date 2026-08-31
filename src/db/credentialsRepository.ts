import { db } from "./database";
import type { CredentialKey } from "../types";

/**
 * The ONLY module allowed to read/write secrets (REDESIGN §5.4).
 * Export/backup features must never import this module.
 */
export const credentialsRepository = {
  async get(key: CredentialKey): Promise<string | null> {
    const row = await db.credentials.get(key);
    return row?.value ?? null;
  },
  async set(key: CredentialKey, value: string): Promise<void> {
    await db.credentials.put({ key, value });
  },
  async delete(key: CredentialKey): Promise<void> {
    await db.credentials.delete(key);
  },
};

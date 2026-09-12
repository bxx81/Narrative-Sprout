import { db } from "./database";
import { credentialKeys } from "../types";
import { isTauri } from "../features/desktop/api";
import { credentialsRepository } from "./credentialsRepository";

/**
 * Full data wipe (REDESIGN.md §8 "データ全削除", Phase 4).
 *
 * Deletes the whole `narrative-sprout` database — including settings and
 * credentials — returning the app to its factory state. This is the only
 * code path allowed to remove credentials besides the user editing them.
 *
 * Tauri additionally purges the Stronghold Vault (vault first: if that
 * throws, IndexedDB is left intact so the wipe can be retried).
 */
export const wipeRepository = {
  async wipeAllUserData(): Promise<void> {
    if (isTauri) {
      for (const key of credentialKeys) {
        await credentialsRepository.delete(key);
      }
    }
    await db.delete();
  },
};

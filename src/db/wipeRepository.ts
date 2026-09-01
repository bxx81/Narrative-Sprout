import { db } from "./database";

/**
 * Full data wipe (REDESIGN.md §8 "データ全削除", Phase 4).
 *
 * Deletes the whole `narrative-sprout` database — including settings and
 * credentials — returning the app to its factory state. This is the only
 * code path allowed to remove credentials besides the user editing them.
 */
export const wipeRepository = {
  async wipeAllUserData(): Promise<void> {
    await db.delete();
  },
};

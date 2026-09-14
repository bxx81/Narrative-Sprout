import { db } from "./database";
import { credentialKeys } from "../types";
import { isTauri } from "../features/desktop/api";
import { credentialsRepository } from "./credentialsRepository";

/**
 * Full data wipe ("Delete All Data" — knowledge/features/history-and-saves.md).
 *
 * Deletes the whole `narrative-sprout` database — including settings and
 * credentials — returning the app to its factory state. This is the only
 * code path allowed to remove credentials besides the user editing them.
 *
 * PWA builds additionally unregister Service Workers and delete Cache
 * Storage (precache + runtime caches), bringing the origin as close as
 * possible to its pre-visit state. Both are best-effort: failures are
 * swallowed with a warning so they never block the IndexedDB wipe.
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
    await clearPwaTraces();
    await db.delete();
    await deleteOtherIndexedDatabases();
  },
};

/**
 * Unregisters all Service Workers and deletes all Cache Storage entries
 * for this origin. Never throws (each step is settled independently).
 */
async function clearPwaTraces(): Promise<void> {
  const tasks: Promise<unknown>[] = [];

  if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
    tasks.push(
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) =>
          Promise.allSettled(registrations.map((registration) => registration.unregister())),
        )
        .catch((error) => {
          console.warn("[wipe] service worker unregister failed", error);
        }),
    );
  }

  if (typeof caches !== "undefined" && typeof caches.keys === "function") {
    tasks.push(
      caches
        .keys()
        .then((keys) => Promise.allSettled(keys.map((key) => caches.delete(key))))
        .catch((error) => {
          console.warn("[wipe] cache storage deletion failed", error);
        }),
    );
  }

  await Promise.allSettled(tasks);
}

/**
 * Deletes any IndexedDB databases other than the main one (defense in
 * depth for future stores). The main database is already removed via
 * `db.delete()` above. Never throws.
 */
async function deleteOtherIndexedDatabases(): Promise<void> {
  try {
    if (typeof indexedDB === "undefined" || typeof indexedDB.databases !== "function") return;
    const databaseInfos = await indexedDB.databases();
    const deletions = databaseInfos
      .map((info) => info.name)
      .filter((name): name is string => typeof name === "string" && name !== db.name);
    await Promise.allSettled(
      deletions.map(
        (name) =>
          new Promise<void>((resolve) => {
            const request = indexedDB.deleteDatabase(name);
            request.onsuccess = () => resolve();
            request.onerror = () => resolve();
            request.onblocked = () => resolve();
          }),
      ),
    );
  } catch (error) {
    console.warn("[wipe] other database deletion failed", error);
  }
}

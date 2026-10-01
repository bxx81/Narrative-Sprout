/**
 * Session flag routing the post-wipe reload to the deletion-completion
 * screen. Lives in sessionStorage: it survives the `window.location.reload()`
 * inside `wipeAllData` but dies with the tab, so a later fresh visit starts
 * as a normal first launch.
 */
const DATA_DELETION_COMPLETE_KEY = "nsDataDeletionComplete";

export function isDataDeletionComplete(): boolean {
  return sessionStorage.getItem(DATA_DELETION_COMPLETE_KEY) === "1";
}

/** Must be called AFTER the storage wipe (the wipe clears sessionStorage). */
export function markDataDeletionComplete(): void {
  sessionStorage.setItem(DATA_DELETION_COMPLETE_KEY, "1");
}

export function clearDataDeletionCompleteFlag(): void {
  sessionStorage.removeItem(DATA_DELETION_COMPLETE_KEY);
}

/**
 * Browser-side tail of the data wipe: clears every web-storage surface,
 * sets the deletion-completion flag for the post-wipe reload (must be set
 * AFTER the storage wipe because the wipe intentionally clears everything;
 * while the flag is set, SW re-registration and bootstrap stay skipped —
 * see App — so the completion screen recreates nothing and closing the tab
 * ends the session fully wiped), and performs the full reload that
 * guarantees no stale in-memory state over a deleted DB (Dexie refuses to
 * auto-reopen a deleted database).
 */
export function finalizeDataWipe(): void {
  localStorage.clear();
  sessionStorage.clear();
  markDataDeletionComplete();
  window.location.reload();
}

/**
 * Registers the PWA service worker (noop in Tauri builds). Skipped while
 * the deletion-completion flag is set: the wipe already unregistered every
 * SW and deleted every cache, so a user closing the tab on the completion
 * screen exits with no worker, precache, or runtime cache left behind.
 * CompletedDataDeletionScreen re-registers on "Return to Title".
 *
 * The Vite virtual module is imported dynamically so the store-reachable
 * module graph stays resolvable under `bun test` (no Vite pipeline there).
 */
export async function registerServiceWorker(): Promise<void> {
  if (isDataDeletionComplete()) return;
  const { registerSW } = await import("virtual:pwa-register");
  registerSW({ immediate: true });
}

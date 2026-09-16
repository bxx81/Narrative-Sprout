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

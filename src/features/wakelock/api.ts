/**
 * Screen Wake Lock (https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API)
 * keeps the display awake while long-running network calls are in flight, so
 * a phone does not lock itself mid-generation. Locks are shared between named
 * owners ("generation" from the stream store, "autoplay" sessions from the
 * game store, plus translations, image regeneration, theme generation and
 * backup/Drive transfers); the actual WakeLockSentinel is held as long as at
 * least one owner is registered.
 *
 * The browser drops the lock whenever the page becomes hidden (or a battery
 * saver kicks in). While owners are still registered we re-request on the
 * next `visibilitychange` to visible, which is the documented re-acquire
 * path. Every failure (unsupported browser, denial, battery saver) is
 * swallowed: the wake lock is a comfort feature and must never break a turn.
 */

export type WakeLockOwner =
  "generation" | "autoplay" | "translation" | "image" | "theme" | "backup";

const wantedOwners = new Set<WakeLockOwner>();
let sentinel: WakeLockSentinel | null = null;
let requestInFlight = false;
let visibilityListenerAttached = false;

function isSupported(): boolean {
  return typeof navigator !== "undefined" && "wakeLock" in navigator;
}

function isDocumentVisible(): boolean {
  return typeof document === "undefined" || document.visibilityState === "visible";
}

function requestLock(): void {
  if (sentinel !== null || requestInFlight || !isSupported() || !isDocumentVisible()) return;
  requestInFlight = true;
  navigator.wakeLock
    .request("screen")
    .then((lock) => {
      if (wantedOwners.size > 0) {
        sentinel = lock;
        lock.addEventListener("release", () => {
          if (sentinel === lock) sentinel = null;
        });
      } else {
        void lock.release().catch(() => {});
      }
    })
    .catch((error) => {
      console.warn("[wakeLock] screen lock request failed:", error);
    })
    .finally(() => {
      requestInFlight = false;
    });
}

function releaseLock(): void {
  const lock = sentinel;
  sentinel = null;
  if (lock) void lock.release().catch(() => {});
}

function updateLock(): void {
  if (wantedOwners.size > 0) requestLock();
  else releaseLock();
}

function ensureVisibilityListener(): void {
  if (visibilityListenerAttached || typeof document === "undefined") return;
  visibilityListenerAttached = true;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") updateLock();
  });
}

export function acquireWakeLock(owner: WakeLockOwner): void {
  if (!isSupported()) return;
  wantedOwners.add(owner);
  ensureVisibilityListener();
  updateLock();
}

export function releaseWakeLock(owner: WakeLockOwner): void {
  if (!wantedOwners.delete(owner)) return;
  updateLock();
}

export class WakeLockGuard implements Disposable {
  constructor(private readonly owner: WakeLockOwner) {
    acquireWakeLock(this.owner);
  }

  [Symbol.dispose]() {
    releaseWakeLock(this.owner);
  }
}

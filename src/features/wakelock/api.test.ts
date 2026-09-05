import { describe, test, expect, beforeAll, afterEach } from "bun:test";
import { Window } from "happy-dom";
import { acquireWakeLock, releaseWakeLock } from "./api";

interface SentinelStub {
  released: boolean;
  release(): Promise<void>;
  addEventListener(type: string, listener: () => void): void;
}

function createSentinelStub(): SentinelStub {
  const listeners = new Set<() => void>();
  const stub: SentinelStub = {
    released: false,
    release() {
      if (stub.released) return Promise.resolve();
      stub.released = true;
      for (const listener of [...listeners]) listener();
      return Promise.resolve();
    },
    addEventListener(_type, listener) {
      listeners.add(listener);
    },
  };
  return stub;
}

interface PendingRequest {
  type: "screen";
  resolve: (sentinel: WakeLockSentinel) => void;
  reject: (error: unknown) => void;
}

let requests: PendingRequest[] = [];

function installWakeLockStub(): void {
  requests = [];
  const wakeLock = {
    request(type: "screen"): Promise<WakeLockSentinel> {
      return new Promise<WakeLockSentinel>((resolve, reject) => {
        requests.push({ type, resolve, reject });
      });
    },
  };
  Object.defineProperty(navigator, "wakeLock", { value: wakeLock, configurable: true });
}

function flushMicrotasks(): Promise<void> {
  return new Promise<void>((resolve) => setTimeout(resolve, 0));
}

function setVisibility(visibility: "visible" | "hidden"): void {
  Object.defineProperty(document, "visibilityState", { value: visibility, configurable: true });
}

const win = new Window();

beforeAll(() => {
  Object.defineProperty(globalThis, "navigator", {
    value: win.navigator,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(globalThis, "document", {
    value: win.document,
    configurable: true,
    writable: true,
  });
  setVisibility("visible");
});

function fireVisibilityChange(): void {
  document.dispatchEvent(new win.Event("visibilitychange") as unknown as Event);
}

afterEach(() => {
  releaseWakeLock("generation");
  releaseWakeLock("autoplay");
  Reflect.deleteProperty(navigator, "wakeLock");
});

describe("wakeLock", () => {
  test("no-ops when the Wake Lock API is unavailable", async () => {
    Reflect.deleteProperty(navigator, "wakeLock");
    acquireWakeLock("generation");
    releaseWakeLock("generation");
    await flushMicrotasks();
    expect(requests).toHaveLength(0);
  });

  test("requests one lock for multiple owners and releases with the last one", async () => {
    installWakeLockStub();
    const first = createSentinelStub();
    acquireWakeLock("generation");
    expect(requests).toHaveLength(1);
    requests[0].resolve(first as unknown as WakeLockSentinel);
    await flushMicrotasks();
    acquireWakeLock("autoplay");
    expect(requests).toHaveLength(1);
    releaseWakeLock("generation");
    expect(first.released).toBe(false);
    releaseWakeLock("autoplay");
    expect(first.released).toBe(true);
  });

  test("releases a lock that resolved after every owner already left", async () => {
    installWakeLockStub();
    acquireWakeLock("generation");
    acquireWakeLock("autoplay");
    expect(requests).toHaveLength(1);
    releaseWakeLock("generation");
    releaseWakeLock("autoplay");
    const sentinel = createSentinelStub();
    requests[0].resolve(sentinel as unknown as WakeLockSentinel);
    await flushMicrotasks();
    expect(sentinel.released).toBe(true);
  });

  test("re-acquires on the next visibility change after a platform drop", async () => {
    installWakeLockStub();
    const first = createSentinelStub();
    acquireWakeLock("generation");
    requests[0].resolve(first as unknown as WakeLockSentinel);
    await flushMicrotasks();
    setVisibility("hidden");
    first.release();
    await flushMicrotasks();
    setVisibility("visible");
    fireVisibilityChange();
    await flushMicrotasks();
    expect(requests).toHaveLength(2);
    const second = createSentinelStub();
    requests[1].resolve(second as unknown as WakeLockSentinel);
    await flushMicrotasks();
    releaseWakeLock("generation");
    expect(second.released).toBe(true);
  });

  test("swallows request failures and retries on the next visibility change", async () => {
    installWakeLockStub();
    acquireWakeLock("autoplay");
    requests[0].reject(new Error("denied by battery saver"));
    await flushMicrotasks();
    fireVisibilityChange();
    await flushMicrotasks();
    expect(requests).toHaveLength(2);
    const retried = createSentinelStub();
    requests[1].resolve(retried as unknown as WakeLockSentinel);
    await flushMicrotasks();
    expect(retried.released).toBe(false);
  });

  test("ignores release for an owner that never acquired", async () => {
    installWakeLockStub();
    releaseWakeLock("autoplay");
    const sentinel = createSentinelStub();
    acquireWakeLock("generation");
    requests[0].resolve(sentinel as unknown as WakeLockSentinel);
    await flushMicrotasks();
    expect(sentinel.released).toBe(false);
  });
});

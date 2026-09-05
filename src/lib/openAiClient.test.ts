import { describe, test, expect, afterEach } from "bun:test";
import { OpenAiCompatibleClient, SseIdleTimer, SseReaderGuard } from "./openAiClient";

function flushMicrotasks(): Promise<void> {
  return new Promise<void>((resolve) => setTimeout(resolve, 0));
}

function sleep(ms: number): Promise<void> {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

interface ReaderStubState {
  cancelCalls: number;
  releaseCalls: number;
  throwOnRelease: boolean;
}

function createReaderStub(state: ReaderStubState): ReadableStreamDefaultReader<Uint8Array> {
  return {
    cancel: () => {
      state.cancelCalls += 1;
      return Promise.resolve();
    },
    releaseLock: () => {
      state.releaseCalls += 1;
      if (state.throwOnRelease) throw new TypeError("Already released");
    },
  } as unknown as ReadableStreamDefaultReader<Uint8Array>;
}

function trackSettlement(promise: Promise<never>): { rejected: () => boolean } {
  let rejected = false;
  promise.then(
    () => {},
    () => {
      rejected = true;
    },
  );
  return { rejected: () => rejected };
}

/**
 * Awaits a promise expected to reject and returns the reason. Fails the test
 * when the promise resolves instead.
 */
async function awaitRejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("Expected the promise to reject, but it resolved.");
}

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("SseIdleTimer", () => {
  test("rejects after the timeout and cancels the reader", async () => {
    const state: ReaderStubState = { cancelCalls: 0, releaseCalls: 0, throwOnRelease: false };
    const timer = new SseIdleTimer(createReaderStub(state), 10);
    timer.arm();
    const failure = await awaitRejection(timer.timeoutPromise);
    expect(failure).toBeInstanceOf(DOMException);
    expect((failure as DOMException).message).toContain("No SSE chunk for 10ms");
    expect(state.cancelCalls).toBe(1);
    timer[Symbol.dispose]();
  });

  test("clear() suppresses the pending timeout", async () => {
    const state: ReaderStubState = { cancelCalls: 0, releaseCalls: 0, throwOnRelease: false };
    const timer = new SseIdleTimer(createReaderStub(state), 10);
    const settlement = trackSettlement(timer.timeoutPromise);
    timer.arm();
    timer.clear();
    await sleep(30);
    expect(settlement.rejected()).toBe(false);
    expect(state.cancelCalls).toBe(0);
    timer[Symbol.dispose]();
  });

  test("disposal via using suppresses the pending timeout", async () => {
    const state: ReaderStubState = { cancelCalls: 0, releaseCalls: 0, throwOnRelease: false };
    let timeoutPromise: Promise<never> | null = null;
    {
      using idleTimer = new SseIdleTimer(createReaderStub(state), 10);
      timeoutPromise = idleTimer.timeoutPromise;
      idleTimer.arm();
      // The using declaration disposes at block exit, clearing the timer.
    }
    expect(timeoutPromise).not.toBeNull();
    const settlement = trackSettlement(timeoutPromise!);
    await sleep(30);
    expect(settlement.rejected()).toBe(false);
    expect(state.cancelCalls).toBe(0);
  });

  test("re-arming resets the countdown", async () => {
    const state: ReaderStubState = { cancelCalls: 0, releaseCalls: 0, throwOnRelease: false };
    const timer = new SseIdleTimer(createReaderStub(state), 100);
    const settlement = trackSettlement(timer.timeoutPromise);
    timer.arm();
    await sleep(30);
    timer.arm();
    // 110ms after the first arm, but only 80ms after the second: still pending.
    await sleep(80);
    expect(settlement.rejected()).toBe(false);
    const failure = await awaitRejection(timer.timeoutPromise);
    expect(failure).toBeInstanceOf(DOMException);
    expect((failure as DOMException).message).toContain("No SSE chunk");
    expect(state.cancelCalls).toBe(1);
    timer[Symbol.dispose]();
  });
});

describe("SseReaderGuard", () => {
  test("cancels the reader and releases the lock when the scope exits", async () => {
    const state: ReaderStubState = { cancelCalls: 0, releaseCalls: 0, throwOnRelease: false };
    {
      using _guard = new SseReaderGuard(createReaderStub(state));
    }
    expect(state.cancelCalls).toBe(1);
    await flushMicrotasks();
    await flushMicrotasks();
    expect(state.releaseCalls).toBe(1);
  });

  test("tolerates a reader that is already released", async () => {
    const state: ReaderStubState = { cancelCalls: 0, releaseCalls: 0, throwOnRelease: true };
    const guard = new SseReaderGuard(createReaderStub(state));
    expect(() => guard[Symbol.dispose]()).not.toThrow();
    expect(state.cancelCalls).toBe(1);
    await flushMicrotasks();
    await flushMicrotasks();
    expect(state.releaseCalls).toBe(1);
  });
});

describe("createStreamingChatCompletion over SSE", () => {
  const textEncoder = new TextEncoder();

  function sseEnvelope(payload: string): string {
    return `data: ${payload}\n\n`;
  }

  function stubSseFetch(stream: ReadableStream<Uint8Array>): void {
    globalThis.fetch = (async () =>
      new Response(stream, {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      })) as unknown as typeof fetch;
  }

  test("assembles streamed deltas and releases the reader lock", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          textEncoder.encode(
            sseEnvelope(
              JSON.stringify({ model: "test-model", choices: [{ delta: { content: "Hello " } }] }),
            ),
          ),
        );
        controller.enqueue(
          textEncoder.encode(
            sseEnvelope(JSON.stringify({ choices: [{ delta: { content: "world" } }] })),
          ),
        );
        controller.enqueue(textEncoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });
    stubSseFetch(stream);

    const receivedDeltas: string[] = [];
    const client = new OpenAiCompatibleClient("sk-or-test");
    const completion = await client.createStreamingChatCompletion(
      { model: "test-model", messages: [{ role: "user", content: "hi" }] },
      { onDelta: (accumulatedText) => receivedDeltas.push(accumulatedText) },
    );

    expect(completion.choices?.[0]?.message?.content).toBe("Hello world");
    expect(receivedDeltas).toEqual(["Hello ", "Hello world"]);
    await flushMicrotasks();
    await flushMicrotasks();
    expect(stream.locked).toBe(false);
  });

  test("rejects with TimeoutError on silence after content started", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          textEncoder.encode(
            sseEnvelope(JSON.stringify({ choices: [{ delta: { content: "Hi" } }] })),
          ),
        );
        // Never enqueues again and never closes: the idle timer must fire.
      },
    });
    stubSseFetch(stream);

    const client = new OpenAiCompatibleClient("sk-or-test");
    const pending = client.createStreamingChatCompletion(
      { model: "test-model", messages: [{ role: "user", content: "hi" }] },
      { idleTimeoutMs: 30 },
    );
    const failure = await awaitRejection(pending);
    expect(failure).toBeInstanceOf(DOMException);
    expect((failure as DOMException).name).toBe("TimeoutError");
    expect((failure as DOMException).message).toContain("No SSE chunk for 30ms");
  });
});

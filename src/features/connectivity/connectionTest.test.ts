import { describe, test, expect } from "bun:test";
import {
  testEndpointConnectivity,
  type ConnectionTestResult,
  type FetchLike,
} from "./connectionTest";

const okFetch: FetchLike = async () => new Response("{}", { status: 200 });

function captureCalls(fetchImpl: FetchLike): { calls: RequestInit[]; impl: FetchLike } {
  const calls: RequestInit[] = [];
  const impl: FetchLike = (input, init) => {
    calls.push(init ?? {});
    return fetchImpl(input, init);
  };
  return { calls, impl };
}

describe("testEndpointConnectivity", () => {
  test("ok when the probe endpoint answers", async () => {
    const result = await testEndpointConnectivity({
      endpointUrl: "https://openrouter.ai/api/v1",
      fetchImpl: okFetch,
      pageProtocol: "https:",
    });
    expect(result.kind).toBe("ok");
    expect((result as { latencyMs: number }).latencyMs).toBeGreaterThanOrEqual(0);
  });

  test("sends the API key as a Bearer header like real calls", async () => {
    const { calls, impl } = captureCalls(okFetch);
    await testEndpointConnectivity({
      endpointUrl: "https://openrouter.ai/api/v1",
      apiKey: "sk-or-test",
      fetchImpl: impl,
      pageProtocol: "https:",
    });
    expect((calls[0]?.headers as Record<string, string>)["Authorization"]).toBe(
      "Bearer sk-or-test",
    );
  });

  test("http-error carries the status without the key", async () => {
    const fetchImpl: FetchLike = async () => new Response("Unauthorized", { status: 401 });
    const result = (await testEndpointConnectivity({
      endpointUrl: "https://openrouter.ai/api/v1",
      apiKey: "sk-or-test",
      fetchImpl,
      pageProtocol: "https:",
    })) as Extract<ConnectionTestResult, { kind: "http-error" }>;
    expect(result.kind).toBe("http-error");
    expect(result.status).toBe(401);
    expect(result.detail).toContain("Unauthorized");
    expect(result.detail).not.toContain("sk-or-test");
  });

  test("cors-likely when cors fails but the no-cors control resolves", async () => {
    let calls = 0;
    const fetchImpl: FetchLike = async (_input, init) => {
      calls += 1;
      if (init?.mode === "no-cors") return new Response("opaque", { status: 200 });
      throw new TypeError("Failed to fetch");
    };
    const result = await testEndpointConnectivity({
      endpointUrl: "http://127.0.0.1:11434/v1",
      fetchImpl,
      pageProtocol: "http:",
    });
    expect(result.kind).toBe("cors-likely");
    expect(calls).toBe(2);
  });

  test("unreachable when both the probe and the control fail", async () => {
    const fetchImpl: FetchLike = async () => {
      throw new TypeError("Failed to fetch");
    };
    const result = await testEndpointConnectivity({
      endpointUrl: "http://127.0.0.1:11434/v1",
      fetchImpl,
      pageProtocol: "http:",
    });
    expect(result.kind).toBe("unreachable");
  });

  test("mixed-content fails fast without fetching", async () => {
    let calls = 0;
    const fetchImpl: FetchLike = async () => {
      calls += 1;
      return new Response("{}", { status: 200 });
    };
    const result = await testEndpointConnectivity({
      endpointUrl: "http://192.168.1.10:7860",
      fetchImpl,
      pageProtocol: "https:",
    });
    expect(result.kind).toBe("mixed-content");
    expect(calls).toBe(0);
  });

  test("loopback http is exempt from the mixed-content short-circuit", async () => {
    for (const endpointUrl of [
      "http://localhost:7860",
      "http://127.0.0.1:7860",
      "http://127.0.0.2:8188",
    ]) {
      let calls = 0;
      const fetchImpl: FetchLike = async () => {
        calls += 1;
        return new Response("{}", { status: 200 });
      };
      const result = await testEndpointConnectivity({
        endpointUrl,
        probePath: "/",
        fetchImpl,
        pageProtocol: "https:",
      });
      expect(result.kind).toBe("ok");
      expect(calls).toBe(1);
    }
  });

  test("invalid-url rejects non-http schemes without fetching", async () => {
    let calls = 0;
    const fetchImpl: FetchLike = async () => {
      calls += 1;
      return new Response("{}", { status: 200 });
    };
    const result = await testEndpointConnectivity({
      endpointUrl: "ftp://example.test/v1",
      fetchImpl,
    });
    expect(result.kind).toBe("invalid-url");
    expect(calls).toBe(0);
  });

  test("timeout when the endpoint never answers", async () => {
    const fetchImpl: FetchLike = (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("Timed out", "TimeoutError"));
        });
      });
    const result = await testEndpointConnectivity({
      endpointUrl: "https://openrouter.ai/api/v1",
      fetchImpl,
      timeoutMs: 20,
      pageProtocol: "https:",
    });
    expect(result.kind).toBe("timeout");
  });

  test("caller abort propagates instead of becoming a result", async () => {
    const controller = new AbortController();
    const fetchImpl: FetchLike = (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
      });
    const pending = testEndpointConnectivity({
      endpointUrl: "https://openrouter.ai/api/v1",
      fetchImpl,
      signal: controller.signal,
      pageProtocol: "https:",
    });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });
});

import { describe, test, expect } from "bun:test";
import { fetchZeroGpuQuota, ZERO_GPU_QUOTA_URL, type ZeroGpuQuotaResult } from "./zeroGpuQuota";
import type { FetchLike } from "./connectionTest";

const quotaBody = {
  base: 40,
  current: 12.5,
  resetsAt: "2026-09-26T00:00:00Z",
  runs: { used: 3, limit: 100, remaining: 97, resetsAt: "2026-09-26T00:00:00Z" },
};

const okFetch: FetchLike = async () =>
  new Response(JSON.stringify(quotaBody), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

function captureCalls(fetchImpl: FetchLike): { calls: [string, RequestInit][]; impl: FetchLike } {
  const calls: [string, RequestInit][] = [];
  const impl: FetchLike = (input, init) => {
    calls.push([input, init ?? {}]);
    return fetchImpl(input, init);
  };
  return { calls, impl };
}

describe("fetchZeroGpuQuota", () => {
  test("ok with the parsed quota payload", async () => {
    const result = (await fetchZeroGpuQuota({ token: "hf-test", fetchImpl: okFetch })) as Extract<
      ZeroGpuQuotaResult,
      { kind: "ok" }
    >;
    expect(result.kind).toBe("ok");
    expect(result.quota.base).toBe(40);
    expect(result.quota.current).toBe(12.5);
    expect(result.quota.resetsAt).toBe("2026-09-26T00:00:00Z");
    expect(result.quota.runs?.remaining).toBe(97);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  test("hits the documented endpoint with the token as a Bearer header", async () => {
    const { calls, impl } = captureCalls(okFetch);
    await fetchZeroGpuQuota({ token: "hf-test", fetchImpl: impl });
    expect(calls[0]?.[0]).toBe(ZERO_GPU_QUOTA_URL);
    expect((calls[0]?.[1].headers as Record<string, string>)["Authorization"]).toBe(
      "Bearer hf-test",
    );
  });

  test("http-error carries the status without the token", async () => {
    const fetchImpl: FetchLike = async () =>
      new Response(JSON.stringify({ error: "Invalid username or password." }), { status: 401 });
    const result = (await fetchZeroGpuQuota({
      token: "hf-secret-token",
      fetchImpl,
    })) as Extract<ZeroGpuQuotaResult, { kind: "http-error" }>;
    expect(result.kind).toBe("http-error");
    expect(result.status).toBe(401);
    expect(result.detail).toContain("Invalid username or password.");
    expect(result.detail).not.toContain("hf-secret-token");
  });

  test("invalid-response when the body is not JSON", async () => {
    const fetchImpl: FetchLike = async () => new Response("<html></html>", { status: 200 });
    const result = await fetchZeroGpuQuota({ token: "hf-test", fetchImpl });
    expect(result.kind).toBe("invalid-response");
  });

  test("invalid-response when the payload does not match the schema", async () => {
    const fetchImpl: FetchLike = async () =>
      new Response(JSON.stringify({ base: "forty", current: null }), { status: 200 });
    const result = await fetchZeroGpuQuota({ token: "hf-test", fetchImpl });
    expect(result.kind).toBe("invalid-response");
  });

  test("tolerates unknown fields and a null resetsAt", async () => {
    const fetchImpl: FetchLike = async () =>
      new Response(
        JSON.stringify({ base: 40, current: 40, resetsAt: null, futureField: "ignored" }),
        { status: 200 },
      );
    const result = (await fetchZeroGpuQuota({
      token: "hf-test",
      fetchImpl,
    })) as Extract<ZeroGpuQuotaResult, { kind: "ok" }>;
    expect(result.kind).toBe("ok");
    expect(result.quota.resetsAt).toBeNull();
    expect(result.quota.runs).toBeUndefined();
  });

  test("timeout when the endpoint never answers", async () => {
    const fetchImpl: FetchLike = (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("Timed out", "TimeoutError"));
        });
      });
    const result = await fetchZeroGpuQuota({ token: "hf-test", fetchImpl, timeoutMs: 20 });
    expect(result.kind).toBe("timeout");
  });

  test("unreachable when the network fails", async () => {
    const fetchImpl: FetchLike = async () => {
      throw new TypeError("Failed to fetch");
    };
    const result = await fetchZeroGpuQuota({ token: "hf-test", fetchImpl });
    expect(result.kind).toBe("unreachable");
  });

  test("caller abort propagates instead of becoming a result", async () => {
    const controller = new AbortController();
    const fetchImpl: FetchLike = (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
      });
    const pending = fetchZeroGpuQuota({
      token: "hf-test",
      fetchImpl,
      signal: controller.signal,
    });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });
});

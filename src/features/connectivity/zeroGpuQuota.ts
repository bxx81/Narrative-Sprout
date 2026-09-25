/**
 * Hugging Face ZeroGPU quota status
 * (`GET https://huggingface.co/api/spaces/zero-gpu/quota`, Bearer token —
 * spec: https://huggingface.co/.well-known/openapi.json).
 *
 * The endpoint reports the *authenticated account's* quota, so it doubles
 * as the Hugging Face panel's connection test: it proves the token is
 * accepted and shows how much GPU time is left before the Space runs fail.
 *
 * Secrets policy (AGENTS.md hard rule 3): the token is sent as a request
 * header only and never appears in the returned result.
 */

import { z } from "zod";
import {
  CONNECTION_TEST_TIMEOUT_MS,
  ERROR_BODY_SNIPPET_LENGTH,
  fetchWithTimeout,
  type FetchLike,
} from "./connectionTest";

/** Account-level quota endpoint (no path or query parameters). */
export const ZERO_GPU_QUOTA_URL = "https://huggingface.co/api/spaces/zero-gpu/quota";

const zeroGpuRunsSchema = z.object({
  used: z.number(),
  limit: z.number(),
  remaining: z.number(),
  resetsAt: z.string().nullable(),
});

const zeroGpuQuotaSchema = z.object({
  base: z.number(),
  current: z.number(),
  resetsAt: z.string().nullable(),
  overquotaUsed: z.number().optional(),
  runs: zeroGpuRunsSchema.optional(),
});

export type ZeroGpuQuota = z.infer<typeof zeroGpuQuotaSchema>;

export type ZeroGpuQuotaResult =
  | { kind: "ok"; quota: ZeroGpuQuota; latencyMs: number }
  | { kind: "http-error"; status: number; detail: string; latencyMs: number }
  | { kind: "unreachable"; detail: string; latencyMs: number }
  | { kind: "timeout"; latencyMs: number }
  | { kind: "invalid-response"; detail: string; latencyMs: number };

export interface FetchZeroGpuQuotaParams {
  /** Hugging Face user access token (sent as `Authorization: Bearer`). */
  token: string;
  /** Per-request timeout in ms (default 15s). */
  timeoutMs?: number;
  /** Caller abort (test cancellation / unmount). Rethrown, not reported. */
  signal?: AbortSignal;
  fetchImpl?: FetchLike;
}

/**
 * Reads the caller's ZeroGPU quota. Never throws for endpoint problems —
 * every diagnosis is a return value. Only caller cancellation rejects.
 */
export async function fetchZeroGpuQuota(
  params: FetchZeroGpuQuotaParams,
): Promise<ZeroGpuQuotaResult> {
  const timeoutMs = params.timeoutMs ?? CONNECTION_TEST_TIMEOUT_MS;
  const fetchImpl = params.fetchImpl ?? fetch;
  const headers: Record<string, string> = {
    Accept: "application/json",
    Authorization: `Bearer ${params.token.trim()}`,
  };

  const startedAt = Date.now();
  const latencyMs = (): number => Date.now() - startedAt;

  let response: Response;
  try {
    response = await fetchWithTimeout(
      fetchImpl,
      ZERO_GPU_QUOTA_URL,
      { method: "GET", mode: "cors", headers },
      timeoutMs,
      params.signal,
    );
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      return { kind: "timeout", latencyMs: latencyMs() };
    }
    if (error instanceof Error && error.name === "AbortError") {
      throw error;
    }
    const detail = error instanceof Error ? error.message : "Unknown network error";
    return {
      kind: "unreachable",
      detail: detail.slice(0, ERROR_BODY_SNIPPET_LENGTH),
      latencyMs: latencyMs(),
    };
  }

  if (!response.ok) {
    const rawBody = await response.text().catch(() => "");
    return {
      kind: "http-error",
      status: response.status,
      detail: rawBody.slice(0, ERROR_BODY_SNIPPET_LENGTH),
      latencyMs: latencyMs(),
    };
  }

  let parsedJson: unknown;
  try {
    parsedJson = await response.json();
  } catch {
    return {
      kind: "invalid-response",
      detail: "Response body is not JSON.",
      latencyMs: latencyMs(),
    };
  }
  const parsed = zeroGpuQuotaSchema.safeParse(parsedJson);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const detail = issue
      ? `${issue.path.join(".") || "body"}: ${issue.message}`
      : "Response does not match the expected schema.";
    return {
      kind: "invalid-response",
      detail: detail.slice(0, ERROR_BODY_SNIPPET_LENGTH),
      latencyMs: latencyMs(),
    };
  }
  return { kind: "ok", quota: parsed.data, latencyMs: latencyMs() };
}

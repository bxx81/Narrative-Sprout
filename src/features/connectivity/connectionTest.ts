/**
 * Endpoint connectivity probe shared by the LLM and image-generator
 * settings (custom `--BaseURL`, A1111, ComfyUI, NIM, ...).
 *
 * Browsers never reveal CORS details to script: a CORS rejection surfaces
 * as a bare `TypeError` with no status, indistinguishable at face value
 * from DNS/offline failures. The probe therefore runs a control experiment —
 * a second request with `mode: "no-cors"` (opaque on success) — to tell
 * "reachable but CORS-blocked" apart from "unreachable". The outcome is a
 * likelihood (`cors-likely`), never a definitive CORS verdict.
 *
 * Secrets policy (AGENTS.md hard rule 3): the API key is sent as a request
 * header only and never appears in the returned result.
 */

/** Minimal fetch signature so tests can inject a stubbed implementation. */
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** Default per-probe timeout (matches the PKCE exchange timeout). */
export const CONNECTION_TEST_TIMEOUT_MS = 15_000;

/** Truncated HTTP error bodies never exceed this length. */
const ERROR_BODY_SNIPPET_LENGTH = 200;

export type ConnectionTestResult =
  | { kind: "ok"; latencyMs: number }
  | { kind: "http-error"; status: number; detail: string; latencyMs: number }
  | { kind: "cors-likely"; latencyMs: number }
  | { kind: "unreachable"; detail: string; latencyMs: number }
  | { kind: "timeout"; latencyMs: number }
  | { kind: "mixed-content"; endpointUrl: string }
  | { kind: "invalid-url"; endpointUrl: string };

export interface ConnectionTestParams {
  /** Endpoint root, e.g. `https://openrouter.ai/api/v1` (no trailing path). */
  endpointUrl: string;
  /**
   * Probe path appended to the endpoint root. LLM endpoints answer
   * `GET /models`; image backends pass their own lightweight path
   * (e.g. `/` for A1111/ComfyUI roots).
   */
  probePath?: string;
  /** Sent as a Bearer header so preflight behavior matches real calls. */
  apiKey?: string | null;
  /** Per-probe timeout in ms (default 15s). */
  timeoutMs?: number;
  /**
   * Page protocol for the mixed-content pre-check. Defaults to
   * `window.location.protocol` in browsers; injectable for tests.
   */
  pageProtocol?: string;
  /** Caller abort (test cancellation / unmount). Rethrown, not reported. */
  signal?: AbortSignal;
  fetchImpl?: FetchLike;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Loopback hosts are "potentially trustworthy" (Secure Contexts) and exempt
 * from mixed-content blocking: https pages may fetch http://localhost,
 * 127.0.0.0/8, and ::1 in Chrome/Edge/Firefox with no special setting.
 * LAN hosts (e.g. 192.168.x.x) have no such exemption and stay blocked.
 */
function isLoopbackUrl(value: string): boolean {
  let hostname: string;
  try {
    hostname = new URL(value).hostname.toLowerCase();
  } catch {
    return false;
  }
  if (hostname === "localhost" || hostname.endsWith(".localhost")) return true;
  if (hostname === "::1" || hostname === "[::1]") return true;
  const quartet = hostname.split(".");
  if (quartet.length === 4 && quartet[0] === "127") {
    return quartet.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
  }
  return false;
}

function resolvePageProtocol(explicit?: string): string | null {
  if (explicit !== undefined) return explicit;
  if (typeof window !== "undefined" && typeof window.location?.protocol === "string") {
    return window.location.protocol;
  }
  return null;
}

/**
 * Runs the main probe with a timeout. Resolves the response, or rejects:
 * caller aborts propagate as `AbortError`; the internal timeout rejects
 * with `TimeoutError`.
 */
async function fetchWithTimeout(
  fetchImpl: FetchLike,
  url: string,
  init: RequestInit,
  timeoutMs: number,
  callerSignal?: AbortSignal,
): Promise<Response> {
  if (callerSignal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort(new DOMException(`Timed out after ${timeoutMs}ms`, "TimeoutError"));
  }, timeoutMs);
  const forwardAbort = (): void => {
    controller.abort(callerSignal?.reason ?? new DOMException("Aborted", "AbortError"));
  };
  callerSignal?.addEventListener("abort", forwardAbort, { once: true });
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (timedOut || (error instanceof DOMException && error.name === "TimeoutError")) {
      throw new DOMException(`Timed out after ${timeoutMs}ms`, "TimeoutError");
    }
    throw error;
  } finally {
    clearTimeout(timer);
    callerSignal?.removeEventListener("abort", forwardAbort);
  }
}

/**
 * Probes whether an endpoint is reachable from this browser page and
 * reports the failure class. Never throws for endpoint problems — every
 * diagnosis is a return value. Only caller cancellation rejects.
 */
export async function testEndpointConnectivity(
  params: ConnectionTestParams,
): Promise<ConnectionTestResult> {
  const endpointUrl = params.endpointUrl.trim().replace(/\/+$/, "");
  const probePath = params.probePath ?? "/models";
  const timeoutMs = params.timeoutMs ?? CONNECTION_TEST_TIMEOUT_MS;
  const fetchImpl = params.fetchImpl ?? fetch;

  if (!isHttpUrl(endpointUrl)) {
    return { kind: "invalid-url", endpointUrl: params.endpointUrl };
  }

  const pageProtocol = resolvePageProtocol(params.pageProtocol);
  if (pageProtocol === "https:" && endpointUrl.startsWith("http:") && !isLoopbackUrl(endpointUrl)) {
    // https pages fetching non-loopback http:// endpoints are blocked as
    // mixed content before CORS even applies — fail fast with guidance.
    // Loopback is exempt per Secure Contexts, so it is probed for real.
    return { kind: "mixed-content", endpointUrl };
  }

  const probeUrl = `${endpointUrl}${probePath}`;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (params.apiKey) headers["Authorization"] = `Bearer ${params.apiKey}`;

  const startedAt = Date.now();
  const latencyMs = (): number => Date.now() - startedAt;

  let mainResponse: Response;
  try {
    mainResponse = await fetchWithTimeout(
      fetchImpl,
      probeUrl,
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
    if (error instanceof TypeError) {
      // Control experiment: `no-cors` still resolves (opaque) when the host
      // is reachable, so success here points at CORS rather than the network.
      try {
        await fetchWithTimeout(
          fetchImpl,
          endpointUrl,
          { method: "GET", mode: "no-cors" },
          timeoutMs,
          params.signal,
        );
        return { kind: "cors-likely", latencyMs: latencyMs() };
      } catch (controlError) {
        if (controlError instanceof Error && controlError.name === "AbortError") {
          throw controlError;
        }
        const detail =
          controlError instanceof Error ? controlError.message : "Unknown network error";
        return {
          kind: "unreachable",
          detail: detail.slice(0, ERROR_BODY_SNIPPET_LENGTH),
          latencyMs: latencyMs(),
        };
      }
    }
    const detail = error instanceof Error ? error.message : "Unknown network error";
    return {
      kind: "unreachable",
      detail: detail.slice(0, ERROR_BODY_SNIPPET_LENGTH),
      latencyMs: latencyMs(),
    };
  }

  if (mainResponse.ok) {
    return { kind: "ok", latencyMs: latencyMs() };
  }
  const rawBody = await mainResponse.text().catch(() => "");
  return {
    kind: "http-error",
    status: mainResponse.status,
    detail: rawBody.slice(0, ERROR_BODY_SNIPPET_LENGTH),
    latencyMs: latencyMs(),
  };
}

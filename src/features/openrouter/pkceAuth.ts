/**
 * OpenRouter OAuth PKCE flow (legacy openRouterService): the app redirects
 * the user to OpenRouter's authorization page with an S256 code challenge;
 * OpenRouter redirects back to the app with `?code=&state=`; the code is
 * exchanged for a user-controlled API key. The state/verifier live in
 * localStorage for the duration of the round-trip only.
 */

const PKCE_STATE_KEY = "nsOAuthState";
const PKCE_CODE_VERIFIER_KEY = "nsOAuthCodeVerifier";

/** Hard timeout for the OAuth code exchange request. */
const EXCHANGE_TIMEOUT_MS = 15_000;

function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function createSha256CodeChallenge(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(hash);
}

/** Pure helper (unit-testable): the OpenRouter authorize URL. */
export function buildPkceAuthUrl(params: {
  callbackUrl: string;
  state: string;
  codeChallenge: string;
}): string {
  return (
    `https://openrouter.ai/auth?callback_url=${encodeURIComponent(params.callbackUrl)}` +
    `&state=${params.state}` +
    `&code_challenge=${params.codeChallenge}` +
    `&code_challenge_method=S256`
  );
}

/** Step 1: store state+verifier and redirect to OpenRouter. */
export async function startPkceAuth(): Promise<void> {
  const state = crypto.randomUUID();
  localStorage.setItem(PKCE_STATE_KEY, state);
  const codeVerifier = crypto.randomUUID() + crypto.randomUUID();
  localStorage.setItem(PKCE_CODE_VERIFIER_KEY, codeVerifier);
  const codeChallenge = await createSha256CodeChallenge(codeVerifier);
  // origin + pathname so the callback does not carry the previous code again
  const callbackUrl = window.location.origin + window.location.pathname;
  window.location.href = buildPkceAuthUrl({ callbackUrl, state, codeChallenge });
}

/** Minimal fetch signature so tests can inject a stubbed implementation. */
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/**
 * Step 2: exchanges the callback code for a user-owned API key. Reads and
 * clears the verifier immediately to prevent duplicate concurrent exchanges.
 */
export async function exchangeCodeForApiKey(
  code: string,
  options?: { signal?: AbortSignal; fetchImpl?: FetchLike },
): Promise<string> {
  const codeVerifier = localStorage.getItem(PKCE_CODE_VERIFIER_KEY);
  if (!codeVerifier) {
    throw new Error("No code verifier found in local storage.");
  }
  localStorage.removeItem(PKCE_CODE_VERIFIER_KEY);

  const fetchImpl = options?.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl("https://openrouter.ai/api/v1/auth/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        code_verifier: codeVerifier,
        code_challenge_method: "S256",
      }),
      signal: options?.signal
        ? AbortSignal.any([options.signal, AbortSignal.timeout(EXCHANGE_TIMEOUT_MS)])
        : AbortSignal.timeout(EXCHANGE_TIMEOUT_MS),
    });
  } catch (error) {
    if (
      error instanceof DOMException &&
      (error.name === "TimeoutError" || error.name === "AbortError")
    ) {
      throw new Error(`OpenRouter key exchange timed out after ${EXCHANGE_TIMEOUT_MS / 1000}s.`, {
        cause: error,
      });
    }
    throw error;
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(
      `Failed to exchange code: ${response.status} ${response.statusText}` +
        (errorText ? ` - ${errorText}` : ""),
    );
  }
  const data = (await response.json()) as { key?: string };
  if (typeof data.key !== "string" || data.key.length === 0) {
    throw new Error("OpenRouter key exchange returned no key.");
  }
  return data.key;
}

/** Returns the callback parameters when the URL carries a PKCE response. */
export function readPkceCallback(
  searchParams: URLSearchParams,
): { code: string; state: string } | null {
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  if (!code || !state) return null;
  return { code, state };
}

/** Consumed state check + URL cleanup for the callback page. */
export function consumePkceCallback(searchParams: URLSearchParams): {
  code: string;
} | null {
  const callback = readPkceCallback(searchParams);
  if (!callback) return null;
  const storedState = localStorage.getItem(PKCE_STATE_KEY);
  localStorage.removeItem(PKCE_STATE_KEY);
  if (callback.state !== storedState) {
    console.error("[pkce] CSRF suspected: OAuth state mismatch.");
    return null;
  }
  return { code: callback.code };
}

/** Removes `code`/`state` from the address bar so reloads cannot replay it. */
export function stripPkceCallbackFromUrl(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete("code");
  url.searchParams.delete("state");
  window.history.replaceState({}, document.title, url.pathname + url.search);
}

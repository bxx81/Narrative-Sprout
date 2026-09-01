import { describe, test, expect, beforeEach, beforeAll } from "bun:test";
import { Window } from "happy-dom";
import {
  buildPkceAuthUrl,
  exchangeCodeForApiKey,
  consumePkceCallback,
  type FetchLike,
} from "./pkceAuth";

// happy-dom provides localStorage for the PKCE round-trip state.
beforeAll(() => {
  const win = new Window();
  Object.defineProperty(globalThis, "window", { value: win, configurable: true, writable: true });
  Object.defineProperty(globalThis, "localStorage", {
    value: win.localStorage,
    configurable: true,
    writable: true,
  });
});

describe("buildPkceAuthUrl", () => {
  test("builds the OpenRouter authorize URL with S256 challenge", () => {
    const url = buildPkceAuthUrl({
      callbackUrl: "https://narrative-sprout.pages.dev/settings",
      state: "state-uuid",
      codeChallenge: "challenge-abc",
    });
    expect(url.startsWith("https://openrouter.ai/auth?")).toBe(true);
    expect(url).toContain("callback_url=https%3A%2F%2Fnarrative-sprout.pages.dev%2F");
    expect(url).toContain("state=state-uuid");
    expect(url).toContain("code_challenge_method=S256");
  });

  test("URL-encodes the callback URL and carries method=S256", () => {
    const url = buildPkceAuthUrl({
      callbackUrl: "http://localhost:5173/settings?x=1",
      state: "s1",
      codeChallenge: "c1",
    });
    expect(url).toContain("callback_url=http%3A%2F%2Flocalhost%3A5173%2Fsettings%3Fx%3D1");
    expect(url).toContain("code_challenge_method=S256");
    expect(url).toContain("code_challenge=c1");
  });
});

describe("exchangeCodeForApiKey", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test("exchanges the code and returns the key", async () => {
    localStorage.setItem("nsOAuthCodeVerifier", "verifier-1");
    const fetchImpl: FetchLike = async () =>
      new Response(JSON.stringify({ key: "sk-or-new" }), { status: 200 });
    const key = await exchangeCodeForApiKey("code-1", { fetchImpl });
    expect(key).toBe("sk-or-new");
    // verifier consumed
    expect(localStorage.getItem("nsOAuthCodeVerifier")).toBe(null);
  });

  test("fails without a stored verifier", async () => {
    expect(
      exchangeCodeForApiKey("code-1", {
        fetchImpl: async () => new Response("{}", { status: 200 }),
      }),
    ).rejects.toThrow("No code verifier found in local storage.");
  });

  test("propagates HTTP errors with status", async () => {
    localStorage.setItem("nsOAuthCodeVerifier", "verifier-2");
    const fetchImpl: FetchLike = async () =>
      new Response("bad", { status: 400, statusText: "Bad Request" });
    expect(exchangeCodeForApiKey("code-2", { fetchImpl })).rejects.toThrow(
      "Failed to exchange code: 400 Bad Request",
    );
  });
});

describe("consumePkceCallback", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test("accepts a matching state and clears it", () => {
    localStorage.setItem("nsOAuthState", "state-1");
    const params = new URLSearchParams("code=abc&state=state-1");
    const result = consumePkceCallback(params);
    expect(result).toEqual({ code: "abc" });
    expect(localStorage.getItem("nsOAuthState")).toBe(null);
  });

  test("rejects a state mismatch (CSRF)", () => {
    localStorage.setItem("nsOAuthState", "state-real");
    const params = new URLSearchParams("code=abc&state=state-forged");
    expect(consumePkceCallback(params)).toBe(null);
  });
});

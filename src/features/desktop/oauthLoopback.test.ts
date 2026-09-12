import { describe, test, expect } from "bun:test";
import { createCodeChallenge, parseLoopbackCallbackUrl } from "./oauthLoopback";

describe("parseLoopbackCallbackUrl", () => {
  test("extracts code and state from a provider redirect", () => {
    expect(parseLoopbackCallbackUrl("http://127.0.0.1:51234/?code=abc123&state=xyz")).toEqual({
      code: "abc123",
      state: "xyz",
    });
  });

  test("returns null when code or state is missing", () => {
    expect(parseLoopbackCallbackUrl("http://127.0.0.1:51234/?code=abc123")).toBe(null);
    expect(parseLoopbackCallbackUrl("http://127.0.0.1:51234/?state=xyz")).toBe(null);
    expect(parseLoopbackCallbackUrl("http://127.0.0.1:51234/")).toBe(null);
  });

  test("returns null for provider error redirects and malformed URLs", () => {
    expect(parseLoopbackCallbackUrl("http://127.0.0.1:51234/?error=access_denied&state=xyz")).toBe(
      null,
    );
    expect(parseLoopbackCallbackUrl("not a url")).toBe(null);
  });
});

describe("createCodeChallenge", () => {
  test("produces an unpadded base64url SHA-256 digest", async () => {
    const challenge = await createCodeChallenge("test-verifier");
    expect(challenge).not.toContain("+");
    expect(challenge).not.toContain("/");
    expect(challenge).not.toContain("=");
    // Cross-checked with Web Crypto + Buffer against the btoa-based implementation.
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("test-verifier"));
    const expected = Buffer.from(digest).toString("base64url");
    expect(challenge).toBe(expected);
  });
});

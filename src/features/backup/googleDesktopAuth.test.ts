import { describe, test, expect } from "bun:test";
import {
  GoogleDriveAuthError,
  buildGoogleDesktopAuthUrl,
  exchangeGoogleCodeForToken,
  getGoogleDriveClientSecretTauri,
  type GoogleFetchLike,
} from "./googleAuth";

describe("buildGoogleDesktopAuthUrl", () => {
  test("builds a PKCE loopback authorize URL", () => {
    const url = buildGoogleDesktopAuthUrl({
      clientId: "id.apps.googleusercontent.com",
      redirectUri: "http://127.0.0.1:51234",
      state: "state-1",
      codeChallenge: "challenge-1",
    });
    expect(url.startsWith("https://accounts.google.com/o/oauth2/v2/auth?")).toBe(true);
    const params = new URL(url).searchParams;
    expect(params.get("client_id")).toBe("id.apps.googleusercontent.com");
    expect(params.get("redirect_uri")).toBe("http://127.0.0.1:51234");
    expect(params.get("response_type")).toBe("code");
    expect(params.get("scope")).toBe("https://www.googleapis.com/auth/drive.file");
    expect(params.get("state")).toBe("state-1");
    expect(params.get("code_challenge")).toBe("challenge-1");
    expect(params.get("code_challenge_method")).toBe("S256");
    // PKCE-only: no secret material in the URL.
    expect(url).not.toContain("client_secret");
    expect(url).not.toContain("code_verifier");
  });
});

describe("exchangeGoogleCodeForToken", () => {
  const params = {
    clientId: "id.apps.googleusercontent.com",
    clientSecret: "secret-1",
    redirectUri: "http://127.0.0.1:51234",
    codeVerifier: "verifier-1",
  };

  test("returns the token and posts the secret-bearing form body", async () => {
    let capturedBody = "";
    const fetchImpl: GoogleFetchLike = async (_input, init) => {
      capturedBody = String(init?.body ?? "");
      return new Response(JSON.stringify({ access_token: "ya29.x", expires_in: 3599 }), {
        status: 200,
      });
    };
    const result = await exchangeGoogleCodeForToken("code-1", { ...params, fetchImpl });
    expect(result).toEqual({ accessToken: "ya29.x", expiresInSeconds: 3599 });
    const body = new URLSearchParams(capturedBody);
    expect(body.get("code")).toBe("code-1");
    expect(body.get("code_verifier")).toBe("verifier-1");
    expect(body.get("client_secret")).toBe("secret-1");
    expect(body.get("grant_type")).toBe("authorization_code");
  });

  test("maps provider errors to GoogleDriveAuthError", async () => {
    const fetchImpl: GoogleFetchLike = async () =>
      new Response(
        JSON.stringify({ error: "invalid_grant", error_description: "Bad verification code." }),
        { status: 400 },
      );
    expect(exchangeGoogleCodeForToken("code-bad", { ...params, fetchImpl })).rejects.toThrow(
      GoogleDriveAuthError,
    );
    await expect(exchangeGoogleCodeForToken("code-bad", { ...params, fetchImpl })).rejects.toThrow(
      "Bad verification code.",
    );
  });
});

describe("getGoogleDriveClientSecretTauri", () => {
  test("explains the missing build-time secret instead of failing cryptically", () => {
    // VITE_GOOGLE_CLIENT_SECRET_TAURI is unset in the unit-test env.
    expect(() => getGoogleDriveClientSecretTauri()).toThrow(GoogleDriveAuthError);
    expect(() => getGoogleDriveClientSecretTauri()).toThrow("VITE_GOOGLE_CLIENT_SECRET_TAURI");
  });
});

/**
 * Google Identity Services (GIS) token client for Drive backup (REDESIGN §3.2).
 *
 * - No `gapi-script` dependency: only the OAuth token flow is needed, Drive
 *   REST calls use plain `fetch` with the bearer token (see `driveClient.ts`).
 * - The access token is kept in memory ONLY (never persisted to IndexedDB or
 *   localStorage) — a page reload simply re-acquires it silently if the user
 *   has already granted consent.
 * - No Google API key is embedded; only `VITE_GOOGLE_CLIENT_ID` (not a
 *   secret, but origin-restricted in Google Cloud Console — see README).
 * - Tauri: the WebView cannot show the GIS popup, so consent runs in the OS
 *   default browser as an authorization-code + PKCE round-trip against a
 *   one-shot localhost server. Google requires the client secret at the
 *   token endpoint even for Desktop-type clients, so the Tauri build embeds
 *   `VITE_GOOGLE_CLIENT_SECRET_TAURI` (build-time `.env.tauri` value, never
 *   committed — installed apps cannot keep a secret, see README).
 */
import { isTauri } from "../desktop/api";
import { debug } from "../../lib/debugLog";

const GSI_SCRIPT_URL = "https://accounts.google.com/gsi/client";
const DRIVE_SCOPES = "https://www.googleapis.com/auth/drive.file";

/** Seconds shaved off `expires_in` to avoid using tokens about to expire. */
const TOKEN_EXPIRY_SAFETY_MARGIN_SECONDS = 60;

interface GoogleTokenResponse {
  access_token?: string;
  expires_in?: string;
  error?: string;
  error_description?: string;
}

interface GisTokenClient {
  requestAccessToken(overrides?: { prompt?: string }): void;
}

interface GisOauth2 {
  initTokenClient(config: {
    client_id: string;
    scope: string;
    callback: (response: GoogleTokenResponse) => void;
    error_callback?: (error: { type?: string; message?: string }) => void;
  }): GisTokenClient;
  revoke(accessToken: string, done?: () => void): void;
}

interface GisGlobal {
  accounts: { oauth2: GisOauth2 };
}

declare global {
  interface Window {
    google?: GisGlobal;
  }
}

export class GoogleDriveAuthError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "GoogleDriveAuthError";
  }
}

/** Reads the embedded OAuth client id; explains setup when missing. */
export function getGoogleDriveClientId(): string {
  const env = import.meta.env as Record<string, string | undefined>;
  // Tauri builds may carry a Desktop-type OAuth client (loopback redirect);
  // it falls back to the web client id when unset (likely redirect mismatch).
  const desktopClientId = env.VITE_GOOGLE_CLIENT_ID_TAURI;
  const clientId = desktopClientId ?? env.VITE_GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new GoogleDriveAuthError(
      "Google Drive is not configured: VITE_GOOGLE_CLIENT_ID (web) or " +
        "VITE_GOOGLE_CLIENT_ID_TAURI (desktop) is missing (see README > Google Drive setup).",
    );
  }
  return clientId;
}

/**
 * True when the Tauri build embedded a Desktop-type client id. Debug-only
 * helper: lets Tauri OAuth issues distinguish "wrong id embedded" (value
 * never leaves the bundle — only the boolean is logged).
 */
export function hasDesktopGoogleDriveClientId(): boolean {
  const env = import.meta.env as Record<string, string | undefined>;
  return (env.VITE_GOOGLE_CLIENT_ID_TAURI ?? "").length > 0;
}

/**
 * Reads the Tauri-build OAuth client secret (Desktop-type clients still
 * require it at the token endpoint despite PKCE — observed:
 * "client_secret is missing."). Build-time only (`.env.tauri`, never the
 * repo); installed apps cannot keep a secret, which the README states.
 */
export function getGoogleDriveClientSecretTauri(): string {
  const env = import.meta.env as Record<string, string | undefined>;
  const secret = env.VITE_GOOGLE_CLIENT_SECRET_TAURI;
  if (!secret) {
    throw new GoogleDriveAuthError(
      "Google Drive sign-in needs VITE_GOOGLE_CLIENT_SECRET_TAURI in the Tauri build " +
        "(see README > Google Drive setup).",
    );
  }
  return secret;
}

let cachedAccessToken: { token: string; expiresAt: number } | null = null;
let gsiScriptLoadPromise: Promise<GisOauth2> | null = null;
let tokenClient: GisTokenClient | null = null;
let pendingTokenRequest: {
  resolve: (token: string) => void;
  reject: (error: Error) => void;
} | null = null;

function loadGsiOauth2(): Promise<GisOauth2> {
  if (typeof window === "undefined") {
    return Promise.reject(
      new GoogleDriveAuthError("Google sign-in requires a browser environment."),
    );
  }
  const existing = window.google?.accounts.oauth2;
  if (existing) return Promise.resolve(existing);

  if (!gsiScriptLoadPromise) {
    gsiScriptLoadPromise = new Promise<GisOauth2>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = GSI_SCRIPT_URL;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        const oauth2 = window.google?.accounts.oauth2;
        if (oauth2) resolve(oauth2);
        else
          reject(new GoogleDriveAuthError("Google Identity Services loaded but is unavailable."));
      };
      script.onerror = () => {
        gsiScriptLoadPromise = null;
        reject(new GoogleDriveAuthError("Failed to load the Google Identity Services script."));
      };
      document.head.appendChild(script);
    });
  }
  return gsiScriptLoadPromise;
}

function isCachedTokenValid(): boolean {
  return (
    cachedAccessToken !== null &&
    Date.now() < cachedAccessToken.expiresAt - TOKEN_EXPIRY_SAFETY_MARGIN_SECONDS * 1000
  );
}

/** True when a valid access token is already in memory (no popup needed). */
export function hasDriveAccessToken(): boolean {
  return isCachedTokenValid();
}

/** Drops the in-memory token (sign-out or auth failure recovery). */
export function clearDriveAccessToken(): void {
  cachedAccessToken = null;
}

/**
 * Returns a valid Drive access token, re-using the cached one or opening the
 * GIS consent/popup flow (web) or the system-browser PKCE flow (Tauri).
 * Must be called from a user gesture the first time (browser popup rules).
 */
export async function requestDriveAccessToken(): Promise<string> {
  if (isCachedTokenValid()) return cachedAccessToken!.token;
  if (isTauri()) return requestDriveAccessTokenTauri();

  const clientId = getGoogleDriveClientId();
  const oauth2 = await loadGsiOauth2();

  if (!tokenClient) {
    tokenClient = oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_SCOPES,
      callback: (response) => {
        const request = pendingTokenRequest;
        pendingTokenRequest = null;
        if (!request) return;
        if (response.access_token && response.access_token.length > 0) {
          const expiresIn = Number(response.expires_in) || 3600;
          cachedAccessToken = {
            token: response.access_token,
            expiresAt: Date.now() + expiresIn * 1000,
          };
          request.resolve(response.access_token);
        } else {
          request.reject(
            new GoogleDriveAuthError(
              response.error_description ||
                response.error ||
                "Google sign-in did not return an access token.",
            ),
          );
        }
      },
      error_callback: (error) => {
        const request = pendingTokenRequest;
        pendingTokenRequest = null;
        request?.reject(new GoogleDriveAuthError(error.message || "Google sign-in failed."));
      },
    });
  }

  return new Promise<string>((resolve, reject) => {
    pendingTokenRequest = { resolve, reject };
    tokenClient!.requestAccessToken({ prompt: "" });
  });
}

/** Revokes the current token with Google and drops it from memory. */
export async function revokeDriveAccessToken(): Promise<void> {
  const token = cachedAccessToken?.token;
  cachedAccessToken = null;
  if (!token) return;
  if (isTauri()) {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
      method: "POST",
    }).catch(() => undefined);
    return;
  }
  const oauth2 = await loadGsiOauth2();
  await new Promise<void>((resolve) => oauth2.revoke(token, () => resolve()));
}

/** Minimal fetch signature so tests can inject a stubbed implementation. */
export type GoogleFetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** Pure helper (unit-testable): the Google authorize URL for PKCE loopback. */
export function buildGoogleDesktopAuthUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
}): string {
  const query = new URLSearchParams({
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    response_type: "code",
    scope: DRIVE_SCOPES,
    state: params.state,
    code_challenge: params.codeChallenge,
    code_challenge_method: "S256",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${query.toString()}`;
}

interface GoogleTokenExchangeResult {
  accessToken: string;
  expiresInSeconds: number;
}

/**
 * Exchanges a loopback authorization code for tokens (PKCE + the
 * Desktop-type client secret — Google requires the secret at this endpoint
 * even for Desktop clients; installed apps cannot keep it, so it is a
 * build-time value, never committed to the repo).
 */
export async function exchangeGoogleCodeForToken(
  code: string,
  params: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    codeVerifier: string;
    fetchImpl?: GoogleFetchLike;
  },
): Promise<GoogleTokenExchangeResult> {
  const fetchImpl = params.fetchImpl ?? fetch;
  const body = new URLSearchParams({
    code,
    client_id: params.clientId,
    client_secret: params.clientSecret,
    code_verifier: params.codeVerifier,
    redirect_uri: params.redirectUri,
    grant_type: "authorization_code",
  });
  let response: Response;
  try {
    response = await fetchImpl("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
  } catch (error) {
    throw new GoogleDriveAuthError("Google token exchange request failed.", { cause: error });
  }
  const data = (await response.json().catch(() => null)) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  } | null;
  if (!response.ok || !data || typeof data.access_token !== "string" || !data.access_token) {
    throw new GoogleDriveAuthError(
      data?.error_description ||
        data?.error ||
        `Google token exchange failed (${response.status}).`,
    );
  }
  return { accessToken: data.access_token, expiresInSeconds: data.expires_in || 3600 };
}

/**
 * Tauri consent flow: system browser + one-shot localhost server + PKCE.
 * The token stays in memory only, exactly like the web GIS flow.
 */
async function requestDriveAccessTokenTauri(): Promise<string> {
  const {
    openExternalUrl,
    startLoopbackServer,
    waitForLoopbackRedirect,
    createCodeChallenge,
    parseLoopbackCallbackUrl,
  } = await import("../desktop/api");
  const clientId = getGoogleDriveClientId();
  const port = await startLoopbackServer();
  const redirectUri = `http://127.0.0.1:${port}`;
  // Never logs the id itself — only whether the Desktop-type id made it
  // into the bundle (wrong-file / stale-build issues show up here).
  debug.log("[drive] Tauri OAuth (PKCE-only, no secret)", {
    redirectUri,
    desktopClientIdEmbedded: hasDesktopGoogleDriveClientId(),
  });
  const state = crypto.randomUUID();
  const codeVerifier = crypto.randomUUID() + crypto.randomUUID();
  const waiting = waitForLoopbackRedirect();
  await openExternalUrl(
    buildGoogleDesktopAuthUrl({
      clientId,
      redirectUri,
      state,
      codeChallenge: await createCodeChallenge(codeVerifier),
    }),
  );
  const callback = parseLoopbackCallbackUrl(await waiting);
  if (!callback) {
    throw new GoogleDriveAuthError("The browser sign-in did not return an authorization code.");
  }
  if (callback.state !== state) {
    throw new GoogleDriveAuthError("OAuth state mismatch (possible CSRF) — sign-in rejected.");
  }
  const { accessToken, expiresInSeconds } = await exchangeGoogleCodeForToken(callback.code, {
    clientId,
    clientSecret: getGoogleDriveClientSecretTauri(),
    redirectUri,
    codeVerifier,
  });
  cachedAccessToken = { token: accessToken, expiresAt: Date.now() + expiresInSeconds * 1000 };
  return accessToken;
}

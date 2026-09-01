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
 */

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
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
  if (!clientId) {
    throw new GoogleDriveAuthError(
      "Google Drive is not configured: VITE_GOOGLE_CLIENT_ID is missing (see README > Google Drive setup).",
    );
  }
  return clientId;
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
 * GIS consent/popup flow. Must be called from a user gesture the first time
 * (browser popup rules).
 */
export async function requestDriveAccessToken(): Promise<string> {
  if (isCachedTokenValid()) return cachedAccessToken!.token;

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
  const oauth2 = await loadGsiOauth2();
  await new Promise<void>((resolve) => oauth2.revoke(token, () => resolve()));
}

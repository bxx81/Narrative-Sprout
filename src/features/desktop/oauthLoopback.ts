/**
 * System-browser OAuth helpers for the desktop app (Phase 7.2).
 *
 * The WebView cannot complete provider consent (popups are blocked and
 * navigating the app window away destroys state), so desktop OAuth runs in
 * the OS default browser: the provider redirects back to a one-shot
 * localhost server (Rust `start_server` in `src-tauri/src/lib.rs`, backed by
 * `tauri-plugin-oauth`), which forwards the full redirect URL through the
 * `redirect_uri` window event.
 *
 * All `@tauri-apps/*` value imports are dynamic, so the web bundle never
 * loads them.
 */

/** How long to wait for the user to finish consent in the system browser. */
const LOOPBACK_WAIT_TIMEOUT_MS = 5 * 60 * 1000;

/** Opens a URL in the OS default browser (Tauri only — callers guard). */
export async function openExternalUrl(url: string): Promise<void> {
  const { openUrl } = await import("@tauri-apps/plugin-opener");
  await openUrl(url);
}

/**
 * Starts the one-shot localhost callback server. Returns the ephemeral
 * port; callers embed `http://127.0.0.1:<port>` in the authorize URL.
 */
export async function startLoopbackServer(): Promise<number> {
  const { invoke } = await import("@tauri-apps/api/core");
  const port = await invoke<number>("start_server");
  if (typeof port !== "number" || !Number.isInteger(port) || port <= 0) {
    throw new Error("OAuth callback server did not return a valid port.");
  }
  return port;
}

/**
 * Waits for the single `redirect_uri` event carrying the provider redirect.
 * Register BEFORE opening the browser; the server is single-shot.
 */
export async function waitForLoopbackRedirect(
  timeoutMs: number = LOOPBACK_WAIT_TIMEOUT_MS,
): Promise<string> {
  const { listen } = await import("@tauri-apps/api/event");
  return new Promise<string>((resolve, reject) => {
    let settled = false;
    const settle = (action: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      action();
    };
    const timer = setTimeout(() => {
      settle(() => {
        void unlistenPromise.then((unlisten) => unlisten());
        reject(new Error("Timed out waiting for the browser sign-in to complete."));
      });
    }, timeoutMs);
    const unlistenPromise = listen<string>("redirect_uri", (event) => {
      settle(() => {
        resolve(event.payload);
        void unlistenPromise.then((unlisten) => unlisten());
      });
    });
    unlistenPromise.catch((error: unknown) =>
      settle(() => {
        reject(error instanceof Error ? error : new Error(String(error)));
      }),
    );
  });
}

/** S256 PKCE code challenge (shared by the desktop OAuth flows). */
export async function createCodeChallenge(codeVerifier: string): Promise<string> {
  const data = new TextEncoder().encode(codeVerifier);
  const hash = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(hash);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Extracts `code`/`state` from a loopback redirect URL (pure, testable). */
export function parseLoopbackCallbackUrl(redirectUrl: string): {
  code: string;
  state: string;
} | null {
  try {
    const params = new URL(redirectUrl).searchParams;
    const code = params.get("code");
    const state = params.get("state");
    if (!code || !state) return null;
    return { code, state };
  } catch {
    return null;
  }
}

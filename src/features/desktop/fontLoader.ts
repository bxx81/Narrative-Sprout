import { debug } from "../../lib/debugLog";
import { isTauri } from "./detectEnvironment";

/**
 * Loads a self-hosted font stylesheet, resolving font binaries from the
 * Tauri native resources when running as a desktop app (legacy fontLoader
 * port). Web builds keep the plain `<link>` behavior.
 *
 * De-duplication is the caller's job (guard on `[data-lang-font="…"]`).
 */
export async function loadDesktopFontCss(cssUrl: string, languageId: string): Promise<void> {
  if (!isTauri() || import.meta.env.DEV) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = cssUrl;
    link.setAttribute("data-lang-font", languageId);
    document.head.appendChild(link);
    return;
  }

  try {
    const response = await fetch(cssUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const cssText = await response.text();
    const [{ resourceDir, sep }, { convertFileSrc }] = await Promise.all([
      import("@tauri-apps/api/path"),
      import("@tauri-apps/api/core"),
    ]);
    const [resourceDirectory, separator] = await Promise.all([resourceDir(), sep()]);
    const base = resourceDirectory.endsWith(separator)
      ? resourceDirectory
      : resourceDirectory + separator;
    const rewritten = cssText.replace(
      /url\(["']?\/s\/([^"'()\s]+)["']?\)/g,
      (_match, fontPath: string) => {
        const normalized = fontPath.replace(/\//g, separator);
        return `url("${convertFileSrc(`${base}s${separator}${normalized}`)}")`;
      },
    );
    const style = document.createElement("style");
    style.textContent = rewritten;
    style.setAttribute("data-lang-font", languageId);
    document.head.appendChild(style);
    debug.log(`Loaded font CSS (resource): ${cssUrl}`);
  } catch (error) {
    console.error(`Failed to load font CSS: ${cssUrl}`, error);
    throw error;
  }
}

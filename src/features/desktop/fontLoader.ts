import { debug } from "../../lib/debugLog";
import { isTauri } from "./detectEnvironment";

/**
 * Rewrites absolute `/s/...` font binary references in a stylesheet to
 * loadable resource URLs. Pure (no Tauri imports) so it is unit-testable.
 */
export function rewriteFontCssUrls(
  cssText: string,
  toResourceUrl: (fontPath: string) => string,
): string {
  return cssText.replace(/url\(["']?\/s\/([^"'()\s]+)["']?\)/g, (_match, fontPath: string) => {
    return `url("${toResourceUrl(fontPath)}")`;
  });
}

async function resolveResourceBase(): Promise<{ base: string; separator: string }> {
  const [{ resourceDir, sep }] = await Promise.all([import("@tauri-apps/api/path")]);
  const [resourceDirectory, separator] = await Promise.all([resourceDir(), sep()]);
  const base = resourceDirectory.endsWith(separator)
    ? resourceDirectory
    : resourceDirectory + separator;
  return { base, separator };
}

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
    const { convertFileSrc } = await import("@tauri-apps/api/core");
    const { base, separator } = await resolveResourceBase();
    const rewritten = rewriteFontCssUrls(cssText, (fontPath) => {
      const normalized = fontPath.replace(/\//g, separator);
      return convertFileSrc(`${base}s${separator}${normalized}`);
    });
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

/**
 * Rewrites the static `/s/*.css` stylesheets from `index.html`
 * (`icons.css` + `en.css`) to Tauri resource URLs.
 *
 * Background: `scripts/separate-assets.mjs` strips every font binary
 * (`.woff2`/`.woff`/`.ttf`/`.otf`) from `dist/s/` because the same files
 * ship as Tauri native resources — but the stylesheets stay in `dist/` and
 * still point at `url(/s/....woff2)`. In a production Tauri window those
 * URLs hit `http://tauri.localhost/s/*.woff2`, which is no longer in
 * `dist/`, so the frontend server falls back to `index.html` and the font
 * decoder chokes on HTML (`OTS parsing error: invalid sfntVersion`,
 * i.e. `<!DO...`). Dynamically loaded language stylesheets already go
 * through `loadDesktopFontCss`; only these two static `<link>` tags were
 * missed.
 *
 * Must run at startup (see `src/main.tsx`): the `<link>` tags are first
 * neutralized synchronously (`media="not all"`) so the browser never
 * dispatches the doomed `/s/*.woff2` fetches, then each stylesheet is
 * re-fetched, rewritten, injected as `<style>`, and the original link is
 * removed. On any failure the link is restored so the page still renders.
 */
export function patchStaticFontStylesheetsForTauri(): Promise<void> {
  if (!isTauri() || import.meta.env.DEV) return Promise.resolve();
  const links = Array.from(
    document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"][href^="/s/"]'),
  );
  // Neutralize synchronously: prevents the browser from fetching the
  // stripped `/s/*.woff2` URLs while the async rewrite is in flight.
  for (const link of links) {
    link.media = "not all";
  }
  return (async () => {
    const { convertFileSrc } = await import("@tauri-apps/api/core");
    const { base, separator } = await resolveResourceBase();
    await Promise.all(
      links.map(async (link) => {
        const cssUrl = link.getAttribute("href");
        if (!cssUrl) return;
        if (document.querySelector(`style[data-tauri-font-patch="${cssUrl}"]`)) {
          link.remove();
          return;
        }
        try {
          const response = await fetch(cssUrl);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const rewritten = rewriteFontCssUrls(await response.text(), (fontPath) => {
            const normalized = fontPath.replace(/\//g, separator);
            return convertFileSrc(`${base}s${separator}${normalized}`);
          });
          const style = document.createElement("style");
          style.textContent = rewritten;
          style.setAttribute("data-tauri-font-patch", cssUrl);
          document.head.appendChild(style);
          link.remove();
          debug.log(`Patched static font CSS (resource): ${cssUrl}`);
        } catch (error) {
          console.error(`Failed to patch static font CSS: ${cssUrl}`, error);
          // Restore the original link so the page keeps its (web-fallback) styling.
          link.media = "";
        }
      }),
    );
  })();
}

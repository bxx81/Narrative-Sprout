import { isTauri } from "./detectEnvironment";

let resourceBase: string | null = null;
let pathSeparator: string | null = null;

async function ensureResourceBase(): Promise<void> {
  if (resourceBase !== null) return;
  const { sep, resourceDir } = await import("@tauri-apps/api/path");
  pathSeparator = await sep();
  const directory = await resourceDir();
  resourceBase = directory.endsWith(pathSeparator) ? directory : directory + pathSeparator;
}

/**
 * Resolves a `public/`-relative asset path to a loadable URL.
 *
 * Web build: identity (assets are served from `dist/` as usual).
 * Tauri production build: converted to an asset-protocol URL pointing at
 * the bundled native resources (`tauri.conf.json` `resources`), because
 * `scripts/separate-assets.mjs` strips those files from `dist/`.
 * (Tauri dev server: identity — Vite serves `public/` directly.)
 */
export async function resolveAssetUrl(path: string): Promise<string> {
  if (!isTauri() || import.meta.env.DEV) return path;
  const { convertFileSrc } = await import("@tauri-apps/api/core");
  await ensureResourceBase();
  const relative = path.startsWith("/") ? path.slice(1) : path;
  const normalized = relative.replace(/\//g, pathSeparator!);
  return convertFileSrc(resourceBase! + normalized);
}

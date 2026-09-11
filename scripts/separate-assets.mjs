// Tauri build helper: strip resource-served assets from dist/.
//
// `tauri.conf.json` bundles `public/s` (fonts) and `public/images` as native
// resources, and the frontend resolves them at runtime via `resourceDir` +
// `convertFileSrc` (see Phase 7.1 `features/desktop/`). Keeping the copies
// inside `dist/` would ship every font/image twice, so this script removes
// them from `dist/` after `vite build --mode tauri` runs.
//
// What stays in `dist/` (and why):
// - `s/*.css`: font stylesheets stay — the loader fetches the CSS over HTTP
//   and only rewrites the binary `url(/s/...)` references to resource URLs.
// - `sounds/*.ogg`, `icons/*`, `savedata/*.zip`, locales, JS/CSS: served from
//   dist/ as usual.
//
// Source of truth is always `public/` — this script never deletes from there.
import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

const assetPatterns = [
  {
    dist: "dist/s",
    exts: [".woff2", ".woff", ".ttf", ".otf"],
    names: ["ofl.txt", "license.txt"],
  },
  {
    dist: "dist/images",
    exts: [".webp", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".avif"],
    names: [],
  },
];

async function removeAssetFiles(dir, exts, names) {
  let count = 0;
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      count += await removeAssetFiles(fullPath, exts, names);
    } else if (isAssetFile(entry.name, exts, names)) {
      await fs.remove(fullPath);
      count++;
    }
  }
  return count;
}

async function removeEmptyDirs(dir) {
  if (!(await fs.pathExists(dir))) return;
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      await removeEmptyDirs(path.join(dir, entry.name));
    }
  }
  const remaining = await fs.readdir(dir);
  if (remaining.length === 0) {
    await fs.remove(dir);
  }
}

function isAssetFile(name, exts, names) {
  const lower = name.toLowerCase();
  if (names.includes(lower)) return true;
  return exts.some((ext) => lower.endsWith(ext));
}

async function processAssets() {
  let totalRemoved = 0;

  for (const asset of assetPatterns) {
    const distDir = path.resolve(projectRoot, asset.dist);

    if (!(await fs.pathExists(distDir))) {
      console.log(`${asset.dist}/ does not exist, skipping`);
      continue;
    }

    const removed = await removeAssetFiles(distDir, asset.exts, asset.names);
    totalRemoved += removed;
    await removeEmptyDirs(distDir);

    console.log(`Removed ${removed} files from ${asset.dist}/ (served from Tauri resources)`);
  }

  console.log(`Total: ${totalRemoved} files removed from dist/`);
}

processAssets().catch((err) => {
  console.error("Failed to separate assets:", err);
  process.exit(1);
});

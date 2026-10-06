// Keeps the Tauri Rust crate version in sync with the app version.
//
// `package.json` is the single source of truth: `tauri.conf.json` reads it
// directly (`"version": "../package.json"`) and `vite.config.ts` injects it as
// `__APP_VERSION__`. Cargo has no such indirection, so `src-tauri/Cargo.toml`
// is updated here. The `tauri` npm script runs this before the Tauri CLI, so
// `cargo` always compiles with the version already committed to `package.json`.
//
// Usage:
//   bun scripts/sync-tauri-version.ts          # write Cargo.toml
//   bun scripts/sync-tauri-version.ts --check  # fail instead of writing (CI)
import fs from "fs-extra";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const packageJsonPath = path.join(projectRoot, "package.json");
const cargoTomlPath = path.join(projectRoot, "src-tauri/Cargo.toml");
const relativeCargoToml = "src-tauri/Cargo.toml";

// Replaces the `version` field inside the `[package]` section only, so
// dependency version keys (e.g. `keyring = { version = "3" }`) stay untouched.
function setCargoPackageVersion(source: string, version: string): string {
  const lineEnding = source.includes("\r\n") ? "\r\n" : "\n";
  const lines = source.split(/\r?\n/);
  let inPackageSection = false;
  for (let index = 0; index < lines.length; index++) {
    const sectionMatch = lines[index].match(/^\s*\[([^\]]+)\]/);
    if (sectionMatch) {
      inPackageSection = sectionMatch[1].trim() === "package";
      continue;
    }
    if (!inPackageSection) continue;
    const versionMatch = lines[index].match(/^(\s*version\s*=\s*")([^"]*)(".*)$/);
    if (versionMatch) {
      lines[index] = `${versionMatch[1]}${version}${versionMatch[3]}`;
      return lines.join(lineEnding);
    }
  }
  throw new Error(`No "version" field found in the [package] section of ${relativeCargoToml}.`);
}

const checkOnly = process.argv.includes("--check");
const appVersion: unknown = fs.readJsonSync(packageJsonPath).version;
if (typeof appVersion !== "string" || appVersion.length === 0) {
  throw new Error(`package.json is missing a non-empty string "version" field.`);
}

const cargoTomlSource = fs.readFileSync(cargoTomlPath, "utf-8");
const syncedSource = setCargoPackageVersion(cargoTomlSource, appVersion);

if (syncedSource === cargoTomlSource) {
  console.log(`[sync-tauri-version] ${relativeCargoToml} is already at ${appVersion}.`);
  process.exit(0);
}

if (checkOnly) {
  console.error(
    `[sync-tauri-version] ${relativeCargoToml} is out of sync with package.json (${appVersion}). ` +
      `Run "bun run sync:tauri-version" and commit the result.`,
  );
  process.exit(1);
}

fs.writeFileSync(cargoTomlPath, syncedSource, "utf-8");
console.log(`[sync-tauri-version] ${relativeCargoToml} version -> ${appVersion}.`);

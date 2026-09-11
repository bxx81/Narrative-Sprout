import { describe, test, expect } from "bun:test";
import { isTauri } from "./detectEnvironment";
import { resolveAssetUrl } from "./assetResolver";

// Outside a Tauri WebView the desktop feature must be inert: no
// `@tauri-apps/*` module is ever loaded (all value imports are dynamic
// behind isTauri()), so these run against the plain web behavior.

describe("detectEnvironment", () => {
  test("isTauri() is false in the unit-test/web runtime", () => {
    expect(isTauri()).toBe(false);
  });
});

describe("assetResolver", () => {
  test("resolveAssetUrl() is identity outside Tauri", async () => {
    expect(await resolveAssetUrl("/images/16_9/1.webp")).toBe("/images/16_9/1.webp");
    expect(await resolveAssetUrl("/s/ja.css")).toBe("/s/ja.css");
  });
});

import { describe, test, expect } from "bun:test";
import { isTauri } from "./detectEnvironment";
import { resolveAssetUrl } from "./assetResolver";
import { legalDocumentFileNames, openLegalDocument } from "./legalDocuments";
import { patchStaticFontStylesheetsForTauri, rewriteFontCssUrls } from "./fontLoader";

// Outside a Tauri WebView the desktop feature must be inert: no
// `@tauri-apps/*` module is ever loaded (all value imports are dynamic
// behind isTauri), so these run against the plain web behavior.

describe("detectEnvironment", () => {
  test("isTauri is false in the unit-test/web runtime", () => {
    expect(isTauri).toBe(false);
  });
});

describe("assetResolver", () => {
  test("resolveAssetUrl() is identity outside Tauri", async () => {
    expect(await resolveAssetUrl("/images/16_9/1.webp")).toBe("/images/16_9/1.webp");
    expect(await resolveAssetUrl("/s/ja.css")).toBe("/s/ja.css");
  });
});

describe("legalDocuments", () => {
  test("every bundled legal page has a file name", () => {
    expect(legalDocumentFileNames).toEqual({
      terms: "terms_of_service.html",
      privacy: "privacy_policy.html",
      license: "license.html",
    });
  });

  test("openLegalDocument() refuses to run outside Tauri", async () => {
    await expect(openLegalDocument("terms")).rejects.toThrow();
  });
});

describe("fontLoader", () => {
  test("rewriteFontCssUrls() maps every /s/ binary to the resource URL", () => {
    const css = `@font-face{src:url(/s/font.woff2) format("woff2");}
@font-face{src:url("/s/cormorantgaramond/v21/x.woff2") format("woff2");}`;
    const rewritten = rewriteFontCssUrls(css, (fontPath) => `RES:${fontPath}`);
    expect(rewritten).toBe(`@font-face{src:url("RES:font.woff2") format("woff2");}
@font-face{src:url("RES:cormorantgaramond/v21/x.woff2") format("woff2");}`);
  });

  test("patchStaticFontStylesheetsForTauri() is a noop outside Tauri", async () => {
    await expect(patchStaticFontStylesheetsForTauri()).resolves.toBeUndefined();
  });
});

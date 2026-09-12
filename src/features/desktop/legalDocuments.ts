import { isTauri } from "./detectEnvironment";

/**
 * Legal documents bundled as Tauri native resources
 * (`tauri.conf.json` `resources`: `public/legal` -> `legal`).
 */
export const legalDocumentFileNames = {
  terms: "terms_of_service.html",
  privacy: "privacy_policy.html",
  license: "license.html",
} as const;

export type LegalDocumentId = keyof typeof legalDocumentFileNames;

/**
 * Opens a bundled legal document in the OS default application
 * (the system browser for `.html` files).
 *
 * Tauri only — web builds link to the hosted `/legal/*` pages instead
 * (see `lib/cloudFlarePages.ts`). All `@tauri-apps/*` value imports are
 * dynamic, so the web bundle never loads them.
 */
export async function openLegalDocument(legalDocumentId: LegalDocumentId): Promise<void> {
  if (!isTauri) {
    throw new Error("openLegalDocument() is only available in the Tauri desktop app.");
  }
  const { resourceDir, join } = await import("@tauri-apps/api/path");
  const { openPath } = await import("@tauri-apps/plugin-opener");
  const filePath = await join(
    await resourceDir(),
    "legal",
    legalDocumentFileNames[legalDocumentId],
  );
  await openPath(filePath);
}

/** Public surface of the desktop (Tauri) feature (Phase 7.1). */
export { isTauri } from "./detectEnvironment";
export { resolveAssetUrl } from "./assetResolver";
export { openLegalDocument, legalDocumentFileNames, type LegalDocumentId } from "./legalDocuments";
export { loadDesktopFontCss, patchStaticFontStylesheetsForTauri } from "./fontLoader";
export { useTauriFileDrop, type TauriFileDropState } from "./fileDrop";
export {
  exitApplication,
  getDesktopFullscreen,
  setDesktopFullscreen,
  onDesktopResize,
} from "./applicationControl";
export {
  openExternalUrl,
  startLoopbackServer,
  waitForLoopbackRedirect,
  createCodeChallenge,
  parseLoopbackCallbackUrl,
} from "./oauthLoopback";
export { vaultCredentialBackend, type CredentialBackend } from "./credentialVault";

/** Public surface of the desktop (Tauri) feature (Phase 7.1). */
export { isTauri } from "./detectEnvironment";
export { resolveAssetUrl } from "./assetResolver";
export { loadDesktopFontCss } from "./fontLoader";
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

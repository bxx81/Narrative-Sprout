import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import "./features/i18n/config";
import "./index.css";
import { patchStaticFontStylesheetsForTauri } from "./features/desktop/api";
import { registerServiceWorker } from "./features/wipe/api";

// Tauri production builds strip font binaries from dist/ (shipped as native
// resources instead): rewrite the static /s/*.css links before first render
// so no request ever hits the missing http://tauri.localhost/s/*.woff2 URLs.
patchStaticFontStylesheetsForTauri();

// PWA service worker (autoUpdate: the new SW activates once pages reload).
// No-ops on the post-wipe completion screen so closing the tab there ends
// the session with no service worker or cache left behind.
void registerServiceWorker();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { registerSW } from "virtual:pwa-register";
import "./features/i18n/config";
import "./index.css";
import { patchStaticFontStylesheetsForTauri } from "./features/desktop/api";

// Tauri production builds strip font binaries from dist/ (shipped as native
// resources instead): rewrite the static /s/*.css links before first render
// so no request ever hits the missing http://tauri.localhost/s/*.woff2 URLs.
patchStaticFontStylesheetsForTauri();

// PWA service worker (autoUpdate: the new SW activates once pages reload).
registerSW({ immediate: true });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

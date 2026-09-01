import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { registerSW } from "virtual:pwa-register";
import "./features/i18n/config";
import "./index.css";

// PWA service worker (autoUpdate: the new SW activates once pages reload).
registerSW({ immediate: true });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

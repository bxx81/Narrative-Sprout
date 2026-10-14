interface UserAgentDataBrand {
  brand: string;
}

interface UserAgentDataLike {
  brands?: UserAgentDataBrand[];
}

const CHROMIUM_BRANDS = new Set(["Chromium", "Google Chrome"]);

function hasChromiumEngineBrand(): boolean {
  const userAgentData = (navigator as Navigator & { userAgentData?: UserAgentDataLike }).userAgentData;
  const brands = userAgentData?.brands;
  if (!brands) return false;
  return brands.some((entry) => CHROMIUM_BRANDS.has(entry.brand));
}

/**
 * Gate for React's <ViewTransition>. Chromium's View Transition API is stable
 * and covered by the E2E suite. WebKit's implementation hard-crashes the
 * renderer when a transition runs while the document is exactly one viewport
 * tall (reproduced in Playwright WebKit) and has a history of
 * use-after-free crashes, including Tauri's WebKitGTK/WKWebView targets —
 * React GH-35336 (enter/exit on iOS Safari) is one example. The animation is
 * decorative, so non-Chromium engines keep the CSS fallback instead.
 */
export function isViewTransitionAnimationSupported(): boolean {
  if (typeof document === "undefined" || typeof navigator === "undefined") return false;
  if (typeof document.startViewTransition !== "function") return false;
  return hasChromiumEngineBrand();
}

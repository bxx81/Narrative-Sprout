interface UserAgentDataBrand {
  brand: string;
}

interface UserAgentDataLike {
  brands?: UserAgentDataBrand[];
}

const CHROMIUM_BRANDS = new Set(["Chromium", "Google Chrome"]);

function hasChromiumEngineBrand(): boolean {
  const userAgentData = (navigator as Navigator & { userAgentData?: UserAgentDataLike })
    .userAgentData;
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

let activeViewTransitionSelectorSupported: boolean | null = null;

/**
 * True while a view transition is capturing or animating. A layout effect
 * runs inside React's update callback — after the outgoing snapshot was
 * captured (keeping its scroll position) and before the incoming state is
 * captured — which is when the incoming screen can still be laid out at the
 * outgoing scroll offset.
 */
export function isViewTransitionActive(): boolean {
  if (typeof document === "undefined") return false;
  if (activeViewTransitionSelectorSupported === null) {
    activeViewTransitionSelectorSupported =
      typeof CSS !== "undefined" && CSS.supports("selector(:active-view-transition)");
  }
  if (!activeViewTransitionSelectorSupported) return false;
  return document.documentElement.matches(":active-view-transition");
}

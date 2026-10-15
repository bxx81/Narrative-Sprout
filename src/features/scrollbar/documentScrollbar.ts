import { ClickScrollPlugin, OverlayScrollbars } from "overlayscrollbars";

// The plugin is required for `scrollbars.clickScroll` and registered once per
// bundle; imports of this module always run before initialization.
OverlayScrollbars.plugin(ClickScrollPlugin);

/**
 * Replaces the native document scrollbar with an overlay scrollbar.
 *
 * The native scrollbar is hidden by the library, so it never takes layout
 * space: route captures during View Transitions always share one width (no
 * sideways drift) and the title screen's full-bleed photo reaches the
 * viewport edge. The overlay bar is hover-revealed (`autoHide: "leave"`) and
 * supports dragging and track clicks. On platforms where initializing the
 * body would break native behavior (mobile browsers), the library cancels and
 * the native scrollbar returns.
 *
 * Returns the cleanup function (React effect cleanup).
 */
export function initializeDocumentScrollbar(): () => void {
  const instance = OverlayScrollbars(document.body, {
    scrollbars: {
      // No built-in theme: src/styles/overlayScrollbar.css styles the bar
      // with the app's design tokens.
      theme: null,
      autoHide: "leave",
      // Accessibility: keep the bar visible until the first scroll happened.
      autoHideSuspend: true,
      dragScroll: true,
      clickScroll: true,
    },
  });
  return () => instance?.destroy();
}

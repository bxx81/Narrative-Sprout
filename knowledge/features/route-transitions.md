---
type: Feature
title: Route Transitions
description: React 19.3 ViewTransition route cross-fade and zoom-overlay enter, gated to Chromium engines, with the scroll/scrollbar machinery that keeps the outgoing screen still.
tags: [routing, animation, view-transition, scroll, scrollbar]
timestamp: 2026-10-15T00:00:00Z
source: src/app/App.tsx, src/features/viewTransition/api.ts, src/styles/viewTransitions.css, src/components/game/ZoomOverlay.tsx, src/hooks/useLazyNodeImage.ts, src/screens/TitleScreen.tsx, e2e/viewTransitions.spec.ts
---

# Overview

Route changes cross-fade across the routed screens, and the fullscreen zoom overlay scales in, both through React's `<ViewTransition>` (stable since React 19.3, the version this project pins). The boundaries only render when `isViewTransitionAnimationSupported()` from `src/features/viewTransition/api.ts` passes — Chromium-family engines with `document.startViewTransition` and a Chromium/Google Chrome `userAgentData.brand`. Everywhere else the CSS fallbacks stay in place: the route wrapper keeps the legacy `pathname`-keyed `animate-fade-in` mount fade, and the zoom overlay keeps its `isClosing` fade. The animation is decorative by design, so engines with an unproven View Transition implementation degrade to identical DOM behavior, never to a broken one.

# Why the gate exists (WebKit findings)

With the app mounted, `document.startViewTransition()` hard-crashes the renderer in Playwright's WebKit (dev and prod builds; Chromium unaffected) whenever the document is exactly one viewport tall — a state these screens reach routinely through `min-h-screen` with short content. Bisecting isolated the trigger to real content plus an exact viewport-height document (trivial pages, scrollable pages and shorter pages are fine; cancelling all CSS animations does not help). WebKit's View Transition implementation also has a history of use-after-free crashes — React GH-35336 (enter/exit hard-crashing iOS Safari) and a WebKitGTK crash that hits Tauri Linux apps, where the recommended workaround is disabling view transitions — so the gate treats WebKit (including the Tauri WKWebView/WebKitGTK targets) as unproven and keeps the CSS fallback there.

# Route cross-fade mechanics

The boundary is a single `<ViewTransition update="route-cross-fade" default="none">` around `<Routes>` inside `AppLayout`. React names the boundary's nearest DOM node, so the wrapper `div` rendered inside the boundary is the captured element — deliberately a viewport-tall (`min-h-screen`) wrapper: a shorter box would clip fixed, full-bleed decorations inside a screen (the title background) in the snapshot. The cross-fade itself is `/src/styles/viewTransitions.css`:

- `::view-transition-old/new(.route-cross-fade)` replay the existing `fadeOut`/`fadeIn` keyframes **with fill mode `both`**. Without a fill mode the old snapshot reverts to opacity 1 the moment its animation ends and flashes the previous screen over the new one until the pseudo tree is removed.
- A `prefers-reduced-motion` block disables all `::view-transition-*` animations (React does not honor the media query itself).

The stylesheet is imported by `src/index.css` only — never by the standalone chronicle export, whose generated CSS must stay byte-identical.

# Keeping the outgoing screen still

Chromium anchors the outgoing snapshot to the document, so the live scroll position must not change while the animation runs, and the incoming screen must still be captured from its own top. The `AppLayout` machinery in `src/app/App.tsx`:

- **Scroll-validity guard (always on).** A passive scroll listener keeps `min-height = scrollY + innerHeight` on the route wrapper while it is mounted (at or below the natural height during normal browsing, so it never changes the layout). It survives the font-wait gap of the update callback, where the browser would otherwise clamp the scroll the moment a shorter incoming screen commits — the clamp dragged the outgoing snapshot along.
- **Pins (inside the update callback).** A `useLayoutEffect` keyed on `pathname` runs while `:active-view-transition` matches: it pins the wrapper `height` to the outgoing height (the group animation maps the snapshots through the old/new size difference, which drifts the outgoing content by a pixel at fractional device pixel ratios), pushes the incoming screen down by `scrollY` plus its own top padding via `padding-top` (so the incoming snapshot captures its own top and removal is shift-free), and sets `html { overflow-y: hidden }` (the pins make the document artificially scrollable, so the scrollbar would otherwise paint a stale position mid-fade).
- **Release (deferred).** A non-layout effect removes the pins, resets the scroll to 0 and restores the scrollbar **in one frame, in that order**, so the scrollbar never paints the pinned position. React normally flushes this effect after the animation, but the mid-transition `setState`s from image loading flush it early — so the effect waits for `:active-view-transition` to stop matching (30 ms poll) before releasing.

# Scrollbar lane (no layout shift between captures)

A classic scrollbar appearing or disappearing between the two captures changes the layout width and drifts the whole cross-fade sideways. `html { scrollbar-gutter: stable }` reserves the lane permanently: with classic scrollbars the gutter is present even on non-overflowing pages (MDN), while overlay-scrollbar platforms (macOS, Playwright's Chromium) reserve nothing and are unaffected. Pages whose background is the page background stay seamless; the title screen's full-bleed photo cannot paint into the lane, so `TitleScreen` samples the photo's right-edge column into a four-stop vertical gradient at the photo layer's 0.6 brightness and paints the canvas with it (`document.documentElement.style.backgroundImage`), clearing it on unmount. The sampling is skipped when no lane is detected and guarded by `try/catch` because cross-origin images (Tauri's asset protocol) taint the canvas.

Edge settings note: with Edge's "always show scrollbars" accessibility toggle enabled, the reserved lane shows an actual scrollbar on the title; with the default auto-hide behavior the lane blends into the photo.

# Effects under a view transition (the deferral rule)

React defers `useEffect` until the view transition finishes. Anything time-sensitive that starts from an effect therefore waits out the whole animation: this delayed card images on the load/history screens (the lazy image hook only started observing after the fade) and left the zoom overlay deaf to Escape while it animated in. The fixes established this project rule:

- `useLazyNodeImage` observes and loads in `useLayoutEffect` (measured: the blob URL lands ~9 ms after mount instead of ~25 ms after the animation ends).
- `ZoomOverlay`'s key/focus effects are layout effects; the overlay's open animation is `<ViewTransition enter="zoom-overlay-enter">` around the overlay (Chromium-gated like the routes) while closing keeps the CSS `isClosing` fade.

# Verification techniques (E2E)

`e2e/viewTransitions.spec.ts` asserts the boundaries actually activate on Chromium by polling `document.getAnimations({ subtree: true })` for live `::view-transition` pseudo-element animations — including the `fill: "both"` mode, so the reverted-fill flash cannot regress silently. Non-Chromium projects assert the DOM path only.

While debugging, paused-frame inspection proved decisive: pause every view-transition animation the moment it appears, then set `currentTime` to a chosen point, and screenshot — a stable mid-transition frame. Plain screenshot sampling at 60 ms intervals mostly caught late, blended frames and repeatedly misled. Note that headless (and this machine's headful) Chromium uses overlay or hidden scrollbars, so classic-scrollbar behavior (the lane) cannot be reproduced in Playwright here; those changes are verified on a real browser instead.

**Chromium blocks pointer input while a transition animates**: hit-testing lands on the `::view-transition` overlay and retargets to `<html>`, so raw clicks and touches dispatched mid-fade never reach the app (an explicit `::view-transition { pointer-events: none }` does not change this). Real interactions after a navigation settle are unaffected, but tests must wait the transition out: `startStory`/`waitForRouteTransition` in `e2e/helpers/story.ts` waits for `:active-view-transition` to appear (bounded) and then to clear before returning, and the long-press specs hold until the copy toast appears instead of a fixed timeout so CPU-delayed timers cannot turn a completed gesture into a cancelled one.

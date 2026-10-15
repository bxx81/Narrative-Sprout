---
type: Feature
title: Overlay Scrollbar
description: OverlayScrollbars-backed document scrollbar that never takes layout space, replaces the native scrollbar on every screen, and reveals on hover with drag and track-click support.
tags: [scrollbar, scrolling, layout, accessibility]
timestamp: 2026-10-15T00:00:00Z
source: src/features/scrollbar/, src/styles/overlayScrollbar.css, src/app/App.tsx, src/screens/TitleScreen.tsx, index.html, vite.config.ts
---

# Overview

The document (window) scrollbar is an overlay bar backed by OverlayScrollbars v2, initialized once from `App` via `initializeDocumentScrollbar()` (`src/features/scrollbar/api.ts`). The native scrollbar is hidden, so the bar only ever takes visual space — never layout space. The module also registers `ClickScrollPlugin` (required for `clickScroll`).

# Why (two problems solved)

1. **Route capture width.** A classic scrollbar appearing or disappearing between the outgoing and incoming View Transition captures changes the layout width and drifts the whole cross-fade sideways. `html { scrollbar-gutter: stable }` kept a reserved lane, but the lane cannot be painted with the title photo: on Chromium/Edge the lane is painted by the canvas background **color** only, and background images (body/html, `cover`/`100vw`/`fixed`) as well as fixed elements and box-shadows are clipped at the lane edge (measured on Edge 155). The old `innerWidth - clientWidth` lane detection also never fired on the non-overflowing title screen where the lane was exposed. With the native bar hidden, the layout width is constant everywhere and the full-bleed title photo reaches the viewport edge (the title's edge-sampling gradient effect is gone).
2. **Hover affordance.** Native overlay scrollbars (macOS and similar) appear only on scroll, so they cannot be clicked until a wheel scroll reveals them. The overlay bar uses `autoHide: "leave"` with `autoHideSuspend: true`: it is visible while the pointer is inside the window (and stays visible until the first scroll), draggable (`dragScroll: true`) and track-clickable (`clickScroll: true`).

# Initialization details

- `index.html` carries `data-overlayscrollbars-initialize` on `html` and `body`, so the native scrollbar is hidden from the first paint (no flash of the native bar). The library removes the attributes during cleanup if initialization is canceled.
- Body initialization keeps `document.scrollingElement = html`: `window.scrollY` / `window.scrollTo` keep working and the `AppLayout` pin/release machinery is unchanged. The library appends `body > .os-scrollbar` (fixed, `z-index: 99999`) and leaves React's DOM alone.
- `cancel` keeps its defaults (`nativeScrollbarsOverlaid: false`, `body: null`): on platforms where initializing the body would break native behavior (mobile browsers), the library cancels and the native scrollbar returns.
- Theming lives in `src/styles/overlayScrollbar.css` with the library defaults switched off (`theme: null`): `.os-scrollbar` custom properties are driven by `--color-border` (light/dark tokens). The bar is hidden (`display: none`) while `html:active-view-transition` matches so the pinned scroll cannot paint a stale handle.
- The library is split into its own vendor chunk (`overlayscrollbars` in `vite.config.ts` `manualChunks`) for PWA cache efficiency, matching the other vendors.

# Verification

Verified against real Edge (Windows, classic scrollbars) on the running app: no reserved lane (`html` rect width == `innerWidth` on the title), hover-visible bar on overflowing screens, `window.scrollTo`, drag and track-click all work, and the bar computes `display: none` while `:active-view-transition` matches during a title → settings cross-fade. Playwright's Chromium uses overlay/hidden scrollbars, so classic-platform rendering is verified on a real browser instead.

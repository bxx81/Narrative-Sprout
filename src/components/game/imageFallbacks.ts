const FALLBACK_IMAGE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><rect width="1024" height="1024" fill="#1f2937"/><g style="font-family: Inter, sans-serif; text-anchor: middle; dominant-baseline: middle;"><g transform="translate(0 -40)"><path d="M487,487 L537,537 M537,487 L487,537" stroke="#9ca3af" stroke-width="12" stroke-linecap="round"/><text x="512" y="620" font-size="40" fill="#e5e7eb" font-weight="bold">Image Generation Failed</text><text x="512" y="670" font-size="28" fill="#d1d5db">Click the regenerate button to try again</text></g></g></svg>`;

const TRANSPARENT_IMAGE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="100%" height="100%" fill="#ffffff00"/></svg>';

const LOAD_SCREEN_FALLBACK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><rect width="1024" height="1024" fill="#1f2937"/><g style="font-family: Inter, sans-serif; text-anchor: middle; dominant-baseline: middle;"><g transform="translate(0 -40)"><path d="M487,487 L537,537 M537,487 L487,537" stroke="#9ca3af" stroke-width="12" stroke-linecap="round"/><text x="512" y="620" font-size="40" fill="#e5e7eb" font-weight="bold">Image Not Available</text></g></g></svg>`;

const toDataUrl = (svg: string) =>
  `data:image/svg+xml;base64,${typeof window !== "undefined" ? window.btoa(svg) : ""}`;

/** Shown when image generation failed. */
export const FALLBACK_IMAGE_URL = toDataUrl(FALLBACK_IMAGE_SVG);
/** Blank placeholder while no image exists. */
export const TRANSPARENT_IMAGE_URL = toDataUrl(TRANSPARENT_IMAGE_SVG);
/** Shown on cards when a save/branch has no image. */
export const LOAD_SCREEN_FALLBACK_URL = toDataUrl(LOAD_SCREEN_FALLBACK_SVG);

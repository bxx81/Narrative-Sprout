import { isDebug } from "./debugLog";

/**
 * Canonical production origin. Standalone chronicle exports reference their
 * fonts (and attribution link) only here — no third-party CDNs
 * (knowledge/features/story-export.md chronicle export).
 */
export const siteOrigin = "https://narrative-sprout.pages.dev";

export const termsUrl = isDebug ? "/legal/terms_of_service.html" : "/legal/terms_of_service";
export const privacyUrl = isDebug ? "/legal/privacy_policy.html" : "/legal/privacy_policy";
export const licenseUrl = isDebug ? "/legal/license.html" : "/legal/license";

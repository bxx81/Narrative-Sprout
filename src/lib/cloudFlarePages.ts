import { isDebug } from "./debugLog";

export const guideUrl = "https://narrative-sprout-docs.pages.dev";
export const termsUrl = isDebug ? "/legal/terms_of_service.html" : "/legal/terms_of_service";
export const privacyUrl = isDebug ? "/legal/privacy_policy.html" : "/legal/privacy_policy";
export const licenseUrl = isDebug ? "/legal/license.html" : "/legal/license";

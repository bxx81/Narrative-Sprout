/**
 * Language identity helpers for the 5 built-in UI languages plus AI dynamic
 * translations (REDESIGN §4.2 `features/i18n`).
 *
 * Languages are identified by their native display name ("English", "日本語",
 * "汉语", "한국어", "臺灣華語") in the settings record, and mapped to IETF
 * language tags only where a code is required (i18next, DOM, Intl).
 */

/** A flat UI translation bundle: translation key → translated text. */
export type Translation = Record<string, string>;

/** The 5 built-in languages in selector order. */
export const builtInLanguages = ["English", "日本語", "汉语", "한국어", "臺灣華語"] as const;

const builtInLanguageCodes: Record<string, string> = {
  English: "en",
  日本語: "ja",
  汉语: "zh",
  한국어: "ko",
  臺灣華語: "zh-tw",
};

/**
 * Maps a language display name to an IETF language tag. AI-translated
 * languages fall through to the persisted mapping table (or to their own
 * name when unknown).
 */
export function getLanguageCode(
  languageName: string,
  aiLanguageMappings?: Record<string, string>,
): string {
  const builtIn = builtInLanguageCodes[languageName];
  if (builtIn) return builtIn;
  return aiLanguageMappings?.[languageName] ?? languageName;
}

/**
 * Detects the initial UI language from the browser preferences (legacy
 * `getInitialLanguage`). Traditional Chinese variants are checked before the
 * generic `zh` prefix, which the legacy implementation matched first.
 */
export function getInitialUiLanguage(): string {
  if (typeof window === "undefined" || !navigator.language) {
    return "English";
  }
  const candidates = [...(navigator.languages ?? []), navigator.language];
  for (const candidate of candidates) {
    const browserLanguage = candidate.toLowerCase();
    if (browserLanguage.startsWith("ja")) return "日本語";
    if (
      browserLanguage.startsWith("zh-tw") ||
      browserLanguage.startsWith("zh-hant") ||
      browserLanguage.startsWith("zh-hk")
    ) {
      return "臺灣華語";
    }
    if (browserLanguage.startsWith("zh")) return "汉语";
    if (browserLanguage.startsWith("ko")) return "한국어";
  }
  return "English";
}

const RTL_LANGUAGE_PREFIXES = [
  "ar", // Arabic
  "fa", // Persian (Farsi)
  "he", // Hebrew
  "iw", // Hebrew (legacy code)
  "ur", // Urdu
  "ps", // Pashto
  "sd", // Sindhi
  "dv", // Divehi
  "ug", // Uyghur
  "ks", // Kashmiri
];

export function isRightToLeftLanguage(languageCode: string): boolean {
  const lower = languageCode.toLowerCase();
  return RTL_LANGUAGE_PREFIXES.some((prefix) => lower === prefix || lower.startsWith(prefix + "-"));
}

/** Self-hosted per-language font stylesheets under `public/s/` (legacy fontMap). */
const languageFontCss: Record<string, string> = {
  ja: "/s/ja.css",
  zh: "/s/zh.css",
  "zh-hans": "/s/zh.css",
  "zh-tw": "/s/zh-tw.css",
  "zh-hant": "/s/zh-tw.css",
  "zh-hk": "/s/zh-hk.css",
  ko: "/s/ko.css",
  lo: "/s/lo.css",
  th: "/s/th.css",
  hi: "/s/hi.css",
  he: "/s/he.css",
  ar: "/s/ar.css",
};

/**
 * Loads the self-hosted font stylesheet for the language when it needs one
 * (English is already loaded globally from index.html). Falls back to the
 * two-letter primary tag for tags like `xx-YY`.
 */
export function loadFontForLanguage(languageCode: string): void {
  if (document.querySelector(`link[data-lang-font="${languageCode}"]`)) return;
  if (languageCode.toLowerCase().startsWith("en")) return;

  const fontUrl = languageFontCss[languageCode.toLowerCase()];
  if (!fontUrl) {
    const shortLanguage = languageCode.substring(0, 2);
    if (shortLanguage !== languageCode) {
      loadFontForLanguage(shortLanguage);
    }
    return;
  }

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = fontUrl;
  link.setAttribute("data-lang-font", languageCode);
  document.head.appendChild(link);
}

/**
 * Applies the UI language to the document: `html lang`, text direction and
 * the per-language font stylesheet (legacy App.tsx language effect).
 */
export function applyLanguageDocumentEffects(
  languageName: string,
  aiLanguageMappings: Record<string, string>,
): void {
  const languageCode = getLanguageCode(languageName, aiLanguageMappings);
  document.documentElement.lang = languageCode;
  document.documentElement.dir = isRightToLeftLanguage(languageCode) ? "rtl" : "ltr";
  loadFontForLanguage(languageCode);
}

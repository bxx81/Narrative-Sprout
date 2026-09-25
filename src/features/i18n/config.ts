import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import ja from "./locales/ja.json";
import zh from "./locales/zh.json";
import zhTw from "./locales/zh-tw.json";
import ko from "./locales/ko.json";

/**
 * i18next with the 5 built-in languages bundled at build time. Bundling
 * instead of the legacy http-backend keeps every locale in
 * the PWA precache, so the UI keeps working offline. AI dynamic
 * translations are injected at runtime with `addResourceBundle`.
 */
const resources = {
  en: { translation: en },
  ja: { translation: ja },
  zh: { translation: zh },
  "zh-tw": { translation: zhTw },
  ko: { translation: ko },
};

void i18next.use(initReactI18next).init({
  lng: "en",
  fallbackLng: "en",
  lowerCaseLng: true,
  load: "currentOnly",
  defaultNS: "translation",
  resources,
  interpolation: {
    // React already escapes interpolated values (legacy comment kept).
    escapeValue: false,
  },
  react: {
    useSuspense: false,
  },
});

export default i18next;

/**
 * Translation for non-React call sites (toasts, logs, store helpers) that
 * cannot use `useTranslation`. The `defaultValue` keeps the call usable when
 * a key is missing from the active locale (the English bundle is the
 * `fallbackLng`, so this only matters before init settles).
 */
export function translate(key: string, defaultValue?: string): string {
  return i18next.t(key, { defaultValue: defaultValue ?? key });
}

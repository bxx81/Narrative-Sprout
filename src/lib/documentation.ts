/**
 * External user-guide (Docusaurus) links.
 *
 * The guide lives in a separate repository and is deployed to Cloudflare Pages
 * at `documentationBaseUrl`. Its docs use `routeBasePath: "/"`, so pages sit at
 * the root (e.g. `/image_generators/a1111`). The anchors are duplicated here
 * because the docs repository cannot be imported at build time;
 * `documentation.test.ts` guards the map against accidental edits.
 *
 * Locales: the guide's default locale is Japanese (no URL prefix), while
 * English is served under `/en`. Every other UI language the app supports has
 * no guide locale and falls back to English.
 *
 * Versions: the app is the v2 rebuild, so links always target the current docs
 * at the root — never the legacy `/legacy/...` tree.
 */

/** Root URL of the deployed user guide (Cloudflare Pages). */
export const documentationBaseUrl = "https://narrative-sprout-docs.pages.dev";

/** Guide page paths, mirroring the docs repository's `docs/` tree. */
export const documentationAnchor = {
  imageGenerators: "/image_generators",
  automatic1111: "/image_generators/a1111",
  comfyUI: "/image_generators/comfyui",
  huggingFace: "/image_generators/hugging_face",
  nvidiaNim: "/image_generators/nvidia_nim",
  gettingStarted: "/play/start",
  edit: "/play/edit",
  streaming: "/text_generators/streaming",
  llmOptions: "/text_generators/llm_options",
  compaction: "/text_generators/compaction",
  apiKeyPkce: "/text_generators/api_key_pkce",
  backupRestore: "/data_management/backup_restore",
  translation: "/settings/translation",
} as const;

export type DocumentationAnchor = (typeof documentationAnchor)[keyof typeof documentationAnchor];

/**
 * Builds a locale-aware guide URL. `languageCode` is the active i18n code
 * (`i18n.language`); Japanese maps to the unprefixed default locale, anything
 * else to `/en`.
 */
export function documentationUrl(anchor: DocumentationAnchor, languageCode = "en"): string {
  const localePrefix = languageCode.toLowerCase().startsWith("ja") ? "" : "/en";
  return `${documentationBaseUrl}${localePrefix}${anchor}`;
}

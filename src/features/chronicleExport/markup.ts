import { LOAD_SCREEN_FALLBACK_URL } from "../../components/game/imageFallbacks";
import { siteOrigin } from "../../lib/cloudFlarePages";
import {
  IMAGE_ALT_MAX_LENGTH,
  INLINE_QUOTE_MAX_LENGTH,
  truncateText,
} from "../../lib/truncateText";
import type { ChronicleExportInput, ChronicleExportNode } from "./types";

/**
 * Pure HTML builder for the standalone chronicle page. Class names are kept as
 * static string literals so the Tailwind CLI (`@source "./markup.ts"`) sees
 * every utility it must emit — the page's layout is generated, not hand-written.
 */

// Mirror of the classes applied by ChronicleScreen/MainText. Kept in one place
// so the exported page matches the in-app chronicle.
const CLASS = {
  main: "mx-auto mb-20 max-w-384 p-4",
  header: "text-center",
  title: "font-serif-display text-3xl font-bold md:text-4xl",
  description: "support-text-color mx-auto my-2 max-w-3xl text-lg",
  section: "mx-auto max-w-2xl",
  article:
    "text-bg-color mb-6 max-w-2xl rounded-lg p-4 shadow-md select-text sm:p-6 md:min-w-[20rem]",
  figure: "mb-4 overflow-hidden rounded-lg",
  image: "animate-fade-in size-full object-cover",
  sceneWrap: "font-serif-display mb-4 [line-break:strict]",
  mainText: "main-text-prose space-y-8 text-[18px] leading-[2.2] whitespace-pre-wrap",
  closingExtra: "mt-4 font-bold",
  choiceBlock: "mt-6 border-t border-dashed border-text-border pt-4 text-center",
  choicePrefix: "support-text-color text-sm",
  choiceText: "font-semibold wrap-anywhere",
  attribution: "mb-5 text-center text-sm text-text-support",
  attributionLink: "text-primary hover:underline",
} as const;

const HTML_ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#039;",
};

/** Escapes text for safe interpolation into HTML text and attributes. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => HTML_ESCAPE_MAP[character] ?? character);
}

/**
 * Renders prose the way `MainText` does: one `<p>` per line, with `**bold**`
 * spans, `---`/`***` divider lines, and the bracket-start indent rule.
 */
function renderProse(text: string, sceneTextClass: string): string {
  const lines = text.split("\n");
  const renderedLines = lines
    .map((line) => {
      if (/^---+\s*$|^\*\*\*+\s*$/.test(line.trim())) {
        return '<hr class="text-divider dividers-marker">';
      }

      const startsWithBracket = /^[「『（(〔［[｛{〈《]/.test(line.trimStart());
      const paragraphClasses = [sceneTextClass, startsWithBracket ? "bracket-start" : ""]
        .filter(Boolean)
        .join(" ");

      const inner = line
        .split(/(\*\*.*?\*\*)/g)
        .map((part) => {
          if (part.startsWith("**") && part.endsWith("**")) {
            return `<strong class="font-bold">${escapeHtml(part.slice(2, -2))}</strong>`;
          }
          return escapeHtml(part);
        })
        .join("");

      return `<p class="${paragraphClasses}">${inner}</p>`;
    })
    .join("");

  return `<div class="${CLASS.mainText}">${renderedLines}</div>`;
}

function renderNode(node: ChronicleExportNode, input: ChronicleExportInput): string {
  const imageSource = node.imagePath ? `./${node.imagePath}` : LOAD_SCREEN_FALLBACK_URL;
  const imageAlt = escapeHtml(truncateText(node.imagePrompt, IMAGE_ALT_MAX_LENGTH));

  const closing =
    node.storyClosingText && node.storyClosingText.length > 0
      ? renderProse(node.storyClosingText, `${input.sceneTextClass} ${CLASS.closingExtra}`)
      : "";

  const choice = node.choiceText
    ? `<div class="${CLASS.choiceBlock}">
<p class="${CLASS.choicePrefix}">${escapeHtml(input.historyChoicePrefix)}</p>
<p class="${CLASS.choiceText} ${input.choicesClass}">"${escapeHtml(
        truncateText(node.choiceText, INLINE_QUOTE_MAX_LENGTH),
      )}"</p>
</div>`
    : "";

  return `<article class="${CLASS.article}">
<figure class="${CLASS.figure}">
<img src="${imageSource}" alt="${imageAlt}" class="${CLASS.image}" />
</figure>
<figcaption>
<div class="${CLASS.sceneWrap}">
${renderProse(node.sceneText, input.sceneTextClass)}
${closing}
</div>
${choice}
</figcaption>
</article>`;
}

function renderFontLinks(input: ChronicleExportInput): string {
  const links = [`${siteOrigin}/s/en.css`];
  if (input.languageFontCssPath && input.languageFontCssPath !== "/s/en.css") {
    links.push(`${siteOrigin}${input.languageFontCssPath}`);
  }
  return links.map((href) => `<link rel="stylesheet" href="${href}" />`).join("\n");
}

/** Builds the full standalone HTML document (fonts from the deploy origin only). */
export function buildChronicleHtml(input: ChronicleExportInput, cssText: string): string {
  const nodes = input.nodes.map((node) => renderNode(node, input)).join("\n");

  return `<!DOCTYPE html>
<html lang="${escapeHtml(input.htmlLanguage)}" dir="${input.direction}">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(input.chronicleTitle)}</title>
<meta name="color-scheme" content="light dark" />
${renderFontLinks(input)}
<style>
${cssText}
</style>
<script>
(function () {
  if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    document.documentElement.classList.add("dark");
  }
})();
</script>
</head>
<body>
<main class="${CLASS.main}">
<p class="${CLASS.attribution}">Generated by <a href="${siteOrigin}/" target="_blank" rel="noopener noreferrer" class="${CLASS.attributionLink}">Narrative Sprout</a></p>
<header class="${CLASS.header}">
<h1 class="${CLASS.title}">${escapeHtml(input.chronicleTitle)}</h1>
<p class="${CLASS.description}">${escapeHtml(input.chronicleDescription)}</p>
</header>
<section class="${CLASS.section}">
${nodes}
</section>
</main>
</body>
</html>`;
}

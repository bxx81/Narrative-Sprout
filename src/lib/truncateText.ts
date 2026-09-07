/**
 * Truncates a long display string with an ellipsis so tens-of-KB theme
 * texts / titles cannot break card or dialog layouts.
 *
 * Uses code-point splitting (Array.from) so surrogate pairs and emoji are
 * never torn apart. Short strings are returned untouched.
 */
export const CARD_TITLE_MAX_LENGTH = 100;
export const CARD_PREVIEW_MAX_LENGTH = 200;
export const IMAGE_ALT_MAX_LENGTH = 200;
export const DIALOG_EMBEDDED_TITLE_MAX_LENGTH = 100;
export const INLINE_QUOTE_MAX_LENGTH = 200;

const ELLIPSIS = "…";

export function truncateText(text: string, maxLength: number): string {
  if (maxLength <= 0) return "";
  const codePoints = Array.from(text);
  if (codePoints.length <= maxLength) return text;
  return `${codePoints.slice(0, maxLength).join("").trimEnd()}${ELLIPSIS}`;
}

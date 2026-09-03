/**
 * Locale-aware word counting (legacy `Intl.Segmenter` count). The segmenter
 * is built from the globally configured narrative language and refreshed via
 * `setWordCountLanguage` whenever the settings change; word-like segments
 * (whitespace-delimited words, CJK 分かち書き units) are then counted.
 */

let segmenter: Intl.Segmenter | null = null;

/** Rebuilds the word segmenter for an IETF language tag (null resets it). */
export function setWordCountLanguage(languageCode: string | undefined): void {
  try {
    segmenter = languageCode ? new Intl.Segmenter(languageCode, { granularity: "word" }) : null;
  } catch (error) {
    console.warn("[narrative] invalid word count language ignored", languageCode, error);
    segmenter = null;
  }
}

export function countWords(text: string): number {
  if (!segmenter || text.length === 0) {
    // No narrative language configured yet: whitespace words only.
    return text.trim().split(/\s+/).filter(Boolean).length;
  }
  let count = 0;
  for (const segment of segmenter.segment(text)) {
    if (segment.isWordLike) count++;
  }
  return count;
}

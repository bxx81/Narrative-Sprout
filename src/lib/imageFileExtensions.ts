/**
 * Image asset format registry (REDESIGN.md §5.3).
 *
 * - `ImageMimeType` lists every supported image encoding. Add new formats
 *   (e.g. AVIF, JPEG XL) here and in `imageFileExtensions` — nowhere else.
 * - Never hardcode ".webp" (or any extension) in production code; derive it
 *   via `getImageFileExtension`.
 */
export type ImageMimeType = "image/webp";

export const imageFileExtensions: Record<ImageMimeType, string> = {
  "image/webp": "webp",
};

export function getImageFileExtension(mimeType: ImageMimeType): string {
  return imageFileExtensions[mimeType];
}

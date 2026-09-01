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

/** Inverse of `imageFileExtensions`, derived once from the single source of truth. */
const mimeTypeByFileExtension: Record<string, ImageMimeType> = Object.fromEntries(
  Object.entries(imageFileExtensions).map(([mimeType, extension]) => [
    extension,
    mimeType as ImageMimeType,
  ]),
);

/**
 * Looks up the image mime type for a file extension (e.g. "webp").
 * Returns `undefined` for unknown extensions — callers must skip those
 * instead of guessing (§5.3: the extension table is the only mapping).
 */
export function getImageMimeTypeFromExtension(extension: string): ImageMimeType | undefined {
  return mimeTypeByFileExtension[extension.toLowerCase()];
}

/** Type guard over the registry (unknown strings must never become a mime type). */
export function isKnownImageMimeType(mimeType: string): mimeType is ImageMimeType {
  return mimeType in imageFileExtensions;
}

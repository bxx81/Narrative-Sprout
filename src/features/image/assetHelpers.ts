import type { AssetRecord } from "../../types/asset";
import type { StoryNodeId } from "../../types/ids";
import type { ImageMimeType } from "../../lib/imageFileExtensions";
import { base64DataUrlToBlob, convertToWebpBlob, dataUrlToBlob } from "../../lib/imageConversion";

/**
 * Creates an `AssetRecord` from a `data:` URL (the output of `generateSceneImage`).
 *
 * - Decodes the data URL to a Blob.
 * - Converts to WebP at the configured quality (unless already a small WebP).
 * - Returns the record ready for `assetRepository.put`.
 *
 * If the data URL is an SVG fallback (disabled generator), it is returned as-is
 * with `image/svg+xml` mime; callers may choose to skip persisting that case.
 */
export async function assetRecordFromDataUrl(
  nodeId: StoryNodeId,
  dataUrl: string,
  quality: number,
): Promise<AssetRecord | null> {
  if (!dataUrl.startsWith("data:")) return null;
  // SVG fallback from disabled generator: keep as-is but store as svg (not webp)
  if (dataUrl.startsWith("data:image/svg+xml")) {
    // For now, skip persisting SVG fallbacks — the UI can show the inline fallback.
    // If we ever want to persist them, extend `ImageMimeType` to include svg.
    return null;
  }
  let blob: Blob;
  if (dataUrl.startsWith("data:image")) {
    // Fast path for base64 data URLs without fetch
    try {
      blob = base64DataUrlToBlob(dataUrl);
    } catch {
      blob = await dataUrlToBlob(dataUrl);
    }
  } else {
    blob = await dataUrlToBlob(dataUrl);
  }
  const webpBlob = await convertToWebpBlob(blob, quality);
  const mimeType: ImageMimeType = "image/webp";
  // Ensure the blob's type matches mimeType (convertToWebpBlob returns image/webp or original)
  const finalBlob =
    webpBlob.type === mimeType ? webpBlob : new Blob([webpBlob], { type: mimeType });
  return {
    nodeId: nodeId as string as StoryNodeId,
    blob: finalBlob,
    mimeType,
    byteSize: finalBlob.size,
    updatedAt: new Date().toISOString(),
  };
}

export function webpQualityForCompression(compression: "normal" | "high"): number {
  return compression === "high" ? 1 : 0.9;
}

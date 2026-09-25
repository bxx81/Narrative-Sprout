import type { AssetRecord } from "../../types/asset";
import type { StoryNodeId } from "../../types/ids";
import type { ImageMimeType } from "../../lib/imageFileExtensions";
import { convertToWebpBlob, dataUrlToBlob } from "../../lib/imageConversion";

/**
 * Creates an `AssetRecord` from a `data:` URL (the output of `generateSceneImage`).
 *
 * - Decodes the data URL to a Blob.
 * - Converts to WebP at the configured quality (unless already a small WebP).
 * - Returns the record ready for `assetRepository.put`.
 *
 * Returns `null` (no asset stored) for anything that is not a real raster
 * image, so a failure degrades to the same state as the disabled backend.
 */
export async function assetRecordFromDataUrl(
  nodeId: StoryNodeId,
  dataUrl: string,
  quality: number,
): Promise<AssetRecord | null> {
  if (!dataUrl.startsWith("data:")) return null;
  // Defensive: no code path produces an SVG data URL today (generation
  // failures are rethrown by generateSceneImage, and the turn flow skips the
  // disabled backend entirely), so an SVG must never be stored as an image.
  if (dataUrl.startsWith("data:image/svg+xml")) {
    return null;
  }
  // Decode the data URL via fetch: the platform handles base64 and
  // URL-encoded payloads for any mime, so no manual atob path is needed.
  const blob = await dataUrlToBlob(dataUrl);
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

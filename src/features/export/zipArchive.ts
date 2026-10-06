import { strToU8, type Zippable } from "fflate";
import { createZipBlob } from "../../lib/zipArchive";
import type { ExportBundle } from "./types";

/**
 * Archives an ns-save bundle into a ZIP Blob (knowledge/features/story-export.md).
 *
 * WebP assets are already compressed, so they are stored uncompressed
 * (level 0); JSON text files use the default deflate level.
 */
export async function createZipArchiveBlob(bundle: ExportBundle): Promise<Blob> {
  const files: Zippable = {
    "manifest.json": strToU8(JSON.stringify(bundle.manifest, null, 2)),
  };
  for (const nodeFile of bundle.nodeFiles) {
    files[nodeFile.path] = strToU8(nodeFile.json);
  }
  for (const assetFile of bundle.assetFiles) {
    const bytes = new Uint8Array(await assetFile.blob.arrayBuffer());
    files[assetFile.path] = [bytes, { level: 0 }];
  }
  return createZipBlob(files);
}

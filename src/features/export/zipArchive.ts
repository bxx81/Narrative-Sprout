import { strToU8, zip, type Zippable } from "fflate";
import type { ExportBundle } from "./types";

/**
 * Archives an ns-save bundle into a ZIP Blob (REDESIGN.md §5.5).
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
  return new Promise<Blob>((resolve, reject) => {
    zip(files, (error, archive) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(new Blob([archive], { type: "application/zip" }));
    });
  });
}

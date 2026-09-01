import { db } from "./database";
import { getImageFileExtension } from "../lib/imageFileExtensions";
import type { AssetRecord } from "../types/asset";
import type { ImageMimeType } from "../lib/imageFileExtensions";

/**
 * Repository for the `assets` store (REDESIGN.md §5.3).
 *
 * - 1:1 by `nodeId`. Regeneration overwrites, deletion is always transactional
 *   with its node (see `gameRepository` helpers).
 * - Orphan garbage is collected on startup / after deletes (§5.3 GC).
 */
export const assetRepository = {
  async put(asset: AssetRecord): Promise<void> {
    await db.assets.put(asset);
  },

  async get(nodeId: string): Promise<AssetRecord | undefined> {
    return db.assets.get(nodeId);
  },

  async delete(nodeId: string): Promise<void> {
    await db.assets.delete(nodeId);
  },

  async bulkDelete(nodeIds: string[]): Promise<void> {
    // Cheap outside-transaction helper; transactional bulk delete lives in
    // gameRepository where nodes+assets are removed atomically.
    await db.assets.bulkDelete(nodeIds);
  },

  /** URL for displaying an asset (object URL). Caller must revoke when done. */
  toObjectUrl(asset: AssetRecord): string {
    return URL.createObjectURL(asset.blob);
  },

  /**
   * Orphan GC: removes any asset whose node no longer exists.
   * Returns the number of deleted orphans.
   */
  async collectGarbage(): Promise<number> {
    const [allAssets, allNodeIds] = await Promise.all([
      db.assets.toArray(),
      db.nodes.toCollection().primaryKeys(),
    ]);
    const live = new Set(allNodeIds as string[]);
    const orphanIds = allAssets.filter((a) => !live.has(a.nodeId)).map((a) => a.nodeId);
    if (orphanIds.length > 0) {
      await db.assets.bulkDelete(orphanIds);
      console.warn(`[assets] GC removed ${orphanIds.length} orphan(s)`, orphanIds);
    }
    return orphanIds.length;
  },

  /** Derive a filename for ZIP export from an asset's mimeType (§5.3). */
  fileNameForAsset(nodeId: string, mimeType: ImageMimeType): string {
    return `${nodeId}.${getImageFileExtension(mimeType)}`;
  },
};

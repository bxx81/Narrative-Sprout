import { getImageFileExtension } from "../../lib/imageFileExtensions";
import type { GameRecord, StoryNodeRecord } from "../../types";
import type { AssetRecord } from "../../types/asset";
import type { ExportAssetFile, ExportBundle, ExportNodeFile, NSaveManifest } from "./types";
import { NS_SAVE_FORMAT, NS_SAVE_VERSION } from "./types";

/**
 * Pure builders for the ns-save bundle (REDESIGN.md §5.5).
 *
 * The bundle receives only `GameRecord` / `StoryNodeRecord` / `AssetRecord` —
 * settings and credentials cannot structurally enter an export (AGENTS rule 3).
 */

export function buildManifest(game: GameRecord, exportedAt: string): NSaveManifest {
  return {
    format: NS_SAVE_FORMAT,
    version: NS_SAVE_VERSION,
    exportedAt,
    game,
  };
}

/**
 * Assembles every file the archive will contain.
 * Assets whose node is missing are skipped with a warning (should not happen
 * thanks to 1:1 keys + GC, but exporting must never crash on one).
 */
export function buildExportBundle(
  game: GameRecord,
  nodes: StoryNodeRecord[],
  assets: AssetRecord[],
  exportedAt: string = new Date().toISOString(),
): ExportBundle {
  const manifest = buildManifest(game, exportedAt);

  const orderedNodes = [...nodes].sort((a, b) => a.turnNumber - b.turnNumber);
  const nodeIds = new Set<string>(orderedNodes.map((node) => node.id));

  const nodeFiles: ExportNodeFile[] = orderedNodes.map((node) => ({
    nodeId: node.id,
    path: `nodes/${node.id}.json`,
    json: JSON.stringify(node, null, 2),
  }));

  const assetFiles: ExportAssetFile[] = [];
  for (const asset of assets) {
    if (!nodeIds.has(asset.nodeId)) {
      console.warn(`[export] skipping orphan asset without node: ${asset.nodeId}`);
      continue;
    }
    assetFiles.push({
      nodeId: asset.nodeId,
      path: `assets/${asset.nodeId}.${getImageFileExtension(asset.mimeType)}`,
      blob: asset.blob,
    });
  }

  return { manifest, nodeFiles, assetFiles };
}

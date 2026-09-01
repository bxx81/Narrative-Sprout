import { db } from "../../db/database";
import { gameRepository } from "../../db/gameRepository";
import type { AssetRecord } from "../../types/asset";
import type { GameRecord } from "../../types";
import { buildExportBundle } from "./exportBundle";
import { createZipArchiveBlob } from "./zipArchive";

/**
 * Orchestrates a full game export: loads the save from IndexedDB, builds the
 * ns-save bundle and returns a ready-to-download ZIP (REDESIGN.md §5.5).
 */

export interface ExportedSave {
  fileName: string;
  blob: Blob;
}

export async function exportGameAsZip(gameId: string): Promise<ExportedSave> {
  const game = await gameRepository.getGame(gameId);
  if (!game) throw new Error(`Cannot export: game not found (${gameId})`);

  const nodes = await gameRepository.getNodesOfGame(gameId);
  const assets = await loadAssetsOfNodes(nodes.map((node) => node.id));

  const bundle = buildExportBundle(game, nodes, assets);
  const blob = await createZipArchiveBlob(bundle);
  return { fileName: buildExportFileName(game), blob };
}

async function loadAssetsOfNodes(nodeIds: string[]): Promise<AssetRecord[]> {
  if (nodeIds.length === 0) return [];
  const records = await db.assets.bulkGet(nodeIds);
  return records.filter((record): record is AssetRecord => record !== undefined);
}

/** e.g. `ns-save_黄昏の王国_2026-09-01-12-30-45.zip` */
function buildExportFileName(game: GameRecord): string {
  const safeTitle = sanitizeFileName(game.title).slice(0, 40) || "game";
  const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);
  return `ns-save_${safeTitle}_${stamp}.zip`;
}

/** Removes characters that are invalid in file names across OSes. */
function sanitizeFileName(title: string): string {
  return [...title.replace(/[<>:"/\\|?*]/g, "")]
    .filter((char) => (char.codePointAt(0) ?? 0) >= 0x20) // drop control characters
    .join("")
    .trim();
}

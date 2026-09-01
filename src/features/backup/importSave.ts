import { strFromU8, unzip } from "fflate";
import { storyNodeRecordSchema, type StoryNodeRecord } from "../../types/game";
import { storyNodeIdSchema } from "../../types";
import type { AssetRecord } from "../../types/asset";
import type { GameRecord } from "../../types";
import { NS_SAVE_VERSION, nsSaveManifestSchema } from "../export/api";
import { getImageMimeTypeFromExtension } from "../../lib/imageFileExtensions";
import { restoreRepository } from "../../db/restoreRepository";
import type { RestoreSummary } from "./types";

/**
 * Imports a single-save `ns-save` ZIP (REDESIGN.md §5.5).
 *
 * Element-wise validation (§5.7): invalid node files are skipped with a
 * warning. Nodes belonging to another game id than the manifest's are
 * skipped so a doctored archive cannot inject foreign subtrees.
 */

export interface SaveImportResult extends RestoreSummary {
  gameTitle: string;
}

function unzipSaveEntries(bytes: Uint8Array): Promise<Record<string, Uint8Array>> {
  return new Promise((resolve, reject) => {
    unzip(bytes, (error, data) => {
      if (error) {
        reject(new Error("This file is not a readable ZIP archive.", { cause: error }));
        return;
      }
      resolve(data);
    });
  });
}

function splitFileName(fileName: string): { nodeId: string; extension: string } | null {
  const dotIndex = fileName.lastIndexOf(".");
  if (dotIndex <= 0) return null;
  return { nodeId: fileName.slice(0, dotIndex), extension: fileName.slice(dotIndex + 1) };
}

export async function importSaveFromZipBytes(zipBytes: Uint8Array): Promise<SaveImportResult> {
  const entries = await unzipSaveEntries(zipBytes);

  const manifestEntry = entries["manifest.json"];
  if (!manifestEntry) {
    throw new Error("This archive is not an ns-save (manifest.json missing).");
  }
  const manifest = nsSaveManifestSchema.safeParse(JSON.parse(strFromU8(manifestEntry)));
  if (!manifest.success) {
    throw new Error("This archive is not a valid ns-save.", { cause: manifest.error });
  }
  if (manifest.data.version > NS_SAVE_VERSION) {
    throw new Error(
      `Unsupported ns-save version ${manifest.data.version} (this build supports up to ${NS_SAVE_VERSION}).`,
    );
  }

  const game: GameRecord = manifest.data.game;

  const nodes: StoryNodeRecord[] = [];
  for (const [path, bytes] of Object.entries(entries)) {
    if (!path.startsWith("nodes/") || !path.endsWith(".json")) continue;
    const parsed = storyNodeRecordSchema.safeParse(JSON.parse(strFromU8(bytes)));
    if (!parsed.success) {
      console.warn(`[import] invalid node record skipped: ${path}`, parsed.error);
      continue;
    }
    if (parsed.data.gameId !== game.id) {
      console.warn(`[import] node skipped (belongs to another game): ${path}`);
      continue;
    }
    nodes.push(parsed.data);
  }
  const importedNodeIds = new Set<string>(nodes.map((node) => node.id));

  const assets: AssetRecord[] = [];
  for (const [path, bytes] of Object.entries(entries)) {
    if (!path.startsWith("assets/")) continue;
    const fileName = path.slice("assets/".length);
    const parts = splitFileName(fileName);
    if (!parts) continue;
    if (!importedNodeIds.has(parts.nodeId)) {
      console.warn(`[import] asset skipped (its node is missing): ${path}`);
      continue;
    }
    const mimeType = getImageMimeTypeFromExtension(parts.extension);
    if (!mimeType) {
      console.warn(`[import] asset skipped (unknown extension): ${path}`);
      continue;
    }
    const blob = new Blob([new Uint8Array(bytes)], { type: mimeType });
    assets.push({
      nodeId: storyNodeIdSchema.parse(parts.nodeId),
      blob,
      mimeType,
      byteSize: blob.size,
      updatedAt: manifest.data.exportedAt,
    });
  }

  const summary = await restoreRepository.upsertRestoredData({
    games: [game],
    nodes,
    assets,
    settings: null,
  });
  return { ...summary, gameTitle: game.title };
}

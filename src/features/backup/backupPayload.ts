import { strFromU8, strToU8, unzip, zip, type Zippable } from "fflate";
import { gameRecordSchema, storyNodeRecordSchema } from "../../types/game";
import { settingsRecordSchema, type SettingsRecord } from "../../types/settings";
import type { AssetRecord } from "../../types/asset";
import type { GameRecord, StoryNodeRecord } from "../../types";
import {
  getImageFileExtension,
  getImageMimeTypeFromExtension,
  isKnownImageMimeType,
} from "../../lib/imageFileExtensions";
import {
  NS_BACKUP_FORMAT,
  NS_BACKUP_VERSION,
  nsBackupPayloadManifestSchema,
  backupAssetInfoSchema,
  type BackupAssetIndex,
  type BackupPayloadBundle,
  type ParsedBackupPayload,
} from "./types";

/**
 * Pure build/parse for the encrypted backup payload ZIP (REDESIGN.md §3.3).
 *
 * These functions see the payload ONLY before encryption / after decryption —
 * nothing here ever touches the network or disk. The bundle receives records
 * and non-secret settings; credentials are structurally absent (§5.4).
 */

/** Assembles every file the payload ZIP will contain. */
export function buildBackupPayloadBundle(
  games: GameRecord[],
  nodes: StoryNodeRecord[],
  assets: AssetRecord[],
  settings: SettingsRecord | null,
  createdAt: string = new Date().toISOString(),
): BackupPayloadBundle {
  const manifest = {
    format: NS_BACKUP_FORMAT,
    version: NS_BACKUP_VERSION,
    createdAt,
    gameCount: games.length,
  };

  const orderedNodes = [...nodes].sort(
    (a, b) => a.gameId.localeCompare(b.gameId) || a.turnNumber - b.turnNumber,
  );
  const nodeIds = new Set(orderedNodes.map((node) => node.id));

  const gameFiles = [...games]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((game) => ({
      gameId: game.id,
      path: `games/${game.id}.json`,
      json: JSON.stringify(game, null, 2),
    }));

  const nodeFiles = orderedNodes.map((node) => ({
    nodeId: node.id,
    path: `nodes/${node.id}.json`,
    json: JSON.stringify(node, null, 2),
  }));

  const assetFiles: BackupPayloadBundle["assetFiles"] = [];
  const assetIndex: BackupAssetIndex = {};
  for (const asset of assets) {
    if (!nodeIds.has(asset.nodeId)) {
      console.warn(`[backup] skipping orphan asset without node: ${asset.nodeId}`);
      continue;
    }
    assetFiles.push({
      nodeId: asset.nodeId,
      path: `assets/${asset.nodeId}.${getImageFileExtension(asset.mimeType)}`,
      blob: asset.blob,
    });
    assetIndex[asset.nodeId] = {
      mimeType: asset.mimeType,
      updatedAt: asset.updatedAt,
    };
  }

  return {
    manifest,
    gameFiles,
    nodeFiles,
    assetFiles,
    assetIndex,
    settingsJson: settings ? JSON.stringify(settings, null, 2) : null,
  };
}

/** Archives the payload bundle into a ZIP (assets stored uncompressed). */
export async function createPayloadZipBlob(bundle: BackupPayloadBundle): Promise<Blob> {
  const files: Zippable = {
    "manifest.json": strToU8(JSON.stringify(bundle.manifest, null, 2)),
    "assets.json": strToU8(JSON.stringify(bundle.assetIndex, null, 2)),
  };
  for (const gameFile of bundle.gameFiles) {
    files[gameFile.path] = strToU8(gameFile.json);
  }
  for (const nodeFile of bundle.nodeFiles) {
    files[nodeFile.path] = strToU8(nodeFile.json);
  }
  if (bundle.settingsJson !== null) {
    files["settings.json"] = strToU8(bundle.settingsJson);
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

function unzipToEntries(bytes: Uint8Array): Promise<Record<string, Uint8Array>> {
  return new Promise((resolve, reject) => {
    unzip(bytes, (error, data) => {
      if (error) {
        reject(new Error(`Backup payload is not a readable ZIP archive.`, { cause: error }));
        return;
      }
      resolve(data);
    });
  });
}

/**
 * Parses + validates a decrypted payload ZIP element-wise (REDESIGN §5.7):
 * invalid records are skipped with a warning, never failing the whole restore.
 * Nodes without their game and assets without their node are skipped too,
 * so the restored database stays referentially consistent.
 */
export async function parsePayloadZip(payloadBytes: Uint8Array): Promise<ParsedBackupPayload> {
  const entries = await unzipToEntries(payloadBytes);

  const manifestEntry = entries["manifest.json"];
  if (!manifestEntry) {
    throw new Error("Backup payload is missing its manifest.");
  }
  const manifestParse = nsBackupPayloadManifestSchema.safeParse(
    JSON.parse(strFromU8(manifestEntry)),
  );
  if (!manifestParse.success) {
    throw new Error("Backup payload manifest is invalid.", { cause: manifestParse.error });
  }

  const games: ParsedBackupPayload["games"] = [];
  for (const [path, bytes] of Object.entries(entries)) {
    if (!path.startsWith("games/") || !path.endsWith(".json")) continue;
    const parsed = gameRecordSchema.safeParse(JSON.parse(strFromU8(bytes)));
    if (parsed.success) {
      games.push(parsed.data);
    } else {
      console.warn(`[backup] invalid game record skipped: ${path}`, parsed.error);
    }
  }
  const restoredGameIds = new Set(games.map((game) => game.id));

  const nodes: ParsedBackupPayload["nodes"] = [];
  for (const [path, bytes] of Object.entries(entries)) {
    if (!path.startsWith("nodes/") || !path.endsWith(".json")) continue;
    const parsed = storyNodeRecordSchema.safeParse(JSON.parse(strFromU8(bytes)));
    if (!parsed.success) {
      console.warn(`[backup] invalid node record skipped: ${path}`, parsed.error);
      continue;
    }
    if (!restoredGameIds.has(parsed.data.gameId)) {
      console.warn(`[backup] node skipped (its game is missing): ${path}`);
      continue;
    }
    nodes.push(parsed.data);
  }
  const restoredNodeIds = new Set<string>(nodes.map((node) => node.id));

  const assetIndex: BackupAssetIndex = {};
  const assetIndexEntry = entries["assets.json"];
  if (assetIndexEntry) {
    const rawIndex = JSON.parse(strFromU8(assetIndexEntry)) as Record<string, unknown>;
    for (const [nodeId, rawInfo] of Object.entries(rawIndex)) {
      const parsed = backupAssetInfoSchema.safeParse(rawInfo);
      if (parsed.success) {
        assetIndex[nodeId] = parsed.data;
      } else {
        console.warn(`[backup] invalid asset index entry skipped: ${nodeId}`);
      }
    }
  }

  const assets: ParsedBackupPayload["assets"] = [];
  for (const [path, bytes] of Object.entries(entries)) {
    if (!path.startsWith("assets/")) continue;
    const fileName = path.slice("assets/".length);
    const dotIndex = fileName.lastIndexOf(".");
    if (dotIndex <= 0) continue;
    const nodeId = fileName.slice(0, dotIndex);
    const fileExtension = fileName.slice(dotIndex + 1);
    if (!restoredNodeIds.has(nodeId)) {
      console.warn(`[backup] asset skipped (its node is missing): ${path}`);
      continue;
    }
    const indexMimeType = assetIndex[nodeId]?.mimeType;
    const mimeType =
      (indexMimeType !== undefined && isKnownImageMimeType(indexMimeType)
        ? indexMimeType
        : undefined) ?? getImageMimeTypeFromExtension(fileExtension);
    if (!mimeType) {
      console.warn(`[backup] asset skipped (unknown extension): ${path}`);
      continue;
    }
    const updatedAt = assetIndex[nodeId]?.updatedAt ?? manifestParse.data.createdAt;
    assets.push({
      nodeId,
      blob: new Blob([new Uint8Array(bytes)], { type: mimeType }),
      mimeType,
      updatedAt,
    });
  }

  let settings: SettingsRecord | null = null;
  const settingsEntry = entries["settings.json"];
  if (settingsEntry) {
    const parsed = settingsRecordSchema.safeParse(JSON.parse(strFromU8(settingsEntry)));
    if (parsed.success) {
      settings = parsed.data;
    } else {
      console.warn("[backup] invalid settings skipped; keeping current settings", parsed.error);
    }
  }

  return { manifest: manifestParse.data, games, nodes, assets, settings };
}

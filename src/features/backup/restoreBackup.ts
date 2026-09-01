import type { AssetRecord } from "../../types/asset";
import { storyNodeIdSchema } from "../../types";
import { restoreRepository } from "../../db/restoreRepository";
import { decryptEnvelope, parseEnvelopeJson } from "./envelope";
import { parsePayloadZip } from "./backupPayload";
import type { ParsedBackupPayload, RestoreSummary } from "./types";

/**
 * Orchestrates restoring an encrypted backup (REDESIGN.md §3.3):
 * envelope text → schema validate → decrypt → parse payload ZIP → upsert.
 */

export interface RestoreSummaryWithManifest extends RestoreSummary {
  backupCreatedAt: string;
}

function toAssetRecords(payload: ParsedBackupPayload): AssetRecord[] {
  return payload.assets.map((asset) => ({
    nodeId: storyNodeIdSchema.parse(asset.nodeId),
    blob: asset.blob,
    mimeType: asset.mimeType,
    byteSize: asset.blob.size,
    updatedAt: asset.updatedAt,
  }));
}

/** Restores from an ns-backup envelope JSON text (local file or Drive). */
export async function restoreBackupFromEnvelopeText(
  envelopeText: string,
  passphrase: string,
): Promise<RestoreSummaryWithManifest> {
  const envelope = parseEnvelopeJson(envelopeText);
  const payloadBytes = await decryptEnvelope(envelope, passphrase);
  const payload = await parsePayloadZip(payloadBytes);
  const summary = await restoreRepository.upsertRestoredData({
    games: payload.games,
    nodes: payload.nodes,
    assets: toAssetRecords(payload),
    settings: payload.settings,
  });
  return { ...summary, backupCreatedAt: payload.manifest.createdAt };
}

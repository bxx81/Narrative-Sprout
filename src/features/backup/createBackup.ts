import { db } from "../../db/database";
import type { AssetRecord } from "../../types/asset";
import type { GameRecord, StoryNodeRecord } from "../../types";
import {
  SETTINGS_RECORD_KEY,
  settingsRecordSchema,
  type SettingsRecord,
} from "../../types/settings";
import { buildBackupPayloadBundle, createPayloadZipBlob } from "./backupPayload";
import { createEncryptedEnvelope, serializeEnvelope } from "./envelope";

/**
 * Orchestrates creating an encrypted backup (REDESIGN.md §3.3):
 * collect records from IndexedDB → build payload ZIP → AES-GCM envelope.
 *
 * The `credentials` store is never read here: secrets are structurally
 * unreachable from this code path (§5.4 / AGENTS rule 3).
 */

/** e.g. `ns-backup_2026-09-01-12-30-45.nsbak` */
export function buildBackupFileName(createdAt: string = new Date().toISOString()): string {
  const stamp = createdAt.replace(/[:T]/g, "-").slice(0, 19);
  return `ns-backup_${stamp}.nsbak`;
}

/** Reads everything a backup contains (settings raw + element-wise validated). */
export async function collectBackupSourceData(): Promise<{
  games: GameRecord[];
  nodes: StoryNodeRecord[];
  assets: AssetRecord[];
  settings: SettingsRecord | null;
}> {
  const [games, nodes, assets, rawSettings] = await Promise.all([
    db.games.toArray(),
    db.nodes.toArray(),
    db.assets.toArray(),
    db.settings.get(SETTINGS_RECORD_KEY),
  ]);
  let settings: SettingsRecord | null = null;
  if (rawSettings) {
    const parsed = settingsRecordSchema.safeParse(rawSettings);
    if (parsed.success) {
      settings = parsed.data;
    } else {
      console.warn("[backup] invalid settings omitted from backup", parsed.error);
    }
  }
  return { games, nodes, assets, settings };
}

/** Builds the unencrypted payload ZIP bytes (never leaves the app). */
export async function createBackupPayloadBytes(passphrase: string): Promise<{
  payloadBytes: Uint8Array;
  createdAt: string;
}> {
  if (passphrase.length === 0) {
    throw new Error("A passphrase is required to encrypt the backup.");
  }
  const source = await collectBackupSourceData();
  const createdAt = new Date().toISOString();
  const bundle = buildBackupPayloadBundle(
    source.games,
    source.nodes,
    source.assets,
    source.settings,
    createdAt,
  );
  const payloadBlob = await createPayloadZipBlob(bundle);
  return { payloadBytes: new Uint8Array(await payloadBlob.arrayBuffer()), createdAt };
}

/** Encrypts the payload into the ns-backup envelope JSON text (upload-ready). */
export async function createBackupEnvelopeText(passphrase: string): Promise<{
  envelopeJson: string;
  createdAt: string;
}> {
  const { payloadBytes, createdAt } = await createBackupPayloadBytes(passphrase);
  const envelope = await createEncryptedEnvelope(payloadBytes, passphrase);
  return { envelopeJson: serializeEnvelope(envelope), createdAt };
}

/** Creates the downloadable encrypted backup file (.nsbak). */
export async function createBackupFile(passphrase: string): Promise<{
  fileName: string;
  blob: Blob;
}> {
  const { envelopeJson, createdAt } = await createBackupEnvelopeText(passphrase);
  return {
    fileName: buildBackupFileName(createdAt),
    blob: new Blob([envelopeJson], { type: "application/json" }),
  };
}

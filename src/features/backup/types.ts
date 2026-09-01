import { z } from "zod";
import { settingsRecordSchema } from "../../types/settings";
import { gameRecordSchema, storyNodeRecordSchema } from "../../types/game";
import type { ImageMimeType } from "../../lib/imageFileExtensions";

/**
 * `ns-backup` encrypted backup container (REDESIGN.md §3.3).
 *
 * The file that leaves the device (download or Google Drive upload) is ALWAYS
 * this envelope: a PBKDF2 + AES-GCM wrapper around an opaque encrypted blob.
 * Plaintext backups do not exist in this design (§3.3: no unencrypted path).
 *
 * The envelope version is independent of the DB `schemaVersion`. Restore code
 * must refuse versions it does not know instead of guessing (non-destructive
 * policy, §5.6).
 */

/** Format identifier of the outer envelope (and the payload manifest). */
export const NS_BACKUP_FORMAT = "ns-backup" as const;

/** Version of the ns-backup container format this build writes and accepts. */
export const NS_BACKUP_VERSION = 1;

export const nsBackupKdfSchema = z.object({
  algo: z.literal("PBKDF2"),
  hash: z.literal("SHA-256"),
  iterations: z.number().int().positive(),
  /** Base64-encoded random salt. */
  salt: z.string(),
});
export type NSBackupKdf = z.infer<typeof nsBackupKdfSchema>;

export const nsBackupCipherSchema = z.object({
  algo: z.literal("AES-GCM"),
  /** Base64-encoded 96-bit IV. */
  iv: z.string(),
  /** Base64-encoded ciphertext (the encrypted payload ZIP). */
  data: z.string(),
});
export type NSBackupCipher = z.infer<typeof nsBackupCipherSchema>;

export const nsBackupEnvelopeSchema = z.object({
  format: z.literal(NS_BACKUP_FORMAT),
  version: z.number().int().positive(),
  kdf: nsBackupKdfSchema,
  cipher: nsBackupCipherSchema,
});
export type NSBackupEnvelope = z.infer<typeof nsBackupEnvelopeSchema>;

/**
 * Manifest inside the encrypted payload ZIP. Never visible without the
 * passphrase; exists so restore code can sanity-check what it decrypted.
 */
export const nsBackupPayloadManifestSchema = z.object({
  format: z.literal(NS_BACKUP_FORMAT),
  version: z.number().int().positive(),
  /** ISO 8601 timestamp of when the backup was created. */
  createdAt: z.string(),
  /** Number of games the payload claims to contain (advisory). */
  gameCount: z.number().int().nonnegative(),
});
export type NSBackupPayloadManifest = z.infer<typeof nsBackupPayloadManifestSchema>;

/** Per-asset metadata. The ZIP only carries bytes, mime type lives here. */
export const backupAssetInfoSchema = z.object({
  mimeType: z.string(),
  /** ISO 8601 timestamp of the last image (re)generation. */
  updatedAt: z.string(),
});
export type BackupAssetInfo = z.infer<typeof backupAssetInfoSchema>;

/** Map of nodeId -> asset metadata, stored as `assets.json` in the payload. */
export const backupAssetIndexSchema = z.record(z.string(), backupAssetInfoSchema);
export type BackupAssetIndex = z.infer<typeof backupAssetIndexSchema>;

/** Files of the payload ZIP before archiving (pure builder output). */
export interface BackupPayloadBundle {
  manifest: NSBackupPayloadManifest;
  gameFiles: Array<{ gameId: string; path: string; json: string }>;
  nodeFiles: Array<{ nodeId: string; path: string; json: string }>;
  /** Binary asset contents keyed by `assets/<nodeId>.<extension>`. */
  assetFiles: Array<{ nodeId: string; path: string; blob: Blob }>;
  assetIndex: BackupAssetIndex;
  /** Non-secret global settings. Absent when the DB has none. */
  settingsJson: string | null;
}

/** Parsed + validated contents of a decrypted payload ZIP. */
export interface ParsedBackupPayload {
  manifest: NSBackupPayloadManifest;
  games: z.infer<typeof gameRecordSchema>[];
  nodes: z.infer<typeof storyNodeRecordSchema>[];
  assets: Array<{ nodeId: string; blob: Blob; mimeType: ImageMimeType; updatedAt: string }>;
  settings: z.infer<typeof settingsRecordSchema> | null;
}

/** What a restore/import actually wrote into the database. */
export interface RestoreSummary {
  restoredGameCount: number;
  restoredNodeCount: number;
  restoredAssetCount: number;
  settingsRestored: boolean;
}

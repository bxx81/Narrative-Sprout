import type { DriveFileMetadata, FetchImpl } from "./driveClient";
import { createDriveClient } from "./driveClient";
import { buildBackupFileName, createBackupEnvelopeText } from "./createBackup";
import { restoreBackupFromEnvelopeText, type RestoreSummaryWithManifest } from "./restoreBackup";

/**
 * Google Drive backup orchestration (REDESIGN §3.3, §8).
 *
 * Only the encrypted ns-backup envelope is ever uploaded — there is no code
 * path that sends unencrypted user data to Drive (§3.3: no plaintext path).
 * The access token is acquired by the caller (store actions, from a user
 * gesture) and passed in; these functions never persist it. `fetchImpl` is
 * injectable for tests; production callers omit it.
 */

const DRIVE_FOLDER_NAME = "NarrativeSproutBackup";
const BACKUP_FILE_EXTENSION = ".nsbak";

function isBackupFile(metadata: DriveFileMetadata): boolean {
  return metadata.name.toLowerCase().endsWith(BACKUP_FILE_EXTENSION);
}

/** Uploads a fresh encrypted backup as a new timestamped file. */
export async function uploadBackupToDrive(
  accessToken: string,
  passphrase: string,
  fetchImpl?: FetchImpl,
): Promise<{ fileName: string }> {
  const client = createDriveClient(accessToken, fetchImpl);
  const folder = await client.getOrCreateFolder(DRIVE_FOLDER_NAME);
  const { envelopeJson, createdAt } = await createBackupEnvelopeText(passphrase);
  const fileName = buildBackupFileName(createdAt);
  const envelopeBlob = new Blob([envelopeJson], { type: "application/json" });
  await client.uploadFile(envelopeBlob, fileName, folder.fileId);
  return { fileName };
}

/** Lists stored backups, newest first. */
export async function listDriveBackups(
  accessToken: string,
  fetchImpl?: FetchImpl,
): Promise<DriveFileMetadata[]> {
  const client = createDriveClient(accessToken, fetchImpl);
  const folder = await client.findFolderByName(DRIVE_FOLDER_NAME);
  if (!folder) return [];
  const files = await client.listFilesInFolder(folder.fileId);
  return files
    .filter(isBackupFile)
    .sort((a, b) => (b.modifiedAt ?? "").localeCompare(a.modifiedAt ?? ""));
}

/** Downloads and restores one backup from Drive. */
export async function restoreBackupFromDrive(
  accessToken: string,
  fileId: string,
  passphrase: string,
  fetchImpl?: FetchImpl,
): Promise<RestoreSummaryWithManifest> {
  const client = createDriveClient(accessToken, fetchImpl);
  const blob = await client.downloadFile(fileId);
  const envelopeText = await blob.text();
  return restoreBackupFromEnvelopeText(envelopeText, passphrase);
}

/** Deletes one backup file from Drive. */
export async function deleteDriveBackup(
  accessToken: string,
  fileId: string,
  fetchImpl?: FetchImpl,
): Promise<void> {
  const client = createDriveClient(accessToken, fetchImpl);
  await client.deleteFile(fileId);
}

/** Public surface of the backup feature (REDESIGN.md §4.2 feature modules). */
export {
  NS_BACKUP_FORMAT,
  NS_BACKUP_VERSION,
  nsBackupEnvelopeSchema,
  nsBackupPayloadManifestSchema,
  type NSBackupEnvelope,
  type NSBackupKdf,
  type NSBackupCipher,
  type NSBackupPayloadManifest,
  type BackupPayloadBundle,
  type ParsedBackupPayload,
  type RestoreSummary,
} from "./types";
export { buildBackupPayloadBundle, createPayloadZipBlob, parsePayloadZip } from "./backupPayload";
export {
  buildEnvelope,
  createEncryptedEnvelope,
  serializeEnvelope,
  parseEnvelopeJson,
  decryptEnvelope,
} from "./envelope";
export {
  buildBackupFileName,
  collectBackupSourceData,
  createBackupEnvelopeText,
  createBackupFile,
} from "./createBackup";
export { restoreBackupFromEnvelopeText, type RestoreSummaryWithManifest } from "./restoreBackup";
export { importSaveFromZipBytes, type SaveImportResult } from "./importSave";
export {
  GoogleDriveAuthError,
  hasDriveAccessToken,
  requestDriveAccessToken,
  revokeDriveAccessToken,
  clearDriveAccessToken,
} from "./googleAuth";
export {
  createDriveClient,
  DriveApiError,
  DriveUnauthorizedError,
  type DriveClient,
  type DriveFileMetadata,
} from "./driveClient";
export {
  uploadBackupToDrive,
  listDriveBackups,
  restoreBackupFromDrive,
  deleteDriveBackup,
} from "./driveBackup";

import { useState } from "react";
import { useGameStore } from "../store/gameStore";
import type { DriveFileMetadata } from "../features/backup/api";

/**
 * Backup & restore section of the title screen (REDESIGN §3.3, §8):
 * encrypted local backup (.nsbak), ns-save import, Google Drive backup.
 * Every operation requires the passphrase; there is deliberately no
 * unencrypted path (§3.3).
 */

function formatDriveBackupMetadata(backup: DriveFileMetadata): string {
  const sizeText =
    backup.sizeBytes !== null ? `${(backup.sizeBytes / 1024).toFixed(0)} KB` : "unknown size";
  const dateText = backup.modifiedAt ? new Date(backup.modifiedAt).toLocaleString() : "";
  return `${sizeText}${dateText ? ` · ${dateText}` : ""}`;
}

export function BackupSection() {
  const downloadEncryptedBackup = useGameStore((s) => s.downloadEncryptedBackup);
  const restoreBackupFromFile = useGameStore((s) => s.restoreBackupFromFile);
  const importSaveFromFile = useGameStore((s) => s.importSaveFromFile);
  const driveConnected = useGameStore((s) => s.driveConnected);
  const driveBackups = useGameStore((s) => s.driveBackups);
  const connectGoogleDrive = useGameStore((s) => s.connectGoogleDrive);
  const disconnectGoogleDrive = useGameStore((s) => s.disconnectGoogleDrive);
  const uploadBackupToGoogleDrive = useGameStore((s) => s.uploadBackupToGoogleDrive);
  const refreshGoogleDriveBackups = useGameStore((s) => s.refreshGoogleDriveBackups);
  const restoreGoogleDriveBackup = useGameStore((s) => s.restoreGoogleDriveBackup);
  const deleteGoogleDriveBackup = useGameStore((s) => s.deleteGoogleDriveBackup);

  const [passphrase, setPassphrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [backupFile, setBackupFile] = useState<File | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [confirmingDeleteFileId, setConfirmingDeleteFileId] = useState<string | null>(null);

  async function runOperation(operation: () => Promise<string>): Promise<void> {
    setBusy(true);
    setErrorText(null);
    setStatusText(null);
    try {
      setStatusText(await operation());
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "The operation failed.");
    } finally {
      setBusy(false);
    }
  }

  const secondaryButton =
    "rounded bg-neutral-700 px-3 py-1.5 text-xs hover:bg-neutral-600 disabled:opacity-40";
  const primaryButton =
    "rounded bg-indigo-600 px-3 py-1.5 text-xs hover:bg-indigo-500 disabled:opacity-40";

  return (
    <section className="rounded border border-neutral-700 p-4">
      <h2 className="mb-1 text-lg">Backup &amp; Restore</h2>
      <p className="mb-3 text-xs text-neutral-400">
        Backups contain every save plus your non-secret settings, encrypted with AES-GCM
        (WebCrypto). API keys are never included. If you lose the passphrase, the backup cannot be
        restored.
      </p>

      <label className="mb-3 block text-xs text-neutral-400">
        Passphrase
        <input
          type="password"
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          className="mt-1 w-full rounded bg-neutral-800 p-2 text-sm text-neutral-100"
          placeholder="Backup passphrase"
          autoComplete="off"
        />
      </label>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            className={primaryButton}
            disabled={busy || passphrase.length === 0}
            onClick={() =>
              void runOperation(async () => {
                await downloadEncryptedBackup(passphrase);
                return "Encrypted backup downloaded.";
              })
            }
          >
            Download backup (.nsbak)
          </button>

          <input
            type="file"
            accept=".nsbak,application/json"
            className="text-xs"
            onChange={(e) => setBackupFile(e.target.files?.[0] ?? null)}
          />
          <button
            className={secondaryButton}
            disabled={busy || !backupFile || passphrase.length === 0}
            onClick={() => {
              const file = backupFile;
              if (!file) return;
              void runOperation(async () => {
                const summary = await restoreBackupFromFile(file, passphrase);
                setBackupFile(null);
                return `Restored ${summary.restoredGameCount} game(s), ${summary.restoredNodeCount} node(s), ${summary.restoredAssetCount} image(s).`;
              });
            }}
          >
            Restore from file
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="file"
            accept=".zip"
            className="text-xs"
            onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
          />
          <button
            className={secondaryButton}
            disabled={busy || !importFile}
            onClick={() => {
              const file = importFile;
              if (!file) return;
              void runOperation(async () => {
                const result = await importSaveFromFile(file);
                setImportFile(null);
                return `Imported "${result.gameTitle}" (${result.restoredNodeCount} node(s)).`;
              });
            }}
          >
            Import ns-save ZIP
          </button>
        </div>
      </div>

      <div className="mt-4 border-t border-neutral-800 pt-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold">Google Drive</h3>
          {driveConnected ? (
            <>
              <button
                className={primaryButton}
                disabled={busy || passphrase.length === 0}
                onClick={() =>
                  void runOperation(async () => {
                    const { fileName } = await uploadBackupToGoogleDrive(passphrase);
                    return `Uploaded ${fileName} to Drive.`;
                  })
                }
              >
                Back up to Drive
              </button>
              <button
                className={secondaryButton}
                disabled={busy}
                onClick={() =>
                  void runOperation(async () => {
                    await refreshGoogleDriveBackups();
                    return "Backup list refreshed.";
                  })
                }
              >
                Refresh
              </button>
              <button
                className={secondaryButton}
                disabled={busy}
                onClick={() =>
                  void runOperation(async () => {
                    await disconnectGoogleDrive();
                    return "Disconnected from Google Drive.";
                  })
                }
              >
                Disconnect
              </button>
            </>
          ) : (
            <button
              className={primaryButton}
              disabled={busy}
              onClick={() =>
                void runOperation(async () => {
                  await connectGoogleDrive();
                  return "Connected to Google Drive.";
                })
              }
            >
              Connect Google Drive
            </button>
          )}
        </div>

        {driveConnected && driveBackups.length === 0 && (
          <p className="mt-2 text-xs text-neutral-400">
            No backups found on Drive yet. &quot;Back up to Drive&quot; creates one.
          </p>
        )}

        {driveConnected && driveBackups.length > 0 && (
          <ul className="mt-2 space-y-1">
            {driveBackups.map((backup) => (
              <li
                key={backup.fileId}
                className="flex flex-wrap items-center justify-between gap-2 rounded bg-neutral-800 px-2 py-1.5 text-xs"
              >
                <span className="min-w-0 flex-1 truncate" title={backup.name}>
                  {backup.name}
                  <span className="ml-2 text-neutral-500">{formatDriveBackupMetadata(backup)}</span>
                </span>
                <span className="flex shrink-0 gap-1">
                  <button
                    className={secondaryButton}
                    disabled={busy || passphrase.length === 0}
                    onClick={() =>
                      void runOperation(async () => {
                        const summary = await restoreGoogleDriveBackup(backup.fileId, passphrase);
                        return `Restored ${summary.restoredGameCount} game(s) from ${backup.name}.`;
                      })
                    }
                  >
                    Restore
                  </button>
                  {confirmingDeleteFileId === backup.fileId ? (
                    <>
                      <button
                        className="rounded bg-red-700 px-2 py-1.5 text-xs hover:bg-red-600"
                        disabled={busy}
                        onClick={() => {
                          setConfirmingDeleteFileId(null);
                          void runOperation(async () => {
                            await deleteGoogleDriveBackup(backup.fileId);
                            return `Deleted ${backup.name} from Drive.`;
                          });
                        }}
                      >
                        Confirm
                      </button>
                      <button
                        className={secondaryButton}
                        onClick={() => setConfirmingDeleteFileId(null)}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      className={`${secondaryButton} hover:bg-red-800`}
                      onClick={() => setConfirmingDeleteFileId(backup.fileId)}
                    >
                      Delete
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {statusText && <p className="mt-3 text-xs text-emerald-400">{statusText}</p>}
      {errorText && <p className="mt-3 text-xs text-red-400">{errorText}</p>}
    </section>
  );
}

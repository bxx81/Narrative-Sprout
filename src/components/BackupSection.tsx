import { useState } from "react";
import { useGameStore } from "../store/gameStore";
import type { DriveFileMetadata } from "../features/backup/api";
import Button from "./ui/Button";
import { Icon } from "./ui/Icon";

/**
 * Backup & restore section (REDESIGN §3.3, §8):
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

  return (
    <section className="bg-text-bg text-body-text rounded-lg p-4 shadow-md">
      <h3 className="mb-1 flex items-center gap-2 font-semibold">
        <Icon iconName="database" />
        Backup &amp; Restore
      </h3>
      <p className="support-text-color mb-3 text-xs">
        Backups contain every save plus your non-secret settings, encrypted with AES-GCM
        (WebCrypto). API keys are never included. If you lose the passphrase, the backup cannot be
        restored.
      </p>

      <label className="support-text-color mb-3 block text-xs">
        Passphrase
        <input
          type="password"
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          className="form-style mt-1"
          placeholder="Backup passphrase"
          autoComplete="new-password"
        />
      </label>

      <div className="flex flex-col gap-3">
        <div className="form-layout-style flex-wrap items-center">
          <Button
            intent="primary"
            size="small"
            isWorking={busy}
            disabled={busy || passphrase.length === 0}
            onClick={() =>
              void runOperation(async () => {
                await downloadEncryptedBackup(passphrase);
                return "Encrypted backup downloaded.";
              })
            }
          >
            Download backup (.nsbak)
          </Button>

          <input
            type="file"
            accept=".nsbak,application/json"
            className="form-style flex-1 py-1.5 text-xs"
            onChange={(e) => setBackupFile(e.target.files?.[0] ?? null)}
          />
          <Button
            intent="secondary"
            size="small"
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
          </Button>
        </div>

        <div className="form-layout-style flex-wrap items-center">
          <input
            type="file"
            accept=".zip"
            className="form-style flex-1 py-1.5 text-xs"
            onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
          />
          <Button
            intent="secondary"
            size="small"
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
          </Button>
        </div>
      </div>

      <div className="border-text-border mt-4 border-t pt-3">
        <div className="form-layout-style flex-wrap items-center">
          <h4 className="text-sm font-semibold">Google Drive</h4>
          {driveConnected ? (
            <>
              <Button
                intent="alt"
                size="small"
                isWorking={busy}
                disabled={busy || passphrase.length === 0}
                onClick={() =>
                  void runOperation(async () => {
                    const { fileName } = await uploadBackupToGoogleDrive(passphrase);
                    return `Uploaded ${fileName} to Drive.`;
                  })
                }
              >
                <Icon iconName="cloud_upload" />
                Back up to Drive
              </Button>
              <Button
                intent="secondary"
                size="small"
                disabled={busy}
                onClick={() =>
                  void runOperation(async () => {
                    await refreshGoogleDriveBackups();
                    return "Backup list refreshed.";
                  })
                }
              >
                Refresh
              </Button>
              <Button
                intent="secondary"
                size="small"
                disabled={busy}
                onClick={() =>
                  void runOperation(async () => {
                    await disconnectGoogleDrive();
                    return "Disconnected from Google Drive.";
                  })
                }
              >
                <Icon iconName="logout" />
                Disconnect
              </Button>
            </>
          ) : (
            <Button
              intent="primary"
              size="small"
              isWorking={busy}
              disabled={busy}
              onClick={() =>
                void runOperation(async () => {
                  await connectGoogleDrive();
                  return "Connected to Google Drive.";
                })
              }
            >
              <Icon iconName="login" />
              Connect Google Drive
            </Button>
          )}
        </div>

        {driveConnected && driveBackups.length === 0 && (
          <p className="support-text-color mt-2 text-xs">
            No backups found on Drive yet. &quot;Back up to Drive&quot; creates one.
          </p>
        )}

        {driveConnected && driveBackups.length > 0 && (
          <ul className="mt-2 space-y-1">
            {driveBackups.map((backup) => (
              <li
                key={backup.fileId}
                className="bg-body-bg flex flex-wrap items-center justify-between gap-2 rounded px-2 py-1.5 text-xs"
              >
                <span className="min-w-0 flex-1 truncate" title={backup.name}>
                  {backup.name}
                  <span className="support-text-color ml-2">
                    {formatDriveBackupMetadata(backup)}
                  </span>
                </span>
                <span className="flex shrink-0 gap-1">
                  <Button
                    intent="secondary"
                    size="small-circle"
                    className="px-2"
                    disabled={busy || passphrase.length === 0}
                    onClick={() =>
                      void runOperation(async () => {
                        const summary = await restoreGoogleDriveBackup(backup.fileId, passphrase);
                        return `Restored ${summary.restoredGameCount} game(s) from ${backup.name}.`;
                      })
                    }
                  >
                    Restore
                  </Button>
                  {confirmingDeleteFileId === backup.fileId ? (
                    <>
                      <Button
                        intent="danger"
                        size="small-circle"
                        className="px-2"
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
                      </Button>
                      <Button
                        intent="secondary"
                        size="small-circle"
                        className="px-2"
                        onClick={() => setConfirmingDeleteFileId(null)}
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <Button
                      intent="secondary"
                      size="small-circle"
                      className="px-2 hover:bg-red-800"
                      onClick={() => setConfirmingDeleteFileId(backup.fileId)}
                    >
                      Delete
                    </Button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {statusText && <p className="text-primary mt-3 text-xs">{statusText}</p>}
      {errorText && <p className="mt-3 text-xs font-semibold text-danger">{errorText}</p>}
    </section>
  );
}

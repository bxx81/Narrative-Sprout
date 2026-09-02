import { useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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
  const [backupFile, setBackupFile] = useState<File | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [confirmingDeleteFileId, setConfirmingDeleteFileId] = useState<string | null>(null);

  async function runOperation(operation: () => Promise<string>): Promise<void> {
    setBusy(true);
    try {
      toast.success(await operation());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("operationFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="bg-text-bg text-body-text rounded-lg p-4 shadow-md">
      <h3 className="mb-1 flex items-center gap-2 font-semibold">
        <Icon iconName="database" />
        {t("backupRestoreTitle")}
      </h3>
      <p className="support-text-color mb-3 text-xs">{t("backupRestoreDescription")}</p>

      <label className="support-text-color mb-3 block text-xs">
        {t("passphraseLabel")}
        <input
          type="password"
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          className="form-style mt-1"
          placeholder={t("backupPassphrasePlaceholder")}
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
                return t("encryptedBackupDownloaded");
              })
            }
          >
            {t("downloadBackupButton")}
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
                return t("restoredSummary", {
                  games: summary.restoredGameCount,
                  nodes: summary.restoredNodeCount,
                  images: summary.restoredAssetCount,
                });
              });
            }}
          >
            {t("restoreFromFileButton")}
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
                return t("importedNsSaveSummary", {
                  title: result.gameTitle,
                  count: result.restoredNodeCount,
                });
              });
            }}
          >
            {t("importNsSaveButton")}
          </Button>
        </div>
      </div>

      <div className="border-text-border mt-4 border-t pt-3">
        <div className="form-layout-style flex-wrap items-center">
          <h4 className="text-sm font-semibold">{t("googleDriveTitle")}</h4>
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
                    return t("uploadedToDrive", { fileName });
                  })
                }
              >
                <Icon iconName="cloud_upload" />
                {t("backUpToDriveButton")}
              </Button>
              <Button
                intent="secondary"
                size="small"
                disabled={busy}
                onClick={() =>
                  void runOperation(async () => {
                    await refreshGoogleDriveBackups();
                    return t("backupListRefreshed");
                  })
                }
              >
                {t("refreshButton")}
              </Button>
              <Button
                intent="secondary"
                size="small"
                disabled={busy}
                onClick={() =>
                  void runOperation(async () => {
                    await disconnectGoogleDrive();
                    return t("disconnectedFromDrive");
                  })
                }
              >
                <Icon iconName="logout" />
                {t("disconnectButton")}
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
                  return t("connectedToDrive");
                })
              }
            >
              <Icon iconName="login" />
              {t("connectGoogleDriveButton")}
            </Button>
          )}
        </div>

        {driveConnected && driveBackups.length === 0 && (
          <p className="support-text-color mt-2 text-xs">{t("noDriveBackupsYet")}</p>
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
                        return t("restoredFromDriveSummary", {
                          count: summary.restoredGameCount,
                          name: backup.name,
                        });
                      })
                    }
                  >
                    {t("restoreButton")}
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
                            return t("deletedFromDrive", { name: backup.name });
                          });
                        }}
                      >
                        {t("confirmButton")}
                      </Button>
                      <Button
                        intent="secondary"
                        size="small-circle"
                        className="px-2"
                        onClick={() => setConfirmingDeleteFileId(null)}
                      >
                        {t("cancelButton")}
                      </Button>
                    </>
                  ) : (
                    <Button
                      intent="secondary"
                      size="small-circle"
                      className="px-2 hover:bg-red-800"
                      onClick={() => setConfirmingDeleteFileId(backup.fileId)}
                    >
                      {t("deleteButton")}
                    </Button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

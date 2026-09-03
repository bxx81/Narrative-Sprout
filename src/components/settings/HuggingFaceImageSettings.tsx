import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useDebouncedExternalState } from "../../hooks/useDebouncedExternalState";
import HelpTooltip from "../ui/HelpTooltip";

interface HuggingFaceImageSettingsProps {
  spaceId: string;
  setSpaceId: (id: string) => void;
  token: string | null;
  setToken: (token: string) => void;
  configJson: string;
  setConfigJson: (json: string) => void;
  loading: boolean;
}

const HuggingFaceImageSettingsComponent: React.FC<HuggingFaceImageSettingsProps> = ({
  spaceId,
  setSpaceId,
  token,
  setToken,
  configJson,
  setConfigJson,
  loading,
}) => {
  const { t } = useTranslation();
  const [localSpaceId, setLocalSpaceId] = useDebouncedExternalState(spaceId, setSpaceId);
  const [localToken, setLocalToken] = useDebouncedExternalState(token ?? "", setToken);
  const [localConfigJson, setLocalConfigJson] = useDebouncedExternalState(
    configJson,
    setConfigJson,
  );

  const isJsonValid = useMemo(() => {
    if (!localConfigJson.trim()) return true;
    try {
      JSON.parse(localConfigJson);
      return true;
    } catch {
      return false;
    }
  }, [localConfigJson]);

  return (
    <div className="animate-fade-in mt-4 space-y-4">
      <div>
        <label htmlFor="huggingface-space-id" className="sr-only">
          {t("huggingFaceSpaceIdLabel")}
        </label>
        <input
          type="text"
          id="huggingface-space-id"
          value={localSpaceId}
          onChange={(e) => setLocalSpaceId(e.target.value)}
          placeholder={t("huggingFaceSpaceIdLabel")}
          className="form-style font-mono"
          disabled={loading}
        />
        <div className="support-text-color mt-2 flex items-center gap-1 text-xs">
          {t("huggingFaceSpaceIdHelp")}
          <HelpTooltip content={t("helpHuggingFaceSpaceId")} />
        </div>
      </div>
      <div>
        <label htmlFor="huggingface-token" className="sr-only">
          {t("huggingFaceTokenLabel")}
        </label>
        <input
          type="password"
          autoComplete="new-password"
          id="huggingface-token"
          value={localToken}
          onChange={(e) => setLocalToken(e.target.value)}
          placeholder={t("huggingFaceTokenLabel")}
          className="form-style"
          disabled={loading}
        />
        <div className="support-text-color mt-2 flex items-center gap-1 text-xs">
          {t("huggingFaceTokenHelp")}
          <HelpTooltip content={t("helpHuggingFaceToken")} />
        </div>
      </div>
      <div>
        <label htmlFor="huggingface-config" className="sr-only">
          {t("huggingFaceConfigLabel")}
        </label>
        <textarea
          id="huggingface-config"
          value={localConfigJson}
          onChange={(e) => setLocalConfigJson(e.target.value)}
          rows={8}
          className={`form-style form-style-small-text ${isJsonValid ? "form-style-valid" : "form-style-invalid"}`}
          disabled={loading}
          placeholder={t("huggingFaceConfigLabel")}
        />
        <div className="support-text-color mt-2 flex items-center gap-1 text-xs">
          {t("huggingFaceConfigHelp")}
          <HelpTooltip content={t("helpHuggingFaceConfig")} />
        </div>
        {!isJsonValid && (
          <p className="mt-1 text-xs font-semibold text-red-500">{t("invalidJsonFormat")}</p>
        )}
      </div>
    </div>
  );
};

const HuggingFaceImageSettings = React.memo(
  HuggingFaceImageSettingsComponent,
  (prevProps, nextProps) =>
    prevProps.spaceId === nextProps.spaceId &&
    prevProps.token === nextProps.token &&
    prevProps.configJson === nextProps.configJson &&
    prevProps.loading === nextProps.loading,
);

export default HuggingFaceImageSettings;

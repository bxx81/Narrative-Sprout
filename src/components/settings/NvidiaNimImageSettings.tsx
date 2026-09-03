import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useDebouncedExternalState } from "../../hooks/useDebouncedExternalState";
import HelpTooltip from "../ui/HelpTooltip";

interface NvidiaNimImageSettingsProps {
  endpoint: string;
  setEndpoint: (endpoint: string) => void;
  token: string | null;
  setToken: (token: string) => void;
  configJson: string;
  setConfigJson: (json: string) => void;
  loading: boolean;
}

const NvidiaNimImageSettingsComponent: React.FC<NvidiaNimImageSettingsProps> = ({
  endpoint,
  setEndpoint,
  token,
  setToken,
  configJson,
  setConfigJson,
  loading,
}) => {
  const { t } = useTranslation();
  const [localEndpoint, setLocalEndpoint] = useDebouncedExternalState(endpoint, setEndpoint);
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
        <label htmlFor="nim-endpoint" className="sr-only">
          {t("nimEndpointLabel")}
        </label>
        <input
          type="text"
          id="nim-endpoint"
          value={localEndpoint}
          onChange={(e) => setLocalEndpoint(e.target.value)}
          placeholder={t("nimEndpointLabel")}
          className="form-style"
          disabled={loading}
        />
        <div className="support-text-color mt-2 flex items-center gap-1 text-xs">
          {t("nimEndpointHelp")}
          <HelpTooltip content={t("helpNimEndpoint")} />
        </div>
      </div>
      <div>
        <label htmlFor="nim-token" className="sr-only">
          {t("nimTokenLabel")}
        </label>
        <input
          type="password"
          autoComplete="new-password"
          id="nim-token"
          value={localToken}
          onChange={(e) => setLocalToken(e.target.value)}
          placeholder={t("nimTokenLabel")}
          className="form-style font-mono"
          disabled={loading}
        />
        <div className="support-text-color mt-2 flex items-center gap-1 text-xs">
          {t("nimTokenHelp")}
          <HelpTooltip content={t("helpNimToken")} />
        </div>
      </div>
      <div>
        <label htmlFor="nim-config" className="sr-only">
          {t("nimConfigLabel")}
        </label>
        <textarea
          id="nim-config"
          value={localConfigJson}
          onChange={(e) => setLocalConfigJson(e.target.value)}
          rows={8}
          className={`form-style form-style-small-text ${isJsonValid ? "form-style-valid" : "form-style-invalid"}`}
          disabled={loading}
          placeholder={t("nimConfigLabel")}
        />
        <div className="support-text-color mt-2 flex items-center gap-1 text-xs">
          {t("nimConfigHelp")}
          <HelpTooltip content={t("helpNimConfig")} />
        </div>
        {!isJsonValid && (
          <p className="mt-1 text-xs font-semibold text-red-500">{t("invalidJsonFormat")}</p>
        )}
      </div>
    </div>
  );
};

const NvidiaNimImageSettings = React.memo(
  NvidiaNimImageSettingsComponent,
  (prevProps, nextProps) =>
    prevProps.endpoint === nextProps.endpoint &&
    prevProps.token === nextProps.token &&
    prevProps.configJson === nextProps.configJson &&
    prevProps.loading === nextProps.loading,
);

export default NvidiaNimImageSettings;

import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useDebouncedExternalState } from "../../hooks/useDebouncedExternalState";
import HelpTooltip from "../ui/HelpTooltip";

interface A1111ImageSettingsProps {
  endpoint: string;
  setEndpoint: (endpoint: string) => void;
  configJson: string;
  setConfigJson: (json: string) => void;
  loading: boolean;
}

const A1111ImageSettingsComponent: React.FC<A1111ImageSettingsProps> = ({
  endpoint,
  setEndpoint,
  configJson,
  setConfigJson,
  loading,
}) => {
  const { t } = useTranslation();
  const [localEndpoint, setLocalEndpoint] = useDebouncedExternalState(endpoint, setEndpoint);
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
        <label htmlFor="a1111-endpoint" className="sr-only">
          {t("a1111EndpointLabel")}
        </label>
        <input
          type="text"
          id="a1111-endpoint"
          value={localEndpoint}
          onChange={(e) => setLocalEndpoint(e.target.value)}
          placeholder={t("a1111EndpointLabel")}
          className="form-style font-mono"
          disabled={loading}
        />
        <div className="support-text-color mt-2 flex items-center gap-1 text-xs">
          {t("a1111EndpointHelp")}
        </div>
      </div>
      <div>
        <label htmlFor="a1111-config" className="sr-only">
          {t("a1111ConfigLabel")}
        </label>
        <textarea
          id="a1111-config"
          value={localConfigJson}
          onChange={(e) => setLocalConfigJson(e.target.value)}
          rows={8}
          className={`form-style form-style-small-text ${isJsonValid ? "form-style-valid" : "form-style-invalid"}`}
          disabled={loading}
          placeholder={t("a1111ConfigLabel")}
        />
        <div className="support-text-color mt-2 flex items-center gap-1 text-xs">
          {t("a1111ConfigHelp")}
          <HelpTooltip content={t("helpA1111Config")} />
        </div>
        {!isJsonValid && (
          <p className="mt-1 text-xs font-semibold text-red-500">{t("invalidJsonFormat")}</p>
        )}
      </div>
    </div>
  );
};

const A1111ImageSettings = React.memo(
  A1111ImageSettingsComponent,
  (prevProps, nextProps) =>
    prevProps.endpoint === nextProps.endpoint &&
    prevProps.configJson === nextProps.configJson &&
    prevProps.loading === nextProps.loading,
);

export default A1111ImageSettings;

import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useDebouncedExternalState } from "../../hooks/useDebouncedExternalState";
import HelpTooltip from "../ui/HelpTooltip";

interface ComfyUIImageSettingsProps {
  endpoint: string;
  setEndpoint: (endpoint: string) => void;
  workflowJson: string;
  setWorkflowJson: (json: string) => void;
  loading: boolean;
}

const ComfyUIImageSettingsComponent: React.FC<ComfyUIImageSettingsProps> = ({
  endpoint,
  setEndpoint,
  workflowJson,
  setWorkflowJson,
  loading,
}) => {
  const { t } = useTranslation();
  const [localEndpoint, setLocalEndpoint] = useDebouncedExternalState(endpoint, setEndpoint);
  const [localWorkflowJson, setLocalWorkflowJson] = useDebouncedExternalState(
    workflowJson,
    setWorkflowJson,
  );

  const isJsonValid = useMemo(() => {
    if (!localWorkflowJson.trim()) return true;
    try {
      JSON.parse(localWorkflowJson);
      return true;
    } catch {
      return false;
    }
  }, [localWorkflowJson]);

  return (
    <div className="animate-fade-in mt-4 space-y-4">
      <div>
        <label htmlFor="comfyui-endpoint" className="sr-only">
          {t("comfyuiEndpointLabel")}
        </label>
        <input
          type="text"
          id="comfyui-endpoint"
          value={localEndpoint}
          onChange={(e) => setLocalEndpoint(e.target.value)}
          placeholder={t("comfyuiEndpointLabel")}
          className="form-style"
          disabled={loading}
        />
        <div className="support-text-color mt-2 flex items-center gap-1 text-xs">
          {t("comfyuiEndpointHelp")}
          <HelpTooltip content={t("helpComfyUIEndpoint")} />
        </div>
      </div>
      <div>
        <label htmlFor="comfyui-workflow" className="sr-only">
          {t("comfyuiWorkflowLabel")}
        </label>
        <textarea
          id="comfyui-workflow"
          value={localWorkflowJson}
          onChange={(e) => setLocalWorkflowJson(e.target.value)}
          rows={8}
          className={`form-style form-style-small-text ${isJsonValid ? "form-style-valid" : "form-style-invalid"}`}
          disabled={loading}
          placeholder={t("comfyuiWorkflowLabel")}
        />
        <div className="support-text-color mt-2 flex items-center gap-1 text-xs">
          {t("comfyuiWorkflowHelp")}
          <HelpTooltip content={t("helpComfyUIWorkflow")} />
        </div>
        {!isJsonValid && (
          <p className="mt-1 text-xs font-semibold text-red-500">{t("invalidJsonFormat")}</p>
        )}
      </div>
    </div>
  );
};

const ComfyUIImageSettings = React.memo(
  ComfyUIImageSettingsComponent,
  (prevProps, nextProps) =>
    prevProps.endpoint === nextProps.endpoint &&
    prevProps.workflowJson === nextProps.workflowJson &&
    prevProps.loading === nextProps.loading,
);

export default ComfyUIImageSettings;

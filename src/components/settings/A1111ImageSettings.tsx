import React, { useMemo } from "react";
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
          A1111 API Endpoint
        </label>
        <input
          type="text"
          id="a1111-endpoint"
          value={localEndpoint}
          onChange={(e) => setLocalEndpoint(e.target.value)}
          placeholder="A1111 API Endpoint"
          className="form-style"
          disabled={loading}
        />
        <div className="support-text-color mt-2 flex items-center gap-1 text-xs">
          Ensure the server is running with CORS enabled (e.g., `--cors-allow-origins=*`).
        </div>
      </div>
      <div>
        <label htmlFor="a1111-config" className="sr-only">
          A1111/Stable Diffusion Parameters (JSON)
        </label>
        <textarea
          id="a1111-config"
          value={localConfigJson}
          onChange={(e) => setLocalConfigJson(e.target.value)}
          rows={8}
          className={`form-style form-style-small-text ${isJsonValid ? "form-style-valid" : "form-style-invalid"}`}
          disabled={loading}
          placeholder="A1111/Stable Diffusion Parameters (JSON)"
        />
        <div className="support-text-color mt-2 flex items-center gap-1 text-xs">
          Specify the JSON object for the txt2img API. The 'prompt' in this object will be appended
          to the AI-generated prompt. Invalid JSON will be ignored and defaults used.
          <HelpTooltip content="Specify preferred default parameters for the txt2img API in a JSON object. These settings (sampler, steps, etc.) will be merged with the AI-generated prompt." />
        </div>
        {!isJsonValid && (
          <p className="mt-1 text-xs font-semibold text-red-500">Invalid JSON format.</p>
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

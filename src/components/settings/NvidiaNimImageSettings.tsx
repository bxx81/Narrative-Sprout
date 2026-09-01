import React, { useMemo } from "react";
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
          NVIDIA NIM Endpoint
        </label>
        <input
          type="text"
          id="nim-endpoint"
          value={localEndpoint}
          onChange={(e) => setLocalEndpoint(e.target.value)}
          placeholder="NVIDIA NIM Endpoint"
          className="form-style"
          disabled={loading}
        />
        <div className="support-text-color mt-2 flex items-center gap-1 text-xs">
          The full URL of the NIM inference endpoint, e.g.
          https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.2-klein-4b
          <HelpTooltip content="Enter the full inference URL. The NVIDIA NIM hosted API does not support CORS in the browser, so you will need a CORS proxy or the Tauri desktop app to use it." />
        </div>
      </div>
      <div>
        <label htmlFor="nim-token" className="sr-only">
          NVIDIA NIM Token
        </label>
        <input
          type="password"
          autoComplete="new-password"
          id="nim-token"
          value={localToken}
          onChange={(e) => setLocalToken(e.target.value)}
          placeholder="NVIDIA NIM Token"
          className="form-style"
          disabled={loading}
        />
        <div className="support-text-color mt-2 flex items-center gap-1 text-xs">
          Optional. Your NGC API key if the NIM endpoint requires authentication. Stored locally in
          the credentials store only.
          <HelpTooltip content="If hosted on NVIDIA's API (build.nvidia.com), use your NGC API key. For self-hosted NIM, a token may not be needed." />
        </div>
      </div>
      <div>
        <label htmlFor="nim-config" className="sr-only">
          NVIDIA NIM Parameters (JSON)
        </label>
        <textarea
          id="nim-config"
          value={localConfigJson}
          onChange={(e) => setLocalConfigJson(e.target.value)}
          rows={8}
          className={`form-style form-style-small-text ${isJsonValid ? "form-style-valid" : "form-style-invalid"}`}
          disabled={loading}
          placeholder="NVIDIA NIM Parameters (JSON)"
        />
        <div className="support-text-color mt-2 flex items-center gap-1 text-xs">
          Specify the JSON parameters for the NIM inference API. Common fields: seed, steps, width,
          height. Model-specific fields vary; unsupported fields cause errors.
          <HelpTooltip content="Specify default parameters for the NIM inference API as a JSON object. These are merged with the AI-generated prompt. Check the model's API reference for supported parameters." />
        </div>
        {!isJsonValid && (
          <p className="mt-1 text-xs font-semibold text-red-500">Invalid JSON format.</p>
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

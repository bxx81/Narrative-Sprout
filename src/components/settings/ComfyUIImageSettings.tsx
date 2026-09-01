import React, { useMemo } from "react";
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
          ComfyUI API Endpoint
        </label>
        <input
          type="text"
          id="comfyui-endpoint"
          value={localEndpoint}
          onChange={(e) => setLocalEndpoint(e.target.value)}
          placeholder="ComfyUI API Endpoint"
          className="form-style"
          disabled={loading}
        />
        <div className="support-text-color mt-2 flex items-center gap-1 text-xs">
          e.g., http://127.0.0.1:8188. Ensure the server is running with CORS enabled (e.g.,
          --enable-cors-header).
          <HelpTooltip content="Enter the full URL of your ComfyUI server, including 'http://' or 'https://'. The server must be started with CORS enabled (e.g., '--enable-cors-header')." />
        </div>
      </div>
      <div>
        <label htmlFor="comfyui-workflow" className="sr-only">
          ComfyUI Workflow (JSON)
        </label>
        <textarea
          id="comfyui-workflow"
          value={localWorkflowJson}
          onChange={(e) => setLocalWorkflowJson(e.target.value)}
          rows={8}
          className={`form-style form-style-small-text ${isJsonValid ? "form-style-valid" : "form-style-invalid"}`}
          disabled={loading}
          placeholder="ComfyUI Workflow (JSON)"
        />
        <div className="support-text-color mt-2 flex items-center gap-1 text-xs">
          Paste your API-format workflow here. ##prompt## and ##negative_prompt## will be replaced.
          The number 1234567890 will be replaced with a random seed.
          <HelpTooltip content="Paste the 'API Format' JSON of your ComfyUI workflow. Placeholders ##prompt##, ##negative_prompt##, and seed number 1234567890 will be automatically replaced during generation." />
        </div>
        {!isJsonValid && (
          <p className="mt-1 text-xs font-semibold text-red-500">Invalid JSON format.</p>
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

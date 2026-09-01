import React, { useMemo } from "react";
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
          Hugging Face Space ID
        </label>
        <input
          type="text"
          id="huggingface-space-id"
          value={localSpaceId}
          onChange={(e) => setLocalSpaceId(e.target.value)}
          placeholder="Hugging Face Space ID"
          className="form-style"
          disabled={loading}
        />
        <div className="support-text-color mt-2 flex items-center gap-1 text-xs">
          Hugging Face Space ID for image generation (e.g., 'black-forest-labs/FLUX.1-schnell')
          <HelpTooltip content="Specify the identifier for a public or private image generation Space on Hugging Face in the format 'organization/space-name' (e.g., 'stabilityai/stable-diffusion-3-medium')." />
        </div>
      </div>
      <div>
        <label htmlFor="huggingface-token" className="sr-only">
          Hugging Face Token
        </label>
        <input
          type="password"
          autoComplete="new-password"
          id="huggingface-token"
          value={localToken}
          onChange={(e) => setLocalToken(e.target.value)}
          placeholder="Hugging Face Token"
          className="form-style"
          disabled={loading}
        />
        <div className="support-text-color mt-2 flex items-center gap-1 text-xs">
          Optional. Required for private or gated Hugging Face Spaces. Stored locally in the
          credentials store only.
          <HelpTooltip content="A Hugging Face User Access Token is required to use private or gated Spaces. You can get one from your Hugging Face account settings." />
        </div>
      </div>
      <div>
        <label htmlFor="huggingface-config" className="sr-only">
          Hugging Face API Parameters (JSON)
        </label>
        <textarea
          id="huggingface-config"
          value={localConfigJson}
          onChange={(e) => setLocalConfigJson(e.target.value)}
          rows={8}
          className={`form-style form-style-small-text ${isJsonValid ? "form-style-valid" : "form-style-invalid"}`}
          disabled={loading}
          placeholder="Hugging Face API Parameters (JSON)"
        />
        <div className="support-text-color mt-2 flex items-center gap-1 text-xs">
          Specify the JSON object for the Space's `/infer` API. 'prompt' will be appended to the
          AI-generated prompt. Keys with value "delete" will be removed. Invalid JSON is ignored.
          <HelpTooltip content="Specify default parameters for the Space's API in a JSON object. This is unique to each Space. Check the Space's API documentation for available options." />
        </div>
        {!isJsonValid && (
          <p className="mt-1 text-xs font-semibold text-red-500">Invalid JSON format.</p>
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

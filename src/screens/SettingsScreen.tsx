import React, { useState, useEffect, useRef } from "react";
import { useDebouncedExternalState } from "../hooks/useDebouncedExternalState";
import { useNavigate, useLocation } from "react-router";
import { useGameStore } from "../store/gameStore";
import type { ImageGeneratorType } from "../types/settings";
import A1111ImageSettings from "../components/settings/A1111ImageSettings";
import ComfyUIImageSettings from "../components/settings/ComfyUIImageSettings";
import HuggingFaceImageSettings from "../components/settings/HuggingFaceImageSettings";
import NvidiaNimImageSettings from "../components/settings/NvidiaNimImageSettings";
import BackButton from "../components/ui/BackButton";
import { ROUTES } from "../app/routes";
import Expander from "../components/ui/Expander";
import Button from "../components/ui/Button";
import SettingsSection from "../components/ui/SettingsSection";
import ToggleSwitch from "../components/ui/ToggleSwitch";
import { Icon } from "../components/ui/Icon";
import LoadingSpinner from "../components/ui/LoadingSpinner";
import { BackupSection } from "../components/BackupSection";
import { useFullscreen } from "../hooks/useFullscreen";
import { useConfirm } from "../hooks/useConfirm";

interface OpenRouterModel {
  id: string;
  name: string;
}

/**
 * Isolated input for the text model setting (debounced sync to the store).
 */
const TextModelInput = React.memo(
  ({ value, onChange }: { value: string; onChange: (val: string) => void }) => {
    const [localValue, setLocalValue] = useDebouncedExternalState(value, onChange);
    const isInvalid = !/^\S+\/\S+/.test(localValue.trim());

    const [models, setModels] = useState<OpenRouterModel[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [hasLoaded, setHasLoaded] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const abortControllerRef = useRef<AbortController | null>(null);

    const handleFetchModels = async () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("https://openrouter.ai/api/v1/models", {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`Failed to fetch models (HTTP ${response.status}).`);
        }
        const body = (await response.json()) as { data?: OpenRouterModel[] };
        const fetchedModels = (body.data ?? [])
          .filter((m) => typeof m.id === "string" && m.id)
          .sort((a, b) => a.id.localeCompare(b.id));
        setModels(fetchedModels);
        setHasLoaded(true);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return; // ignore aborts
        }
        console.error(err);
        setError(err instanceof Error ? err.message : "Failed to fetch models.");
      } finally {
        if (abortControllerRef.current === controller) {
          setIsLoading(false);
        }
      }
    };

    useEffect(() => {
      return () => {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
      };
    }, []);

    const currentModelId = localValue.trim().split(" ")[0] || "";

    const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const selectedId = e.target.value;
      if (!selectedId) return;

      const parts = localValue.trim().split(" ");
      parts[0] = selectedId;
      setLocalValue(parts.join(" "));
    };

    return (
      <div className="space-y-2">
        <div>
          <input
            id="openai-text-model-input"
            type="text"
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            className={`form-style ${isInvalid ? "form-style-invalid" : "form-style-valid"}`}
          />
          {isInvalid && (
            <p className="mt-1 text-xs font-semibold text-red-500">
              Invalid model settings format. Use "provider/model".
            </p>
          )}
        </div>

        <div className="mt-2 text-sm">
          {!hasLoaded && !isLoading && (
            <Button
              type="button"
              intent="secondary"
              size="medium"
              onClick={() => void handleFetchModels()}
              className="w-full"
            >
              Load OpenRouter Model List
            </Button>
          )}

          {isLoading && (
            <div className="flex items-center justify-center gap-2 py-2 text-zinc-500 dark:text-zinc-400">
              <LoadingSpinner strokeWidth={6} className="h-5 w-5 text-indigo-500" />
              <span className="animate-pulse">Fetching models from OpenRouter...</span>
            </div>
          )}

          {error && (
            <div className="mt-2 flex flex-col items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-600 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-400">
              <p className="text-center font-semibold">{error}</p>
              <Button
                type="button"
                intent="secondary"
                size="small"
                onClick={() => void handleFetchModels()}
                className="px-3 py-1 text-xs"
              >
                Retry
              </Button>
            </div>
          )}

          {hasLoaded && models.length > 0 && (
            <div className="mt-2 flex flex-col gap-1.5">
              <label
                htmlFor="openrouter-model-selector"
                className="text-xs font-semibold text-zinc-500 dark:text-zinc-400"
              >
                Select OpenRouter Model
              </label>
              <div className="flex items-center gap-2">
                <select
                  id="openrouter-model-selector"
                  value={models.some((m) => m.id === currentModelId) ? currentModelId : ""}
                  onChange={handleSelectChange}
                  className="form-style grow"
                >
                  <option value="">Select a model...</option>
                  {models.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name} ({model.id})
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  intent="secondary"
                  size="small"
                  onClick={() => void handleFetchModels()}
                  title="Reload model list"
                  className="flex aspect-square h-full items-center justify-center p-2"
                >
                  <Icon iconName="autorenew" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  },
);
TextModelInput.displayName = "TextModelInput";

/**
 * The settings screen (legacy DetailedSettingsScreen, trimmed to the
 * features already implemented in v2).
 */
const SettingsScreen: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const confirm = useConfirm();
  const { isFullscreen, toggleFullscreen } = useFullscreen();

  const settings = useGameStore((s) => s.settings);
  const apiKey = useGameStore((s) => s.openrouterApiKey);
  const huggingFaceToken = useGameStore((s) => s.huggingFaceToken);
  const nvidiaNimToken = useGameStore((s) => s.nvidiaNimToken);
  const activeGame = useGameStore((s) => s.activeGame);
  const saveApiKey = useGameStore((s) => s.saveApiKey);
  const saveCredential = useGameStore((s) => s.saveCredential);
  const updateSettings = useGameStore((s) => s.updateSettings);
  const goToTitle = useGameStore((s) => s.goToTitle);
  const wipeAllData = useGameStore((s) => s.wipeAllData);

  const [key, setKey] = useState("");

  const cameFromPath = location.state?.from as string | undefined;
  const showReturnToStartButton = cameFromPath && cameFromPath !== ROUTES.HOME && activeGame;

  if (!settings) return null;

  const handleReturnToStartClick = async () => {
    navigate(ROUTES.HOME, { replace: true, viewTransition: true });
    await goToTitle();
  };

  const handleApiKeySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (key.trim()) {
      void saveApiKey(key.trim());
      setKey("");
    }
  };

  const handleDeleteAllData = async () => {
    const result = await confirm({
      title: "Delete All Data",
      message:
        "This will completely delete all save data, settings, and API keys stored in this browser. This action cannot be undone.",
      confirmLabel: "Delete Everything",
      cancelLabel: "Cancel",
      isDestructive: true,
      icon: "delete_forever",
    });
    if (result !== true) return;
    await wipeAllData();
  };

  const renderSettingsComponent = () => {
    switch (settings.imageGenerator) {
      case "a1111":
        return (
          <A1111ImageSettings
            endpoint={settings.a1111Endpoint}
            setEndpoint={(endpoint) => void updateSettings({ a1111Endpoint: endpoint })}
            configJson={settings.a1111Config}
            setConfigJson={(json) => void updateSettings({ a1111Config: json })}
            loading={false}
          />
        );
      case "comfyui":
        return (
          <ComfyUIImageSettings
            endpoint={settings.comfyuiEndpoint}
            setEndpoint={(endpoint) => void updateSettings({ comfyuiEndpoint: endpoint })}
            workflowJson={settings.comfyuiWorkflow}
            setWorkflowJson={(json) => void updateSettings({ comfyuiWorkflow: json })}
            loading={false}
          />
        );
      case "huggingface":
        return (
          <HuggingFaceImageSettings
            spaceId={settings.huggingFaceSpaceId}
            setSpaceId={(id) => void updateSettings({ huggingFaceSpaceId: id })}
            token={huggingFaceToken}
            setToken={(token) => void saveCredential("huggingFaceToken", token)}
            configJson={settings.huggingFaceConfig}
            setConfigJson={(json) => void updateSettings({ huggingFaceConfig: json })}
            loading={false}
          />
        );
      case "nvidia_nim":
        return (
          <NvidiaNimImageSettings
            endpoint={settings.nimEndpoint}
            setEndpoint={(endpoint) => void updateSettings({ nimEndpoint: endpoint })}
            token={nvidiaNimToken}
            setToken={(token) => void saveCredential("nvidiaNimToken", token)}
            configJson={settings.nimConfig}
            setConfigJson={(json) => void updateSettings({ nimConfig: json })}
            loading={false}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="mx-auto mb-20 max-w-2xl">
      <div className="mb-8 text-center">
        <h1 className="font-serif-display text-3xl font-bold md:text-4xl">Settings</h1>
      </div>

      <div>
        {!apiKey && (
          <p className="text-danger">To begin your story, you need an OpenRouter API key.</p>
        )}

        {/* Game Actions Section */}
        {showReturnToStartButton && (
          <SettingsSection
            ariaLabelledby="game-actions-heading"
            header="Game Actions"
            icon={<Icon iconName="gamepad" />}
          >
            <Button
              onClick={() => void handleReturnToStartClick()}
              intent="alt"
              size="medium"
              className="w-full space-y-3"
            >
              <Icon iconName="home" />
              Return to Start Screen
            </Button>
          </SettingsSection>
        )}

        {/* Image Generator Section */}
        {showReturnToStartButton && (
          <SettingsSection ariaLabelledby="image-settings-heading">
            <Expander
              id="image-settings-heading"
              ariacontrols="image-settings-content"
              labelText="Image Generator"
              icon={<Icon iconName="tune" />}
            >
              <select
                id="image-generator"
                value={settings.imageGenerator}
                onChange={(e) =>
                  void updateSettings({
                    imageGenerator: e.target.value as ImageGeneratorType,
                  })
                }
                className="form-style"
              >
                <option value="huggingface">Hugging Face</option>
                <option value="a1111">AUTOMATIC1111 (Local)</option>
                <option value="comfyui">ComfyUI (Local)</option>
                <option value="nvidia_nim">NVIDIA NIM</option>
                <option value="disabled">Disabled</option>
              </select>
              {renderSettingsComponent()}
            </Expander>
          </SettingsSection>
        )}

        {/* Display Section */}
        <SettingsSection
          ariaLabelledby="display-heading"
          header="Display"
          icon={<Icon iconName="display_settings" />}
        >
          <Button
            onClick={() => void toggleFullscreen()}
            intent="tertiary"
            size="medium"
            className="w-full"
          >
            {!isFullscreen ? (
              <>
                <Icon iconName="fullscreen" />
                Enter Fullscreen
              </>
            ) : (
              <>
                <Icon iconName="fullscreen_exit" />
                Exit Fullscreen
              </>
            )}
          </Button>
        </SettingsSection>

        {/* Text model Section */}
        <SettingsSection
          ariaLabelledby="openai-text-model-heading"
          header="Text Generation Model"
          icon={<Icon iconName="api" />}
        >
          <TextModelInput
            value={settings.textModel}
            onChange={(model) => void updateSettings({ textModel: model })}
          />
        </SettingsSection>

        {/* Story Log Compaction Section */}
        <SettingsSection
          ariaLabelledby="storyLogCompaction-heading"
          header="Story Log Compaction"
          icon={<Icon iconName="summarize" />}
        >
          <p className="explanation-text-style">
            As your story grows, the internal scene log is periodically compressed into a concise
            chronicle to keep context within limits. This makes an extra, automatic archivist call
            that preserves plot-critical facts. Turn it off to keep the full log verbatim (may
            exceed the model's context on very long stories).
          </p>
          <div className="flex items-center justify-between gap-4">
            <span className="explanation-text-style">Enable story log compaction (archivist)</span>
            <ToggleSwitch
              checked={settings.enableStoryLogCompaction}
              onChange={(e) => void updateSettings({ enableStoryLogCompaction: e.target.checked })}
            />
          </div>
        </SettingsSection>

        {/* API Key Section */}
        <SettingsSection ariaLabelledby="api-key-heading">
          <Expander
            id="api-key-heading"
            ariacontrols="api-key-content"
            labelText="Manual API Key Setup"
            icon={<Icon iconName="key" />}
          >
            <a
              href="https://openrouter.ai/"
              target="_blank"
              rel="noopener noreferrer"
              className="explanation-text-style"
            >
              Get API Key from OpenRouter
            </a>
            <form onSubmit={handleApiKeySubmit} className="form-layout-style mt-2">
              <label htmlFor="api-key-input" className="sr-only">
                OpenRouter API Key
              </label>
              <input
                id="api-key-input"
                type="password"
                autoComplete="new-password"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="OpenRouter API Key"
                className="form-style"
              />
              <Button
                type="submit"
                disabled={!key.trim()}
                intent="tertiary"
                size="medium"
                className="w-48"
              >
                {apiKey ? "Update Key" : "Save Key"}
              </Button>
            </form>
            <p className="support-text-color text-xs">
              The key is stored locally in the browser (IndexedDB credentials store) only. It is
              never included in exports or backups.
            </p>
          </Expander>
        </SettingsSection>

        {/* Data Management Section */}
        <SettingsSection ariaLabelledby="data-management-heading">
          <Expander
            id="data-management-heading"
            ariacontrols="data-management-content"
            labelText="Data Management"
            icon={<Icon iconName="database" />}
          >
            <div>
              <p className="explanation-text-style">
                This will completely delete all save data, settings, and API keys. This action
                cannot be undone.
              </p>
              <Button
                onClick={() => void handleDeleteAllData()}
                intent="danger"
                size="medium"
                className="w-full"
              >
                <Icon iconName="delete_forever" />
                Delete All Data
              </Button>
            </div>

            <BackupSection />
          </Expander>
        </SettingsSection>
      </div>
      <BackButton />
    </div>
  );
};

export default SettingsScreen;

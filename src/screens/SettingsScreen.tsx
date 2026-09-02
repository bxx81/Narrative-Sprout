import React, { useState, useEffect, useRef } from "react";
import { useDebouncedExternalState } from "../hooks/useDebouncedExternalState";
import { useNavigate, useLocation } from "react-router";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { useGameStore } from "../store/gameStore";
import type { ImageGeneratorType } from "../types/settings";
import { parseTextModelOptions, DEFAULT_OPENROUTER_BASE_URL } from "../lib/modelOptions";
import { builtInLanguages } from "../features/i18n/api";
import {
  consumePkceCallback,
  exchangeCodeForApiKey,
  startPkceAuth,
  stripPkceCallbackFromUrl,
} from "../features/openrouter/api";
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
 * Accepts trailing per-model options, e.g.
 * "provider/model --BaseURL=http://127.0.0.1:1234/v1 --temperature=0.7".
 */
const TextModelInput = React.memo(
  ({ value, onChange }: { value: string; onChange: (val: string) => void }) => {
    const { t } = useTranslation();
    const [localValue, setLocalValue] = useDebouncedExternalState(value, onChange);
    const parsed = parseTextModelOptions(localValue);
    const isInvalid = !parsed.isValid;

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
        setError(err instanceof Error ? err.message : t("failedToFetchModels"));
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
            <p className="mt-1 text-xs font-semibold text-red-500">{t("invalidModelOption")}</p>
          )}
          <p className="support-text-color mt-2 text-xs">{t("modelOptionsHelp")}</p>
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
              {t("loadModelsButton")}
            </Button>
          )}

          {isLoading && (
            <div className="flex items-center justify-center gap-2 py-2 text-zinc-500 dark:text-zinc-400">
              <LoadingSpinner strokeWidth={6} className="h-5 w-5 text-indigo-500" />
              <span className="animate-pulse">{t("loadingModelsText")}</span>
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
                {t("retryButton")}
              </Button>
            </div>
          )}

          {hasLoaded && models.length > 0 && (
            <div className="mt-2 flex flex-col gap-1.5">
              <label
                htmlFor="openrouter-model-selector"
                className="text-xs font-semibold text-zinc-500 dark:text-zinc-400"
              >
                {t("selectModelLabel")}
              </label>
              <div className="flex items-center gap-2">
                <select
                  id="openrouter-model-selector"
                  value={models.some((m) => m.id === currentModelId) ? currentModelId : ""}
                  onChange={handleSelectChange}
                  className="form-style grow"
                >
                  <option value="">{t("selectModelPlaceholder")}</option>
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
                  title={t("reloadModelsTooltip")}
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
 * features implemented in v2). Language, streaming and AI translation
 * sections arrived in Phase 6.
 */
const SettingsScreen: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const confirm = useConfirm();
  const { isFullscreen, toggleFullscreen } = useFullscreen();

  const settings = useGameStore((s) => s.settings);
  const apiKey = useGameStore((s) => s.openrouterApiKey);
  const huggingFaceToken = useGameStore((s) => s.huggingFaceToken);
  const nvidiaNimToken = useGameStore((s) => s.nvidiaNimToken);
  const activeGame = useGameStore((s) => s.activeGame);
  const uiTranslation = useGameStore((s) => s.uiTranslation);
  const uiTranslationProgress = useGameStore((s) => s.uiTranslationProgress);
  const saveApiKey = useGameStore((s) => s.saveApiKey);
  const saveCredential = useGameStore((s) => s.saveCredential);
  const updateSettings = useGameStore((s) => s.updateSettings);
  const goToTitle = useGameStore((s) => s.goToTitle);
  const wipeAllData = useGameStore((s) => s.wipeAllData);
  const translateUi = useGameStore((s) => s.translateUi);
  const deleteAiTranslation = useGameStore((s) => s.deleteAiTranslation);

  const [key, setKey] = useState("");
  const [targetLanguage, setTargetLanguage] = useState("");
  const pkceProcessedRef = useRef(false);

  const cameFromPath = location.state?.from as string | undefined;
  const showReturnToStartButton = cameFromPath && cameFromPath !== ROUTES.HOME && activeGame;

  // OpenRouter OAuth PKCE callback: consume ?code=&state= exactly once per
  // mount, clean the address bar first (prevents replay on re-render), then
  // exchange the code for a user-owned API key (legacy effect).
  useEffect(() => {
    if (pkceProcessedRef.current) return;
    const searchParams = new URLSearchParams(window.location.search);
    const callback = consumePkceCallback(searchParams);
    if (!callback) return;
    pkceProcessedRef.current = true;
    stripPkceCallbackFromUrl();
    exchangeCodeForApiKey(callback.code)
      .then((newKey) => {
        void saveApiKey(newKey);
        toast.success(t("apiKeyPkceSuccess"));
      })
      .catch((error) => {
        console.error("[pkce] key exchange failed", error);
        toast.error(t("apiKeyPkceFailed"));
      });
  }, [saveApiKey, t]);

  // Surface AI translation failures as a toast: the store rethrows after
  // recording the failed phase, so the toast fires exactly once at the moment
  // of failure (never on screen remounts).
  const handleTranslateUi = () => {
    const trimmed = targetLanguage.trim();
    if (!trimmed || isTranslating) return;
    setTargetLanguage("");
    translateUi(trimmed).catch(() => toast.error(t("aiTranslationError")));
  };

  if (!settings) return null;

  const uiLanguage = settings.uiLanguage;
  const aiLanguages = Object.keys(settings.aiTranslations);
  const aiLanguagesSet = new Set(aiLanguages);
  const displayBuiltInLanguages = builtInLanguages.filter(
    (language) => !aiLanguagesSet.has(language),
  );
  const isCurrentAiLanguage = aiLanguagesSet.has(uiLanguage);
  const isTranslating = uiTranslation.phase === "running";
  const parsedModel = parseTextModelOptions(settings.textModel);

  const handleReturnToStartClick = async () => {
    navigate(ROUTES.HOME, { replace: true, viewTransition: true });
    await goToTitle();
  };

  const handleGetApiKey = () => {
    void startPkceAuth();
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
      title: t("deleteAllDataConfirmTitle"),
      message: t("deleteAllDataConfirm"),
      confirmLabel: t("deleteAllDataConfirmConfirm"),
      cancelLabel: t("cancelButton"),
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
        <h1 className="font-serif-display text-3xl font-bold md:text-4xl">{t("settingsTitle")}</h1>
      </div>

      <div>
        {!apiKey && <p className="text-danger">{t("apiKeyModalDescriptionShort")}</p>}

        {/* Game Actions Section */}
        {showReturnToStartButton && (
          <SettingsSection
            ariaLabelledby="game-actions-heading"
            header={t("gameActionsSectionTitle")}
            icon={<Icon iconName="gamepad" />}
          >
            <Button
              onClick={() => void handleReturnToStartClick()}
              intent="alt"
              size="medium"
              className="w-full space-y-3"
            >
              <Icon iconName="home" />
              {t("returnToStartButton")}
            </Button>
          </SettingsSection>
        )}

        {/* Image Generator Section */}
        {showReturnToStartButton && (
          <SettingsSection ariaLabelledby="image-settings-heading">
            <Expander
              id="image-settings-heading"
              ariacontrols="image-settings-content"
              labelText={t("imageGeneratorLabel")}
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
                <option value="huggingface">{t("huggingFaceOption")}</option>
                <option value="a1111">{t("a1111Option")}</option>
                <option value="comfyui">{t("comfyuiOption")}</option>
                <option value="nvidia_nim">{t("nvidiaNimOption")}</option>
                <option value="disabled">{t("disabledOption")}</option>
              </select>
              {renderSettingsComponent()}
            </Expander>
          </SettingsSection>
        )}

        {/* Language Section */}
        <SettingsSection
          ariaLabelledby="language-heading"
          header={t("languageSectionTitle")}
          icon={<Icon iconName="translate" />}
        >
          <label htmlFor="ui-language-select" className="explanation-text-style">
            {t("languageSelectLabel")}
          </label>
          <select
            id="ui-language-select"
            value={uiLanguage}
            onChange={(e) => void updateSettings({ uiLanguage: e.target.value })}
            className="form-style"
          >
            {displayBuiltInLanguages.map((language) => (
              <option key={language} value={language}>
                {language}
              </option>
            ))}
            {aiLanguages.length > 0 && (
              <optgroup label={t("aiTranslationOptgroupLabel")}>
                {aiLanguages.map((language) => (
                  <option key={language} value={language}>
                    {language} {t("aiTranslationSuffix")}
                  </option>
                ))}
              </optgroup>
            )}
          </select>

          <p className="explanation-text-style">{t("aiTranslationDescription")}</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="ai-translation-input"
              type="text"
              value={targetLanguage}
              onChange={(e) => setTargetLanguage(e.target.value)}
              placeholder={t("aiTranslationInputLabel")}
              disabled={isTranslating}
              className="form-style grow"
            />
            <Button
              type="button"
              intent="secondary"
              size="medium"
              onClick={handleTranslateUi}
              disabled={isTranslating || !targetLanguage.trim()}
              className="sm:w-40"
            >
              {isTranslating ? t("aiTranslatingButton") : t("aiTranslationButton")}
            </Button>
          </div>
          {isTranslating && (
            <div className="flex items-center justify-center gap-2 py-1 text-zinc-500 dark:text-zinc-400">
              <LoadingSpinner strokeWidth={6} className="h-4 w-4 text-indigo-500" />
              <span className="animate-pulse text-xs">
                {uiTranslationProgress !== null
                  ? `${Math.round(uiTranslationProgress * 100)}%`
                  : t("aiTranslatingButton")}
              </span>
            </div>
          )}
          {isCurrentAiLanguage && (
            <Button
              type="button"
              intent="danger"
              size="medium"
              onClick={() => void deleteAiTranslation(uiLanguage)}
              className="w-full"
            >
              {t("aiTranslationDeleteButton")}
            </Button>
          )}
        </SettingsSection>

        {/* Display Section */}
        <SettingsSection
          ariaLabelledby="display-heading"
          header={t("displaySectionTitle")}
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
                {t("enterFullscreenButton")}
              </>
            ) : (
              <>
                <Icon iconName="fullscreen_exit" />
                {t("exitFullscreenButton")}
              </>
            )}
          </Button>
        </SettingsSection>

        {/* Text model Section */}
        <SettingsSection
          ariaLabelledby="openai-text-model-heading"
          header={t("storyGenerationSectionTitle")}
          icon={<Icon iconName="api" />}
        >
          <TextModelInput
            value={settings.textModel}
            onChange={(model) => void updateSettings({ textModel: model })}
          />
          <div className="mt-3 flex items-center justify-between gap-4">
            <span className="explanation-text-style">{t("streamingToggleLabel")}</span>
            <ToggleSwitch
              checked={settings.enableStreaming}
              onChange={(e) => void updateSettings({ enableStreaming: e.target.checked })}
            />
          </div>
          <p className="explanation-text-style text-xs">
            {parseTextModelOptions(settings.textModel).stream
              ? t("streamingOpenRouterNote")
              : t("streamingPerModelDisabled")}
          </p>
        </SettingsSection>

        {/* Story Log Compaction Section */}
        <SettingsSection
          ariaLabelledby="storyLogCompaction-heading"
          header={t("storyLogCompactionSectionTitle")}
          icon={<Icon iconName="summarize" />}
        >
          <p className="explanation-text-style">{t("storyLogCompactionDescription")}</p>
          <div className="flex items-center justify-between gap-4">
            <span className="explanation-text-style">{t("storyLogCompactionToggleLabel")}</span>
            <ToggleSwitch
              checked={settings.enableStoryLogCompaction}
              onChange={(e) => void updateSettings({ enableStoryLogCompaction: e.target.checked })}
            />
          </div>
          <div className="mt-3">
            <label htmlFor="auto-retry-interval" className="explanation-text-style">
              {t("autoRetryIntervalLabel")}
            </label>
            <select
              id="auto-retry-interval"
              value={settings.autoRetrySeconds}
              onChange={(e) => void updateSettings({ autoRetrySeconds: Number(e.target.value) })}
              className="form-style mt-1"
            >
              <option value="0">{t("autoRetryNever")}</option>
              <option value="15">15s</option>
              <option value="30">30s</option>
              <option value="60">60s</option>
              <option value="90">90s</option>
              <option value="120">120s</option>
            </select>
          </div>
        </SettingsSection>

        {/* Automatic API Key Setup (PKCE) Section */}
        <SettingsSection
          ariaLabelledby="pkce-heading"
          header={t("apiKeyPkceSectionTitle")}
          icon={<Icon iconName="login" />}
        >
          <p className="explanation-text-style">{t("apiKeyPkceDescription")}</p>
          <Button
            type="button"
            intent="primary"
            size="medium"
            onClick={handleGetApiKey}
            className="w-full"
          >
            <Icon iconName="key" />
            {t("apiKeyPkceButton")}
          </Button>
        </SettingsSection>

        {/* API Key Section */}
        <SettingsSection ariaLabelledby="api-key-heading">
          <Expander
            id="api-key-heading"
            ariacontrols="api-key-content"
            labelText={t("apiKeySectionTitle")}
            icon={<Icon iconName="key" />}
          >
            <a
              href="https://openrouter.ai/"
              target="_blank"
              rel="noopener noreferrer"
              className="explanation-text-style"
            >
              {t("apiKeyGetLink")}
            </a>
            <form onSubmit={handleApiKeySubmit} className="form-layout-style mt-2">
              <label htmlFor="api-key-input" className="sr-only">
                {t("apiKeyInputLabel")}
              </label>
              <input
                id="api-key-input"
                type="password"
                autoComplete="new-password"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder={t("apiKeyInputLabel")}
                className="form-style"
              />
              <Button
                type="submit"
                disabled={!key.trim()}
                intent="tertiary"
                size="medium"
                className="w-48"
              >
                {apiKey ? t("updateApiKeyButton") : t("apiKeySaveButton")}
              </Button>
            </form>
            {apiKey && !isApiKeyPrefixValid(parsedModel, apiKey) && (
              <p className="text-xs font-semibold text-red-500">
                {t("apiKeyPrefixMismatchWarning")}
              </p>
            )}
            <p className="support-text-color text-xs">{t("apiKeyStoredLocallyNote")}</p>
          </Expander>
        </SettingsSection>

        {/* Data Management Section */}
        <SettingsSection ariaLabelledby="data-management-heading">
          <Expander
            id="data-management-heading"
            ariacontrols="data-management-content"
            labelText={t("dataManagementSectionTitle")}
            icon={<Icon iconName="database" />}
          >
            <div>
              <p className="explanation-text-style">{t("deleteAllDataWarning")}</p>
              <Button
                onClick={() => void handleDeleteAllData()}
                intent="danger"
                size="medium"
                className="w-full"
              >
                <Icon iconName="delete_forever" />
                {t("deleteAllDataButton")}
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

/**
 * Soft prefix check between the endpoint and the key format (legacy
 * `apiKeyValidation`): OpenRouter keys start with "sk-or-"; other endpoints
 * are always accepted. Non-strict heuristic — a warning only.
 */
function isApiKeyPrefixValid(
  options: ReturnType<typeof parseTextModelOptions>,
  apiKey: string,
): boolean {
  if (options.baseUrl === DEFAULT_OPENROUTER_BASE_URL) {
    return apiKey.startsWith("sk-or-");
  }
  return true;
}

export default SettingsScreen;

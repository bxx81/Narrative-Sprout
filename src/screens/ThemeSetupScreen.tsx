import React, { useState, useRef } from "react";
import { useNavigate } from "react-router";
import { useGameStore } from "../store/gameStore";
import { ROUTES } from "../app/routes";
import A1111ImageSettings from "../components/settings/A1111ImageSettings";
import ComfyUIImageSettings from "../components/settings/ComfyUIImageSettings";
import HuggingFaceImageSettings from "../components/settings/HuggingFaceImageSettings";
import NvidiaNimImageSettings from "../components/settings/NvidiaNimImageSettings";
import AttachmentPreview from "../components/AttachmentPreview";
import HelpTooltip from "../components/ui/HelpTooltip";
import type { ImageGeneratorType, MemoryStrategy } from "../types/settings";
import BackButton from "../components/ui/BackButton";
import Button from "../components/ui/Button";
import { Icon } from "../components/ui/Icon";

/**
 * A screen for setting up a new game theme.
 */
const ThemeSetupScreen: React.FC = () => {
  const navigate = useNavigate();
  const settings = useGameStore((s) => s.settings);
  const apiKey = useGameStore((s) => s.openrouterApiKey);
  const generation = useGameStore((s) => s.generation);
  const startNewGame = useGameStore((s) => s.startNewGame);
  const updateSettings = useGameStore((s) => s.updateSettings);
  const saveCredential = useGameStore((s) => s.saveCredential);
  const huggingFaceToken = useGameStore((s) => s.huggingFaceToken);
  const nvidiaNimToken = useGameStore((s) => s.nvidiaNimToken);

  const [theme, setTheme] = useState("");
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const loading = generation.phase === "running";

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setAttachmentFiles((prev) => [...prev, ...Array.from(files)]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
    e.target.value = "";
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!loading) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!dropZoneRef.current?.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (loading) return;
    handleFiles(e.dataTransfer.files);
  };

  const handleRemoveAttachment = (indexToRemove: number) => {
    setAttachmentFiles(attachmentFiles.filter((_, index) => index !== indexToRemove));
  };

  const handleStart = () => {
    if (!apiKey) {
      navigate(ROUTES.SETTINGS, { state: { from: ROUTES.SETUP } });
      return;
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
    void startNewGame(theme.trim(), attachmentFiles);
    navigate(ROUTES.STARTING, { replace: true, viewTransition: true });
  };

  if (!settings) return null;

  const renderSettingsComponent = () => {
    switch (settings.imageGenerator) {
      case "a1111":
        return (
          <A1111ImageSettings
            endpoint={settings.a1111Endpoint}
            setEndpoint={(endpoint) => void updateSettings({ a1111Endpoint: endpoint })}
            configJson={settings.a1111Config}
            setConfigJson={(json) => void updateSettings({ a1111Config: json })}
            loading={loading}
          />
        );
      case "comfyui":
        return (
          <ComfyUIImageSettings
            endpoint={settings.comfyuiEndpoint}
            setEndpoint={(endpoint) => void updateSettings({ comfyuiEndpoint: endpoint })}
            workflowJson={settings.comfyuiWorkflow}
            setWorkflowJson={(json) => void updateSettings({ comfyuiWorkflow: json })}
            loading={loading}
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
            loading={loading}
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
            loading={loading}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="relative mb-20 flex w-full flex-col items-center">
      <div
        ref={dropZoneRef}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className="flex w-full flex-col items-center"
      >
        {isDragging && (
          <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-lime-500/20 backdrop-blur-sm">
            <div className="rounded-lg border-4 border-dashed border-white bg-black/50 p-12 text-center text-white">
              <p className="text-2xl font-bold">Drop files here</p>
            </div>
          </div>
        )}
        <main className="w-full max-w-3xl grow px-4 py-8">
          <div className="space-y-8">
            {/* Theme Input Section */}
            <div>
              <label htmlFor="theme" className="font-serif-display mb-3 block text-xl font-bold">
                Describe the theme of your story
              </label>
              <textarea
                id="theme"
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                placeholder="e.g., A neon-lit cyberpunk city where it never stops raining"
                className="form-style"
                rows={4}
                disabled={loading}
              />
              <div className="mt-4 flex flex-col items-start gap-4">
                <div className="flex items-center gap-4">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={handleFileChange}
                    accept="image/*,text/plain,text/markdown,.md,.txt,.b64"
                    className="peer sr-only"
                    disabled={loading}
                    id="theme-attachments-upload"
                    hidden
                  />
                  <Button
                    intent="tertiary"
                    size="small"
                    disabled={loading}
                    onClick={() => {
                      fileInputRef.current?.click();
                    }}
                  >
                    <Icon iconName="attach_file_add" />
                    Attach File
                  </Button>
                </div>
                <p className="support-text-color text-xs">
                  Scenario files (YAML front matter with a `theme:` key) set the theme; their body
                  becomes attached world text. Text attachments support `{"{a|b}"}` random choices
                  and `{"<flag:NAME>"}` conditional blocks.
                </p>
                {attachmentFiles.length > 0 && (
                  <div className="w-full space-y-2">
                    {attachmentFiles.map((file, index) => (
                      <AttachmentPreview
                        key={`${file.name}-${index}-${file.lastModified}`}
                        file={file}
                        onRemove={() => handleRemoveAttachment(index)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            <fieldset className="border-text-border rounded-lg border p-4">
              <legend className="legend-text-style flex items-center gap-2 px-2">
                Image Generator
                <HelpTooltip content="Choose how game images are generated. You can connect to your own local image generation server, use a hosted Space, or disable images completely." />
              </legend>
              <select
                id="image-generator"
                value={settings.imageGenerator}
                onChange={(e) =>
                  void updateSettings({
                    imageGenerator: e.target.value as ImageGeneratorType,
                  })
                }
                disabled={loading}
                className="form-style"
              >
                <option value="huggingface">Hugging Face</option>
                <option value="a1111">AUTOMATIC1111 (Local)</option>
                <option value="comfyui">ComfyUI (Local)</option>
                <option value="nvidia_nim">NVIDIA NIM</option>
                <option value="disabled">Disabled</option>
              </select>
              {renderSettingsComponent()}
            </fieldset>

            <fieldset className="border-text-border rounded-lg border p-4">
              <legend className="legend-text-style flex items-center gap-2 px-2">
                Scene Length
                <HelpTooltip content="Controls the approximate length of each scene description. Longer settings use more API credits and may take longer to generate." />
              </legend>
              <select
                id="scene-length"
                value={settings.sceneTextLength}
                onChange={(e) => void updateSettings({ sceneTextLength: e.target.value })}
                disabled={loading}
                className="form-style"
              >
                <option value="short">50-100 words</option>
                <option value="medium">100-200 words</option>
                <option value="verbose">200+ words (Verbose)</option>
                <option value="novel">400-1200 words (Novel)</option>
                <option value="novel2">800-1600 words (Novel)</option>
              </select>
            </fieldset>

            <fieldset className="border-text-border rounded-lg border p-4">
              <legend className="legend-text-style flex items-center gap-2 px-2">
                Memory Strategy
                <HelpTooltip content="Controls how the story memory is updated. Single makes a single AI call per turn — cheaper and faster, but the same call also updates memory alongside the scene, so accuracy can suffer. Split adds a second, dedicated AI call focused purely on updating memory — more accurate, but it consumes extra tokens (and costs twice if you are billed per call). Auto picks between the two based on scene length." />
              </legend>
              <select
                id="memory-strategy"
                value={settings.memoryStrategy}
                onChange={(e) =>
                  void updateSettings({
                    memoryStrategy: e.target.value as MemoryStrategy,
                  })
                }
                disabled={loading}
                className="form-style"
              >
                <option value="auto">Auto (Recommended)</option>
                <option value="single">Single call</option>
                <option value="split">Split (Parallel)</option>
              </select>
            </fieldset>

            {generation.phase === "failed" && (
              <p className="text-sm font-semibold text-danger">
                Generation failed: {generation.error.message}
              </p>
            )}

            <div className="flex justify-center pt-4">
              <Button
                onClick={handleStart}
                disabled={loading || !theme.trim()}
                intent="primary"
                size="large"
              >
                Start Story
              </Button>
            </div>
          </div>
        </main>
        <BackButton disabled={loading} />
      </div>
    </div>
  );
};

export default ThemeSetupScreen;

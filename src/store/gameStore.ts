import { create } from "zustand";
import { devtools, subscribeWithSelector } from "zustand/middleware";
import { credentialsRepository } from "../db/credentialsRepository";
import type { CredentialKey } from "../types";
import { gameRepository } from "../db/gameRepository";
import { settingsRepository } from "../db/settingsRepository";
import { assetRepository } from "../db/assetRepository";
import { wipeRepository } from "../db/wipeRepository";
import { db } from "../db/database";
import { choosePath, refineScene, startGame } from "../features/gameplay/turnService";
import { collectAncestors } from "../features/storytree/api";
import { decideAutoplayTurn } from "../features/autoplay/api";
import { englishUiTexts } from "../features/i18n/api";
import { translateUIText } from "../features/i18n/translateService";
import { streamStore } from "./streamStore";
import { isStreamingEnabledForSettings } from "../lib/modelOptions";
import { downloadBlob, exportGameAsZip } from "../features/export/api";
import {
  clearDriveAccessToken,
  createBackupFile,
  DriveUnauthorizedError,
  hasDriveAccessToken,
  importSaveFromZipBytes,
  listDriveBackups,
  requestDriveAccessToken,
  restoreBackupFromDrive,
  restoreBackupFromEnvelopeText,
  revokeDriveAccessToken,
  uploadBackupToDrive,
  deleteDriveBackup,
  type DriveFileMetadata,
  type RestoreSummaryWithManifest,
  type SaveImportResult,
} from "../features/backup/api";
import type { GameRecord, SettingsRecord, StoryNodeRecord, StoryNodeId } from "../types";
import type { AssetRecord } from "../types/asset";
import type { AsyncOperation } from "./asyncOperation";
import {
  assetRecordFromDataUrl,
  buildImageGenConfig,
  generateSceneImage,
  webpQualityForCompression,
} from "../features/image/api";
import { processAttachmentFiles } from "../features/attachments/api";

interface GenerationPayload {
  kind: "start" | "choice" | "refine";
  choiceText?: string;
  refinePrompt?: string;
  autoplayReasoning?: string;
}

interface AutoplayDecisionPayload {
  kind: "decision";
}

interface UiTranslationPayload {
  languageName: string;
}

interface ImageRegenerationPayload {
  nodeId: string;
}

interface GameState {
  settings: SettingsRecord | null;
  openrouterApiKey: string | null;
  huggingFaceToken: string | null;
  nvidiaNimToken: string | null;
  games: GameRecord[];
  activeGame: GameRecord | null;
  nodes: StoryNodeRecord[]; // all nodes of the active game
  assets: Record<string, AssetRecord>; // nodeId -> AssetRecord
  viewingNodeId: string | null;
  /**
   * Playhead of the current playthrough: the end node of the remembered
   * root->end route that Back/Forward navigation walks. Legacy
   * `currentNodeId`. Session-only (not persisted); `latestNodeId` on the
   * record remains the save-list summary pointer.
   */
  currentNodeId: string | null;
  chronicleTargetNodeId: string | null;
  generation: AsyncOperation<GenerationPayload, never>;
  imageRegeneration: AsyncOperation<ImageRegenerationPayload, never>;
  /** Progress (0..1) of the running image generation, when reportable. */
  imageGenerationProgress: number | null;
  /** Autoplay driver: the player AI keeps choosing while true (session-only). */
  autoplay: boolean;
  /** Retrospective player-AI comment shown once when an autoplay run ends. */
  autoplayEndingComment: string | null;
  autoplayTurn: AsyncOperation<AutoplayDecisionPayload, never>;
  /** AI dynamic UI translation progress operation. */
  uiTranslation: AsyncOperation<UiTranslationPayload, never>;
  /** Progress (0..1) of the running UI translation. */
  uiTranslationProgress: number | null;
  driveConnected: boolean;
  driveBackups: DriveFileMetadata[];

  // actions (the ONLY legal way to mutate; REDESIGN §4.3.1)
  bootstrap: () => Promise<void>;
  saveApiKey: (key: string) => Promise<void>;
  saveCredential: (key: CredentialKey, value: string) => Promise<void>;
  updateSettings: (partial: Partial<SettingsRecord>) => Promise<void>;
  goToTitle: () => Promise<void>;
  startNewGame: (theme: string, attachmentFiles?: File[]) => Promise<void>;
  openGame: (gameId: string) => Promise<void>;
  choose: (
    choiceText: string,
    options?: { autoplayReasoning?: string; autoplayCost?: number },
  ) => Promise<void>;
  refine: (nodeId: string, refinePrompt: string) => Promise<void>;
  regenerateImage: (nodeId: string) => Promise<void>;
  deleteBranch: (nodeId: string) => Promise<{ gameDeleted: boolean }>;
  deleteSave: (gameId: string) => Promise<void>;
  exportSave: (gameId: string) => Promise<void>;
  wipeAllData: () => Promise<void>;
  setViewingNode: (nodeId: string) => void;
  /** Resumes play: sets the viewed node and moves the playhead (branch end). */
  resumeStoryAtNode: (nodeId: string, branchEndNodeId: string) => void;
  setChronicleTargetNode: (nodeId: string) => void;
  toggleAutoplay: () => void;
  /** One autoplay step: ask the player AI, then feed its choice into `choose`. */
  runAutoplayTurn: () => Promise<void>;
  dismissAutoplayEndingComment: () => void;
  /** Aborts the in-flight generation (text + image) via the stream signal. */
  cancelGeneration: () => void;
  setUiLanguage: (languageName: string) => Promise<void>;
  translateUi: (languageName: string) => Promise<void>;
  deleteAiTranslation: (languageName: string) => Promise<void>;
  downloadEncryptedBackup: (passphrase: string) => Promise<void>;
  restoreBackupFromFile: (file: File, passphrase: string) => Promise<RestoreSummaryWithManifest>;
  importSaveFromFile: (file: File) => Promise<SaveImportResult>;
  connectGoogleDrive: () => Promise<void>;
  disconnectGoogleDrive: () => Promise<void>;
  uploadBackupToGoogleDrive: (passphrase: string) => Promise<{ fileName: string }>;
  refreshGoogleDriveBackups: () => Promise<void>;
  restoreGoogleDriveBackup: (
    fileId: string,
    passphrase: string,
  ) => Promise<RestoreSummaryWithManifest>;
  deleteGoogleDriveBackup: (fileId: string) => Promise<void>;
}

async function loadAssetsForNodes(nodeIds: string[]): Promise<Record<string, AssetRecord>> {
  if (nodeIds.length === 0) return {};
  const assets = await db.assets.bulkGet(nodeIds);
  const map: Record<string, AssetRecord> = {};
  for (const a of assets) {
    if (a) map[a.nodeId] = a as AssetRecord;
  }
  return map;
}

async function buildImageConfigForSettings(settings: SettingsRecord) {
  const [hfToken, nimToken] = await Promise.all([
    credentialsRepository.get("huggingFaceToken"),
    credentialsRepository.get("nvidiaNimToken"),
  ]);
  return buildImageGenConfig(settings, { huggingFaceToken: hfToken, nimToken });
}

export const useGameStore = create<GameState>()(
  devtools(
    subscribeWithSelector((set, get) => ({
      settings: null,
      openrouterApiKey: null,
      huggingFaceToken: null,
      nvidiaNimToken: null,
      games: [],
      activeGame: null,
      nodes: [],
      assets: {},
      viewingNodeId: null,
      currentNodeId: null,
      chronicleTargetNodeId: null,
      generation: { phase: "idle" },
      imageRegeneration: { phase: "idle" },
      imageGenerationProgress: null,
      autoplay: false,
      autoplayEndingComment: null,
      autoplayTurn: { phase: "idle" },
      uiTranslation: { phase: "idle" },
      uiTranslationProgress: null,
      // The Drive access token lives only in memory (googleAuth), so a fresh
      // page load always starts disconnected.
      driveConnected: hasDriveAccessToken(),
      driveBackups: [],

      bootstrap: async () => {
        const [settings, apiKey, hfToken, nimToken, games] = await Promise.all([
          settingsRepository.get(),
          credentialsRepository.get("openrouterApiKey"),
          credentialsRepository.get("huggingFaceToken"),
          credentialsRepository.get("nvidiaNimToken"),
          gameRepository.listGames(),
        ]);
        // Orphan GC (best-effort, non-blocking failure)
        void assetRepository.collectGarbage().catch(() => {});
        set({
          settings,
          openrouterApiKey: apiKey,
          huggingFaceToken: hfToken,
          nvidiaNimToken: nimToken,
          games,
        });
      },

      saveApiKey: async (key) => {
        await credentialsRepository.set("openrouterApiKey", key);
        set({ openrouterApiKey: key });
      },

      saveCredential: async (key, value) => {
        await credentialsRepository.set(key, value);
        switch (key) {
          case "openrouterApiKey":
            set({ openrouterApiKey: value });
            break;
          case "huggingFaceToken":
            set({ huggingFaceToken: value });
            break;
          case "nvidiaNimToken":
            set({ nvidiaNimToken: value });
            break;
          default:
            break;
        }
      },

      updateSettings: async (partial) => {
        const current = get().settings;
        if (!current) return;
        const updated: SettingsRecord = { ...current, ...partial };
        await settingsRepository.put(updated);
        set({ settings: updated });
      },

      goToTitle: async () => {
        const games = await gameRepository.listGames();
        set({
          games,
          activeGame: null,
          nodes: [],
          assets: {},
          viewingNodeId: null,
          currentNodeId: null,
          chronicleTargetNodeId: null,
          generation: { phase: "idle" },
          autoplay: false,
        });
      },

      startNewGame: async (theme, attachmentFiles) => {
        const { settings, openrouterApiKey } = get();
        if (!settings || !openrouterApiKey) throw new Error("Setup incomplete.");
        const payload: GenerationPayload = { kind: "start" };
        set({
          generation: { phase: "running", payload, startedAt: new Date().toISOString() },
        });
        streamStore.begin(isStreamingEnabledForSettings(settings));
        try {
          let resolvedTheme = theme;
          let attachmentTexts: string[] = [];
          if (attachmentFiles && attachmentFiles.length > 0) {
            const processed = await processAttachmentFiles(attachmentFiles, theme);
            resolvedTheme = processed.theme;
            attachmentTexts = processed.attachmentTexts;
          }
          const imageGenConfig = await buildImageConfigForSettings(settings);
          const { game, rootNode } = await startGame(
            {
              apiKey: openrouterApiKey,
              model: settings.textModel,
              theme: resolvedTheme,
              language: settings.language,
              sceneTextLength: settings.sceneTextLength,
              attachmentTexts,
              imageGenConfig,
              webpCompression: settings.webpCompression,
              memoryStrategy: settings.memoryStrategy,
              enableStoryLogCompaction: settings.enableStoryLogCompaction,
              onSceneTextDelta: (accumulatedText) => streamStore.pushDelta(accumulatedText),
            },
            { signal: streamStore.getSignal() ?? undefined },
          );
          const assets = await loadAssetsForNodes([rootNode.id]);
          set({
            activeGame: game,
            nodes: [rootNode],
            assets,
            viewingNodeId: rootNode.id,
            currentNodeId: rootNode.id,
            generation: { phase: "idle" },
          });
        } catch (error) {
          set({ generation: { phase: "failed", payload, error: error as Error } });
        } finally {
          streamStore.end();
        }
      },

      openGame: async (gameId) => {
        const [game, nodes] = await Promise.all([
          gameRepository.getGame(gameId),
          gameRepository.getNodesOfGame(gameId),
        ]);
        if (!game) return;
        const assets = await loadAssetsForNodes(nodes.map((n) => n.id));
        const playhead = game.latestNodeId ?? nodes[0]?.id ?? null;
        set({
          activeGame: game,
          nodes,
          assets,
          viewingNodeId: playhead,
          currentNodeId: playhead,
          autoplay: false,
        });
      },

      choose: async (choiceText, options) => {
        const state = get();
        const { settings, openrouterApiKey, activeGame, viewingNodeId } = state;
        if (!settings || !openrouterApiKey || !activeGame || !viewingNodeId) return;
        const isAutoplayChain = options?.autoplayReasoning !== undefined;
        // Autoplay was toggled off while the player AI was deciding: discard
        // the in-flight chain call (legacy onChoice guard).
        if (isAutoplayChain && !state.autoplay) return;
        // Only the autoplay chain itself (carrying its reasoning token) may
        // generate while autoplay is active; manual clicks are rejected.
        if (state.autoplay && !isAutoplayChain) return;
        // Manual double-generation guard; the autoplay chain bypasses it.
        if (state.generation.phase === "running" && !isAutoplayChain) return;

        const parentNode = state.nodes.find((n) => n.id === viewingNodeId);
        if (!parentNode) return;

        const byId = new Map(state.nodes.map((n) => [n.id, n]));
        const ancestors = collectAncestors(byId, viewingNodeId, true);

        const payload: GenerationPayload = {
          kind: "choice",
          choiceText,
          autoplayReasoning: options?.autoplayReasoning,
        };
        set({
          generation: { phase: "running", payload, startedAt: new Date().toISOString() },
        });
        streamStore.begin(isStreamingEnabledForSettings(settings));
        try {
          const imageGenConfig = await buildImageConfigForSettings(settings);
          const node = await choosePath(
            {
              apiKey: openrouterApiKey,
              model: settings.textModel,
              game: activeGame,
              parentNode,
              ancestors,
              choiceText,
              language: settings.language,
              sceneTextLength: settings.sceneTextLength,
              attachmentTexts: activeGame.attachmentTexts ?? [],
              imageGenConfig,
              webpCompression: settings.webpCompression,
              memoryStrategy: settings.memoryStrategy,
              enableStoryLogCompaction: settings.enableStoryLogCompaction,
              autoplayReasoning: options?.autoplayReasoning,
              autoplayCost: options?.autoplayCost,
              onSceneTextDelta: (accumulatedText) => streamStore.pushDelta(accumulatedText),
            },
            { signal: streamStore.getSignal() ?? undefined },
          );
          const updatedNodes = [...get().nodes, node];
          const updatedGame = {
            ...activeGame,
            latestNodeId: node.id,
            lastPlayedAt: node.createdAt,
          };
          const newAssets = await loadAssetsForNodes([node.id]);
          set({
            nodes: updatedNodes,
            assets: { ...get().assets, ...newAssets },
            activeGame: updatedGame,
            viewingNodeId: node.id,
            currentNodeId: node.id,
            generation: { phase: "idle" },
          });
        } catch (error) {
          set({ generation: { phase: "failed", payload, error: error as Error } });
        } finally {
          streamStore.end();
        }
      },

      refine: async (nodeId, refinePrompt) => {
        const state = get();
        const { settings, openrouterApiKey, activeGame } = state;
        if (!settings || !openrouterApiKey || !activeGame) return;
        if (state.generation.phase === "running") return;
        const targetNode = state.nodes.find((n) => n.id === nodeId);
        if (!targetNode) return;
        const parentNode = targetNode.parentNodeId
          ? (state.nodes.find((n) => n.id === targetNode.parentNodeId) ?? null)
          : null;
        const byId = new Map(state.nodes.map((n) => [n.id, n]));
        // ancestors of parent for context
        const ancestors = parentNode ? collectAncestors(byId, parentNode.id, true) : [];
        const payload: GenerationPayload = { kind: "refine", refinePrompt };
        set({ generation: { phase: "running", payload, startedAt: new Date().toISOString() } });
        streamStore.begin(isStreamingEnabledForSettings(settings));
        try {
          const imageGenConfig = await buildImageConfigForSettings(settings);
          const node = await refineScene(
            {
              apiKey: openrouterApiKey,
              model: settings.textModel,
              game: activeGame,
              targetNode,
              parentNode,
              ancestors,
              refinePrompt,
              language: settings.language,
              sceneTextLength: settings.sceneTextLength,
              attachmentTexts: activeGame.attachmentTexts ?? [],
              imageGenConfig,
              webpCompression: settings.webpCompression,
              memoryStrategy: settings.memoryStrategy,
              enableStoryLogCompaction: settings.enableStoryLogCompaction,
              onSceneTextDelta: (accumulatedText) => streamStore.pushDelta(accumulatedText),
            },
            { signal: streamStore.getSignal() ?? undefined },
          );
          const updatedNodes = [...get().nodes, node];
          const updatedGame = {
            ...activeGame,
            latestNodeId: node.id,
            lastPlayedAt: node.createdAt,
          };
          const newAssets = await loadAssetsForNodes([node.id]);
          set({
            nodes: updatedNodes,
            assets: { ...get().assets, ...newAssets },
            activeGame: updatedGame,
            viewingNodeId: node.id,
            currentNodeId: node.id,
            generation: { phase: "idle" },
          });
        } catch (error) {
          set({ generation: { phase: "failed", payload, error: error as Error } });
        } finally {
          streamStore.end();
        }
      },

      regenerateImage: async (nodeId) => {
        const state = get();
        const { settings, activeGame } = state;
        if (!settings || !activeGame) return;
        if (state.generation.phase === "running") return;
        if (state.imageRegeneration.phase === "running") return;
        if (settings.imageGenerator === "disabled") return;
        const node = state.nodes.find((n) => n.id === nodeId);
        if (!node) return;

        const payload: ImageRegenerationPayload = { nodeId };
        set({
          imageRegeneration: { phase: "running", payload, startedAt: new Date().toISOString() },
          imageGenerationProgress: null,
        });
        try {
          const imageGenConfig = await buildImageConfigForSettings(settings);
          const dataUrl = await generateSceneImage({
            imagePrompt: node.scene.imagePrompt,
            negativeImagePrompt: node.scene.negativeImagePrompt,
            imageGenConfig,
            onProgress: (progress) => set({ imageGenerationProgress: progress }),
          });
          const asset = await assetRecordFromDataUrl(
            nodeId as StoryNodeId,
            dataUrl,
            webpQualityForCompression(settings.webpCompression),
          );
          if (asset) {
            // Regeneration overwrites the same key (REDESIGN §5.3)
            await assetRepository.put(asset);
            set({
              assets: { ...get().assets, [nodeId]: asset },
              imageRegeneration: { phase: "idle" },
              imageGenerationProgress: null,
            });
          } else {
            set({
              imageRegeneration: {
                phase: "failed",
                payload,
                error: new Error("Image generation returned no image."),
              },
              imageGenerationProgress: null,
            });
          }
        } catch (error) {
          if ((error as Error).name === "AbortError") {
            set({ imageRegeneration: { phase: "idle" }, imageGenerationProgress: null });
            return;
          }
          set({
            imageRegeneration: { phase: "failed", payload, error: error as Error },
            imageGenerationProgress: null,
          });
        }
      },

      deleteBranch: async (nodeId) => {
        const { activeGame } = get();
        if (!activeGame) return { gameDeleted: false };
        const updatedGame = await gameRepository.deleteBranch(activeGame.id, nodeId);
        if (!updatedGame) {
          // Entire game deleted
          const games = await gameRepository.listGames();
          set({
            games,
            activeGame: null,
            nodes: [],
            assets: {},
            viewingNodeId: null,
            currentNodeId: null,
            chronicleTargetNodeId: null,
            autoplay: false,
          });
          return { gameDeleted: true };
        }
        // Reload to get accurate remaining nodes/assets
        const freshNodes = await gameRepository.getNodesOfGame(activeGame.id);
        const freshAssets = await loadAssetsForNodes(freshNodes.map((n) => n.id));
        const games = await gameRepository.listGames();
        const playhead = updatedGame.latestNodeId ?? freshNodes[0]?.id ?? null;
        set({
          games,
          activeGame: updatedGame,
          nodes: freshNodes,
          assets: freshAssets,
          viewingNodeId: playhead,
          currentNodeId: playhead,
          autoplay: false,
        });
        void assetRepository.collectGarbage().catch(() => {});
        return { gameDeleted: false };
      },

      setViewingNode: (nodeId) => set({ viewingNodeId: nodeId }),

      resumeStoryAtNode: (nodeId, branchEndNodeId) => {
        const { activeGame, nodes } = get();
        if (!activeGame) return;
        // Both endpoints must be nodes of the active game.
        const knownIds = new Set<string>(nodes.map((n) => n.id));
        if (!knownIds.has(nodeId) || !knownIds.has(branchEndNodeId)) return;
        // Rewinding stops the autoplay chain (legacy REWIND behavior).
        set({ viewingNodeId: nodeId, currentNodeId: branchEndNodeId, autoplay: false });
      },

      setChronicleTargetNode: (nodeId) => set({ chronicleTargetNodeId: nodeId }),

      toggleAutoplay: () => {
        if (!get().activeGame) return;
        set({ autoplay: !get().autoplay });
      },

      runAutoplayTurn: async () => {
        const state = get();
        const { settings, openrouterApiKey, activeGame, nodes, viewingNodeId, autoplay } = state;
        if (!autoplay || !settings || !openrouterApiKey || !activeGame || !viewingNodeId) return;
        if (state.generation.phase !== "idle") return;
        if (state.autoplayTurn.phase !== "idle") return;

        const payload: AutoplayDecisionPayload = { kind: "decision" };
        set({
          autoplayTurn: { phase: "running", payload, startedAt: new Date().toISOString() },
        });
        try {
          const decision = await decideAutoplayTurn({
            apiKey: openrouterApiKey,
            textModel: settings.textModel,
            game: activeGame,
            nodes,
            viewingNodeId,
            narrativeLanguage: settings.language,
          });
          if (decision.storyOver) {
            // Ending reached: hold the comment for the UI dialog and stop.
            set({
              autoplayTurn: { phase: "idle" },
              autoplay: false,
              autoplayEndingComment: decision.reasoning,
            });
            return;
          }
          if (!get().autoplay) {
            // Toggled off while deciding: drop the decision.
            set({ autoplayTurn: { phase: "idle" } });
            return;
          }
          set({ autoplayTurn: { phase: "idle" } });
          await get().choose(decision.choice, {
            autoplayReasoning: decision.reasoning,
            autoplayCost: decision.generationCost ?? 0,
          });
        } catch (error) {
          set({
            autoplayTurn: { phase: "failed", payload, error: error as Error },
            autoplay: false,
          });
        }
      },

      dismissAutoplayEndingComment: () => set({ autoplayEndingComment: null }),

      cancelGeneration: () => streamStore.cancel(),

      setUiLanguage: async (languageName) => {
        await get().updateSettings({ uiLanguage: languageName });
      },

      translateUi: async (languageName) => {
        const state = get();
        const { settings, openrouterApiKey } = state;
        if (!settings || !openrouterApiKey) throw new Error("Setup incomplete.");
        if (state.uiTranslation.phase === "running") return;
        const payload: UiTranslationPayload = { languageName };
        set({
          uiTranslation: { phase: "running", payload, startedAt: new Date().toISOString() },
          uiTranslationProgress: null,
        });
        try {
          const { translation, languageCode } = await translateUIText({
            apiKey: openrouterApiKey,
            textModel: settings.textModel,
            targetLanguage: languageName,
            englishTexts: englishUiTexts,
            onProgress: (progress) => set({ uiTranslationProgress: progress }),
          });
          await get().updateSettings({
            aiTranslations: { ...get().settings?.aiTranslations, [languageName]: translation },
            aiLanguageMappings: {
              ...get().settings?.aiLanguageMappings,
              [languageName]: languageCode,
            },
            uiLanguage: languageName,
          });
          set({ uiTranslation: { phase: "idle" }, uiTranslationProgress: null });
        } catch (error) {
          set({
            uiTranslation: { phase: "failed", payload, error: error as Error },
            uiTranslationProgress: null,
          });
        }
      },

      deleteAiTranslation: async (languageName) => {
        const settings = get().settings;
        if (!settings) return;
        const aiTranslations = { ...settings.aiTranslations };
        const aiLanguageMappings = { ...settings.aiLanguageMappings };
        delete aiTranslations[languageName];
        delete aiLanguageMappings[languageName];
        const uiLanguage = settings.uiLanguage === languageName ? "English" : settings.uiLanguage;
        await get().updateSettings({ aiTranslations, aiLanguageMappings, uiLanguage });
      },

      deleteSave: async (gameId) => {
        await gameRepository.deleteGame(gameId);
        set({ games: await gameRepository.listGames() });
      },

      exportSave: async (gameId) => {
        const { fileName, blob } = await exportGameAsZip(gameId);
        downloadBlob(blob, fileName);
      },

      wipeAllData: async () => {
        await wipeRepository.wipeAllUserData();
        localStorage.clear();
        sessionStorage.clear();
        // Flag for the completion screen; must be set AFTER the storage wipe
        // because the wipe intentionally clears everything.
        sessionStorage.setItem("nsDataDeletionComplete", "1");
        // Full reload guarantees no stale in-memory state over a deleted DB
        // (Dexie refuses to auto-reopen a deleted database).
        window.location.reload();
      },

      downloadEncryptedBackup: async (passphrase) => {
        const { fileName, blob } = await createBackupFile(passphrase);
        downloadBlob(blob, fileName);
      },

      restoreBackupFromFile: async (file, passphrase) => {
        const summary = await restoreBackupFromEnvelopeText(await file.text(), passphrase);
        const [games, settings] = await Promise.all([
          gameRepository.listGames(),
          settingsRepository.get(),
        ]);
        set({ games, settings });
        return summary;
      },

      importSaveFromFile: async (file) => {
        const result = await importSaveFromZipBytes(new Uint8Array(await file.arrayBuffer()));
        set({ games: await gameRepository.listGames() });
        return result;
      },

      connectGoogleDrive: async () => {
        const accessToken = await requestDriveAccessToken();
        set({ driveConnected: true, driveBackups: [] });
        try {
          // Metadata only (names/sizes/dates) — one cheap API call, no
          // backup contents are downloaded until the user restores one.
          set({ driveBackups: await listDriveBackups(accessToken) });
        } catch (error) {
          if (error instanceof DriveUnauthorizedError) {
            clearDriveAccessToken();
            set({ driveConnected: false });
          }
          throw error;
        }
      },

      disconnectGoogleDrive: async () => {
        await revokeDriveAccessToken();
        set({ driveConnected: false, driveBackups: [] });
      },

      uploadBackupToGoogleDrive: async (passphrase) => {
        // Token first: GIS needs the user gesture, and key derivation is slow.
        const accessToken = await requestDriveAccessToken();
        try {
          const { fileName } = await uploadBackupToDrive(accessToken, passphrase);
          set({ driveConnected: true, driveBackups: await listDriveBackups(accessToken) });
          return { fileName };
        } catch (error) {
          if (error instanceof DriveUnauthorizedError) {
            clearDriveAccessToken();
            set({ driveConnected: false });
          }
          throw error;
        }
      },

      refreshGoogleDriveBackups: async () => {
        const accessToken = await requestDriveAccessToken();
        try {
          set({ driveConnected: true, driveBackups: await listDriveBackups(accessToken) });
        } catch (error) {
          if (error instanceof DriveUnauthorizedError) {
            clearDriveAccessToken();
            set({ driveConnected: false });
          }
          throw error;
        }
      },

      restoreGoogleDriveBackup: async (fileId, passphrase) => {
        const accessToken = await requestDriveAccessToken();
        try {
          const summary = await restoreBackupFromDrive(accessToken, fileId, passphrase);
          const [games, settings] = await Promise.all([
            gameRepository.listGames(),
            settingsRepository.get(),
          ]);
          set({ games, settings });
          return summary;
        } catch (error) {
          if (error instanceof DriveUnauthorizedError) {
            clearDriveAccessToken();
            set({ driveConnected: false });
          }
          throw error;
        }
      },

      deleteGoogleDriveBackup: async (fileId) => {
        const accessToken = await requestDriveAccessToken();
        try {
          await deleteDriveBackup(accessToken, fileId);
          set({ driveBackups: get().driveBackups.filter((backup) => backup.fileId !== fileId) });
        } catch (error) {
          if (error instanceof DriveUnauthorizedError) {
            clearDriveAccessToken();
            set({ driveConnected: false });
          }
          throw error;
        }
      },
    })),
    { name: "game" },
  ),
);

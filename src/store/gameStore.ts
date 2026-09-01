import { create } from "zustand";
import { devtools, subscribeWithSelector } from "zustand/middleware";
import { credentialsRepository } from "../db/credentialsRepository";
import { gameRepository } from "../db/gameRepository";
import { settingsRepository } from "../db/settingsRepository";
import { assetRepository } from "../db/assetRepository";
import { db } from "../db/database";
import { choosePath, refineScene, startGame } from "../features/gameplay/turnService";
import { collectAncestors } from "../features/storytree/treeTraversal";
import type { GameRecord, SettingsRecord, StoryNodeRecord } from "../types";
import type { AssetRecord } from "../types/asset";
import type { AsyncOperation } from "./asyncOperation";
import { buildImageGenConfig } from "../features/image/buildImageGenConfig";
import { processAttachmentFiles } from "../features/attachments/api";

type Screen = "title" | "themeSetup" | "playing";

interface GenerationPayload {
  kind: "start" | "choice" | "refine";
  choiceText?: string;
  refinePrompt?: string;
}

interface GameState {
  screen: Screen;
  settings: SettingsRecord | null;
  openrouterApiKey: string | null;
  games: GameRecord[];
  activeGame: GameRecord | null;
  nodes: StoryNodeRecord[]; // all nodes of the active game
  assets: Record<string, AssetRecord>; // nodeId -> AssetRecord
  viewingNodeId: string | null;
  generation: AsyncOperation<GenerationPayload, never>;

  // actions (the ONLY legal way to mutate; REDESIGN §4.3.1)
  bootstrap: () => Promise<void>;
  saveApiKey: (key: string) => Promise<void>;
  goToTitle: () => Promise<void>;
  beginThemeSetup: () => void;
  startNewGame: (theme: string, attachmentFiles?: File[]) => Promise<void>;
  openGame: (gameId: string) => Promise<void>;
  choose: (choiceText: string) => Promise<void>;
  refine: (nodeId: string, refinePrompt: string) => Promise<void>;
  deleteBranch: (nodeId: string) => Promise<void>;
  setViewingNode: (nodeId: string) => void;
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
      screen: "title",
      settings: null,
      openrouterApiKey: null,
      games: [],
      activeGame: null,
      nodes: [],
      assets: {},
      viewingNodeId: null,
      generation: { phase: "idle" },

      bootstrap: async () => {
        const [settings, apiKey, games] = await Promise.all([
          settingsRepository.get(),
          credentialsRepository.get("openrouterApiKey"),
          gameRepository.listGames(),
        ]);
        // Orphan GC (best-effort, non-blocking failure)
        void assetRepository.collectGarbage().catch(() => {});
        set({ settings, openrouterApiKey: apiKey, games });
      },

      saveApiKey: async (key) => {
        await credentialsRepository.set("openrouterApiKey", key);
        set({ openrouterApiKey: key });
      },

      goToTitle: async () => {
        const games = await gameRepository.listGames();
        set({
          screen: "title",
          games,
          activeGame: null,
          nodes: [],
          assets: {},
          viewingNodeId: null,
          generation: { phase: "idle" },
        });
      },

      beginThemeSetup: () => set({ screen: "themeSetup" }),

      startNewGame: async (theme, attachmentFiles) => {
        const { settings, openrouterApiKey } = get();
        if (!settings || !openrouterApiKey) throw new Error("Setup incomplete.");
        const payload: GenerationPayload = { kind: "start" };
        set({
          generation: { phase: "running", payload, startedAt: new Date().toISOString() },
        });
        try {
          let resolvedTheme = theme;
          let attachmentTexts: string[] = [];
          if (attachmentFiles && attachmentFiles.length > 0) {
            const processed = await processAttachmentFiles(attachmentFiles, theme);
            resolvedTheme = processed.theme;
            attachmentTexts = processed.attachmentTexts;
          }
          const imageGenConfig = await buildImageConfigForSettings(settings);
          const { game, rootNode } = await startGame({
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
          });
          const assets = await loadAssetsForNodes([rootNode.id]);
          set({
            screen: "playing",
            activeGame: game,
            nodes: [rootNode],
            assets,
            viewingNodeId: rootNode.id,
            generation: { phase: "idle" },
          });
        } catch (error) {
          set({ generation: { phase: "failed", payload, error: error as Error } });
        }
      },

      openGame: async (gameId) => {
        const [game, nodes] = await Promise.all([
          gameRepository.getGame(gameId),
          gameRepository.getNodesOfGame(gameId),
        ]);
        if (!game) return;
        const assets = await loadAssetsForNodes(nodes.map((n) => n.id));
        set({
          screen: "playing",
          activeGame: game,
          nodes,
          assets,
          viewingNodeId: game.latestNodeId ?? nodes[0]?.id ?? null,
        });
      },

      choose: async (choiceText) => {
        const state = get();
        const { settings, openrouterApiKey, activeGame, viewingNodeId } = state;
        if (!settings || !openrouterApiKey || !activeGame || !viewingNodeId) return;
        if (state.generation.phase === "running") return;

        const parentNode = state.nodes.find((n) => n.id === viewingNodeId);
        if (!parentNode) return;

        const byId = new Map(state.nodes.map((n) => [n.id, n]));
        const ancestors = collectAncestors(byId, viewingNodeId, true);

        const payload: GenerationPayload = { kind: "choice", choiceText };
        set({
          generation: { phase: "running", payload, startedAt: new Date().toISOString() },
        });
        try {
          const imageGenConfig = await buildImageConfigForSettings(settings);
          const node = await choosePath({
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
          });
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
            generation: { phase: "idle" },
          });
        } catch (error) {
          set({ generation: { phase: "failed", payload, error: error as Error } });
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
        try {
          const imageGenConfig = await buildImageConfigForSettings(settings);
          const node = await refineScene({
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
          });
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
            generation: { phase: "idle" },
          });
        } catch (error) {
          set({ generation: { phase: "failed", payload, error: error as Error } });
        }
      },

      deleteBranch: async (nodeId) => {
        const { activeGame } = get();
        if (!activeGame) return;
        const updatedGame = await gameRepository.deleteBranch(activeGame.id, nodeId);
        if (!updatedGame) {
          // Entire game deleted
          const games = await gameRepository.listGames();
          set({
            screen: "title",
            games,
            activeGame: null,
            nodes: [],
            assets: {},
            viewingNodeId: null,
          });
          return;
        }
        // Reload to get accurate remaining nodes/assets
        const freshNodes = await gameRepository.getNodesOfGame(activeGame.id);
        const freshAssets = await loadAssetsForNodes(freshNodes.map((n) => n.id));
        const games = await gameRepository.listGames();
        set({
          games,
          activeGame: updatedGame,
          nodes: freshNodes,
          assets: freshAssets,
          viewingNodeId: updatedGame.latestNodeId ?? freshNodes[0]?.id ?? null,
        });
        void assetRepository.collectGarbage().catch(() => {});
      },

      setViewingNode: (nodeId) => set({ viewingNodeId: nodeId }),
    })),
    { name: "game" },
  ),
);

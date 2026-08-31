import { create } from "zustand";
import { devtools, subscribeWithSelector } from "zustand/middleware";
import { credentialsRepository } from "../db/credentialsRepository";
import { gameRepository } from "../db/gameRepository";
import { settingsRepository } from "../db/settingsRepository";
import { choosePath, startGame } from "../features/gameplay/turnService";
import { collectAncestors } from "../features/storytree/treeTraversal";
import type { GameRecord, SettingsRecord, StoryNodeRecord } from "../types";
import type { AsyncOperation } from "./asyncOperation";

type Screen = "title" | "themeSetup" | "playing";

interface GenerationPayload {
  kind: "start" | "choice";
  choiceText?: string;
}

interface GameState {
  screen: Screen;
  settings: SettingsRecord | null;
  openrouterApiKey: string | null;
  games: GameRecord[];
  activeGame: GameRecord | null;
  nodes: StoryNodeRecord[]; // all nodes of the active game
  viewingNodeId: string | null;
  generation: AsyncOperation<GenerationPayload, never>;

  // actions (the ONLY legal way to mutate; REDESIGN §4.3.1)
  bootstrap: () => Promise<void>;
  saveApiKey: (key: string) => Promise<void>;
  goToTitle: () => Promise<void>;
  beginThemeSetup: () => void;
  startNewGame: (theme: string) => Promise<void>;
  openGame: (gameId: string) => Promise<void>;
  choose: (choiceText: string) => Promise<void>;
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
      viewingNodeId: null,
      generation: { phase: "idle" },

      bootstrap: async () => {
        const [settings, apiKey, games] = await Promise.all([
          settingsRepository.get(),
          credentialsRepository.get("openrouterApiKey"),
          gameRepository.listGames(),
        ]);
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
          viewingNodeId: null,
          generation: { phase: "idle" },
        });
      },

      beginThemeSetup: () => set({ screen: "themeSetup" }),

      startNewGame: async (theme) => {
        const { settings, openrouterApiKey } = get();
        if (!settings || !openrouterApiKey) throw new Error("Setup incomplete.");
        const payload: GenerationPayload = { kind: "start" };
        set({
          generation: { phase: "running", payload, startedAt: new Date().toISOString() },
        });
        try {
          const { game, rootNode } = await startGame({
            apiKey: openrouterApiKey,
            model: settings.textModel,
            theme,
            language: settings.language,
            sceneTextLength: settings.sceneTextLength,
          });
          set({
            screen: "playing",
            activeGame: game,
            nodes: [rootNode],
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
        set({
          screen: "playing",
          activeGame: game,
          nodes,
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
          const node = await choosePath({
            apiKey: openrouterApiKey,
            model: settings.textModel,
            game: activeGame,
            parentNode,
            ancestors,
            choiceText,
            language: settings.language,
            sceneTextLength: settings.sceneTextLength,
          });
          const updatedNodes = [...get().nodes, node];
          const updatedGame = {
            ...activeGame,
            latestNodeId: node.id,
            lastPlayedAt: node.createdAt,
          };
          set({
            nodes: updatedNodes,
            activeGame: updatedGame,
            viewingNodeId: node.id,
            generation: { phase: "idle" },
          });
        } catch (error) {
          set({ generation: { phase: "failed", payload, error: error as Error } });
        }
      },
    })),
    { name: "game" },
  ),
);

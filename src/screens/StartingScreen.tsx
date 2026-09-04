import React, { useEffect, useSyncExternalStore } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { useGameStore } from "../store/gameStore";
import { streamStore } from "../store/streamStore";
import { ROUTES } from "../app/routes";
import LoadingSpinner from "../components/ui/LoadingSpinner";
import Button from "../components/ui/Button";
import { Icon } from "../components/ui/Icon";
import { ElapsedCounter } from "../components/game/LoadingOverlay";
import { minWordsTarget } from "../features/narrative/api";

// テーマ送信後、APIの応答待ちをしている間表示される。応答後GameScreenに遷移する。

const StartingScreen: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const generation = useGameStore((s) => s.generation);
  const generationStage = useGameStore((s) => s.generationStage);
  const showElapsedTime = useGameStore((s) => s.settings?.showElapsedTime ?? false);
  const sceneTextLength = useGameStore((s) => s.settings?.sceneTextLength);
  const imageGenerator = useGameStore((s) => s.settings?.imageGenerator);
  const imageGenerationProgress = useGameStore((s) => s.imageGenerationProgress);
  const activeGame = useGameStore((s) => s.activeGame);
  const cancelGeneration = useGameStore((s) => s.cancelGeneration);

  const stream = useSyncExternalStore(streamStore.subscribe, streamStore.getSnapshot);
  const isGenerationActive = generation.phase === "running" && stream.status !== "idle";
  const isStreamActive = generation.phase === "running" && stream.status === "streaming";
  // 疑似プログレスバー: 受信語数 ÷ 目標語数、画像フェーズを残す上限90%(数値は出さない)。
  // 本文受信済みなら残りは画像処理: 実プログレス(a1111/comfyui)があれば語数進捗の続きから
  // 0.9 + 0.1 * progress で伸ばす(常に語数進捗の上限90%以上のため単調に増える)。
  // 画像なし設定ならテキスト完了で10割(残余はJSON・後処理のみ)。
  // 実プログレスのない画像生成器では90%で保持する。
  const wordProgress = Math.min(
    0.9,
    stream.wordCount / Math.max(1, minWordsTarget(sceneTextLength ?? "medium")),
  );
  const hasImageStep = (imageGenerator ?? "disabled") !== "disabled";
  const pseudoProgress =
    imageGenerationProgress != null
      ? 0.9 + 0.1 * imageGenerationProgress
      : isStreamActive && !hasImageStep && stream.sceneTextComplete
        ? 1
        : wordProgress;

  // テキスト生成中は紡ぎ、画像フェーズへ移行したら描き文案へ切り替える(Legacy同様)
  const loadingMessage =
    generationStage === "image" ? t("loadingPaintingScene") : t("loadingWeavingScene");

  // On success (start payload finished, game created), go to the play screen.
  // Failures are handled by the global ErrorDialog (retry / back to setup).
  useEffect(() => {
    if (generation.phase === "idle" && activeGame) {
      navigate(ROUTES.PLAY, { replace: true, viewTransition: true });
    }
  }, [generation.phase, activeGame, navigate]);

  return (
    <main className="mx-auto flex h-screen flex-col items-center justify-center text-center">
      <LoadingSpinner className="size-16 text-lime-600 dark:text-lime-400" />
      <div
        key={loadingMessage}
        className="animate-fade-in font-serif-display mt-8 text-xl md:text-2xl"
      >
        {loadingMessage}
      </div>
      {generation.phase === "running" && showElapsedTime && (
        <div className="mt-4">
          <ElapsedCounter generationStartedAt={new Date(generation.startedAt).getTime()} />
        </div>
      )}
      {isStreamActive && (
        <div
          className="border-text-border mt-6 h-1 w-64 overflow-hidden rounded-full border"
          role="progressbar"
          aria-label={t("generationProgressLabel")}
        >
          <div
            className="h-full bg-lime-600 transition-[width] duration-500 ease-out dark:bg-lime-400"
            style={{ width: `${Math.round(pseudoProgress * 100)}%` }}
          />
        </div>
      )}
      {isGenerationActive && (
        <Button
          intent="navigator"
          size="medium-circle"
          className="fixed right-21 bottom-6 z-120"
          onClick={cancelGeneration}
          title={t("cancelGenerationButton")}
          aria-label={t("cancelGenerationButton")}
        >
          <Icon iconName="stop_circle" />
        </Button>
      )}
    </main>
  );
};

export default StartingScreen;

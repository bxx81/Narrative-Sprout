import React, { useEffect } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { useGameStore } from "../store/gameStore";
import { ROUTES } from "../app/routes";
import LoadingSpinner from "../components/ui/LoadingSpinner";

// テーマ送信後、APIの応答待ちをしている間表示される。応答後GameScreenに遷移する。

const StartingScreen: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const generation = useGameStore((s) => s.generation);
  const activeGame = useGameStore((s) => s.activeGame);

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
      <div className="animate-fade-in font-serif-display mt-8 text-xl md:text-2xl">
        {t("loadingWeavingScene")}
      </div>
    </main>
  );
};

export default StartingScreen;

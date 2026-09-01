import React, { useEffect } from "react";
import { useNavigate } from "react-router";
import { useGameStore } from "../store/gameStore";
import { ROUTES } from "../app/routes";
import LoadingSpinner from "../components/ui/LoadingSpinner";
import Button from "../components/ui/Button";
import BackButton from "../components/ui/BackButton";

// テーマ送信後、APIの応答待ちをしている間表示される。応答後GameScreenに遷移する。

const StartingScreen: React.FC = () => {
  const navigate = useNavigate();
  const generation = useGameStore((s) => s.generation);
  const activeGame = useGameStore((s) => s.activeGame);
  const goToTitle = useGameStore((s) => s.goToTitle);

  // On success (start payload finished, game created), go to the play screen.
  useEffect(() => {
    if (generation.phase === "idle" && activeGame) {
      navigate(ROUTES.PLAY, { replace: true, viewTransition: true });
    }
  }, [generation.phase, activeGame, navigate]);

  if (generation.phase === "failed") {
    return (
      <main className="mx-auto flex h-screen flex-col items-center justify-center gap-6 text-center">
        <div className="text-danger text-lg font-semibold">Generation failed</div>
        <p className="support-text-color max-w-xl px-4 whitespace-pre-wrap">
          {generation.error.message}
        </p>
        <div className="flex gap-3">
          <Button
            intent="tertiary"
            size="medium"
            onClick={() => {
              void goToTitle();
              navigate(ROUTES.SETUP, { replace: true, viewTransition: true });
            }}
          >
            Back to Setup
          </Button>
        </div>
        <BackButton />
      </main>
    );
  }

  return (
    <main className="mx-auto flex h-screen flex-col items-center justify-center text-center">
      <LoadingSpinner className="size-16 text-lime-600 dark:text-lime-400" />
      <div className="animate-fade-in font-serif-display mt-8 text-xl md:text-2xl">
        Preparing your story...
      </div>
      <BackButton />
    </main>
  );
};

export default StartingScreen;

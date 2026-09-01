import { useEffect } from "react";
import { GameScreen } from "../screens/GameScreen";
import { ThemeSetupScreen } from "../screens/ThemeSetupScreen";
import { TitleScreen } from "../screens/TitleScreen";
import { useGameStore } from "../store/gameStore";

export function App() {
  const screen = useGameStore((s) => s.screen);
  const settingsLoaded = useGameStore((s) => s.settings !== null);
  const bootstrap = useGameStore((s) => s.bootstrap);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  if (!settingsLoaded) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-900 text-neutral-400">
        Loading…
      </main>
    );
  }

  switch (screen) {
    case "themeSetup":
      return <ThemeSetupScreen />;
    case "playing":
      return <GameScreen />;
    default:
      return <TitleScreen />;
  }
}

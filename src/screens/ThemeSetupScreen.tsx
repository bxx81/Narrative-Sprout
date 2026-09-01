import { useState } from "react";
import { useGameStore } from "../store/gameStore";

export function ThemeSetupScreen() {
  const [theme, setTheme] = useState("");
  const generation = useGameStore((s) => s.generation);
  const startNewGame = useGameStore((s) => s.startNewGame);
  const goToTitle = useGameStore((s) => s.goToTitle);
  const running = generation.phase === "running";

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 bg-neutral-900 p-8 text-neutral-100">
      <h1 className="text-2xl font-bold">テーマ設定</h1>
      <textarea
        className="min-h-48 flex-1 rounded bg-neutral-800 p-4"
        placeholder="物語の世界観・テーマを入力…"
        value={theme}
        onChange={(e) => setTheme(e.target.value)}
        disabled={running}
      />
      {generation.phase === "failed" && (
        <p className="text-sm text-red-400">生成に失敗: {generation.error.message}</p>
      )}
      <div className="flex gap-3">
        <button
          className="rounded bg-neutral-700 px-4 py-2"
          onClick={() => void goToTitle()}
          disabled={running}
        >
          Back
        </button>
        <button
          className="rounded bg-emerald-600 px-6 py-2 disabled:opacity-40"
          disabled={!theme.trim() || running}
          onClick={() => void startNewGame(theme.trim())}
        >
          {running ? "Generating…" : "Start"}
        </button>
      </div>
    </main>
  );
}

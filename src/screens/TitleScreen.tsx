import { useState } from "react";
import { useGameStore } from "../store/gameStore";

export function TitleScreen() {
  const games = useGameStore((s) => s.games);
  const apiKey = useGameStore((s) => s.openrouterApiKey);
  const beginThemeSetup = useGameStore((s) => s.beginThemeSetup);
  const openGame = useGameStore((s) => s.openGame);
  const saveApiKey = useGameStore((s) => s.saveApiKey);
  const [draftKey, setDraftKey] = useState("");

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-8 bg-neutral-900 p-8 text-neutral-100">
      <h1 className="text-3xl font-bold">Narrative Sprout</h1>

      {!apiKey && (
        <section className="rounded border border-amber-600 p-4">
          <p className="mb-2 text-sm">
            Enter your OpenRouter API key. It is stored locally (IndexedDB `credentials`) only.
          </p>
          <div className="flex gap-2">
            <input
              type="password"
              value={draftKey}
              onChange={(e) => setDraftKey(e.target.value)}
              className="flex-1 rounded bg-neutral-800 p-2"
              placeholder="sk-or-..."
            />
            <button
              className="rounded bg-indigo-600 px-4 py-2 disabled:opacity-40"
              disabled={!draftKey}
              onClick={() => void saveApiKey(draftKey)}
            >
              Save
            </button>
          </div>
        </section>
      )}

      <button
        className="rounded bg-emerald-600 px-6 py-3 text-lg disabled:opacity-40"
        disabled={!apiKey}
        onClick={beginThemeSetup}
      >
        New Game
      </button>

      {games.length > 0 && (
        <section>
          <h2 className="mb-2 text-lg">Continue</h2>
          <ul className="space-y-2">
            {games.map((g) => (
              <li key={g.id}>
                <button
                  className="w-full rounded bg-neutral-800 p-3 text-left hover:bg-neutral-700"
                  onClick={() => void openGame(g.id)}
                >
                  <div className="truncate">{g.title}</div>
                  <div className="text-xs text-neutral-400">
                    {new Date(g.lastPlayedAt).toLocaleString()}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

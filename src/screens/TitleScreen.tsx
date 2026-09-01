import { useState } from "react";
import { useGameStore } from "../store/gameStore";
import { BackupSection } from "../components/BackupSection";
import type { GameRecord } from "../types";

function SaveListItem({ game }: { game: GameRecord }) {
  const openGame = useGameStore((s) => s.openGame);
  const exportSave = useGameStore((s) => s.exportSave);
  const deleteSave = useGameStore((s) => s.deleteSave);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  return (
    <li className="rounded bg-neutral-800 p-3">
      <div className="flex items-center justify-between gap-2">
        <button
          className="min-w-0 flex-1 text-left hover:text-indigo-300"
          onClick={() => void openGame(game.id)}
        >
          <div className="truncate">{game.title}</div>
          <div className="text-xs text-neutral-400">
            {new Date(game.lastPlayedAt).toLocaleString()}
          </div>
        </button>
        <div className="flex shrink-0 gap-1">
          <button
            className="rounded bg-neutral-700 px-2 py-1 text-xs hover:bg-neutral-600"
            onClick={() => void exportSave(game.id).catch(() => setActionError("Export failed."))}
          >
            Export
          </button>
          {confirmingDelete ? (
            <>
              <button
                className="rounded bg-red-700 px-2 py-1 text-xs hover:bg-red-600"
                onClick={() => {
                  setConfirmingDelete(false);
                  void deleteSave(game.id);
                }}
              >
                Confirm
              </button>
              <button
                className="rounded bg-neutral-700 px-2 py-1 text-xs hover:bg-neutral-600"
                onClick={() => setConfirmingDelete(false)}
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              className="rounded bg-neutral-700 px-2 py-1 text-xs hover:bg-red-800"
              onClick={() => setConfirmingDelete(true)}
            >
              Delete
            </button>
          )}
        </div>
      </div>
      {actionError && <p className="mt-1 text-xs text-red-400">{actionError}</p>}
    </li>
  );
}

export function TitleScreen() {
  const games = useGameStore((s) => s.games);
  const apiKey = useGameStore((s) => s.openrouterApiKey);
  const beginThemeSetup = useGameStore((s) => s.beginThemeSetup);
  const saveApiKey = useGameStore((s) => s.saveApiKey);
  const wipeAllData = useGameStore((s) => s.wipeAllData);
  const [draftKey, setDraftKey] = useState("");
  const [wipeOpen, setWipeOpen] = useState(false);
  const [wipeConfirmText, setWipeConfirmText] = useState("");

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
              <SaveListItem key={g.id} game={g} />
            ))}
          </ul>
        </section>
      )}

      <BackupSection />

      <section className="rounded border border-red-900/60 p-4">
        <h2 className="mb-1 text-sm font-semibold text-red-300">Danger zone</h2>
        <p className="mb-3 text-xs text-neutral-400">
          Deletes every save, setting, and API key stored in this browser. This cannot be undone.
        </p>
        {wipeOpen ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              className="flex-1 rounded bg-neutral-800 p-2 text-sm"
              placeholder='Type "DELETE" to confirm'
              value={wipeConfirmText}
              onChange={(e) => setWipeConfirmText(e.target.value)}
            />
            <button
              className="rounded bg-red-700 px-4 py-2 text-sm disabled:opacity-40"
              disabled={wipeConfirmText !== "DELETE"}
              onClick={() => void wipeAllData()}
            >
              Erase everything
            </button>
            <button
              className="rounded bg-neutral-700 px-4 py-2 text-sm hover:bg-neutral-600"
              onClick={() => {
                setWipeOpen(false);
                setWipeConfirmText("");
              }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            className="rounded border border-red-800 px-4 py-2 text-sm text-red-300 hover:bg-red-950"
            onClick={() => setWipeOpen(true)}
          >
            Delete all data…
          </button>
        )}
      </section>
    </main>
  );
}

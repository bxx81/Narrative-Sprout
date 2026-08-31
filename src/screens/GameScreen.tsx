import { useGameStore } from "../store/gameStore";

export function GameScreen() {
  const nodes = useGameStore((s) => s.nodes);
  const viewingNodeId = useGameStore((s) => s.viewingNodeId);
  const generation = useGameStore((s) => s.generation);
  const choose = useGameStore((s) => s.choose);
  const goToTitle = useGameStore((s) => s.goToTitle);

  const node = nodes.find((n) => n.id === viewingNodeId) ?? null;
  const running = generation.phase === "running";

  if (!node) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-900 text-neutral-100">
        <p>Scene not found.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 bg-neutral-900 p-8 text-neutral-100">
      <header className="flex items-center justify-between">
        <span className="text-sm text-neutral-400">Turn {node.turnNumber}</span>
        <button
          className="rounded bg-neutral-700 px-3 py-1 text-sm"
          onClick={() => void goToTitle()}
          disabled={running}
        >
          Title
        </button>
      </header>

      {node.choiceText && <p className="text-sm text-indigo-300">＞ {node.choiceText}</p>}

      <article className="whitespace-pre-wrap leading-relaxed">{node.scene.sceneText}</article>

      {node.scene.isStoryOver && node.scene.storyClosingText && (
        <article className="whitespace-pre-wrap leading-relaxed text-amber-200">
          {node.scene.storyClosingText}
        </article>
      )}

      {generation.phase === "failed" && (
        <p className="text-sm text-red-400">生成に失敗: {generation.error.message}</p>
      )}

      {!node.scene.isStoryOver && (
        <nav className="mt-auto flex flex-col gap-2">
          {node.scene.choices.map((choice) => (
            <button
              key={choice}
              className="rounded bg-neutral-800 p-3 text-left hover:bg-neutral-700 disabled:opacity-40"
              disabled={running}
              onClick={() => void choose(choice)}
            >
              {choice}
            </button>
          ))}
          {running && <p className="text-center text-sm text-neutral-400">Generating…</p>}
        </nav>
      )}
    </main>
  );
}

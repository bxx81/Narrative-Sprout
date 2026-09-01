import { useEffect, useMemo, useState } from "react";
import { useGameStore } from "../store/gameStore";

export function GameScreen() {
  const nodes = useGameStore((s) => s.nodes);
  const assets = useGameStore((s) => s.assets);
  const viewingNodeId = useGameStore((s) => s.viewingNodeId);
  const generation = useGameStore((s) => s.generation);
  const activeGame = useGameStore((s) => s.activeGame);
  const choose = useGameStore((s) => s.choose);
  const refine = useGameStore((s) => s.refine);
  const deleteBranch = useGameStore((s) => s.deleteBranch);
  const setViewingNode = useGameStore((s) => s.setViewingNode);
  const goToTitle = useGameStore((s) => s.goToTitle);

  const [refinePrompt, setRefinePrompt] = useState("");

  const node = nodes.find((n) => n.id === viewingNodeId) ?? null;
  const running = generation.phase === "running";
  const asset = viewingNodeId ? assets[viewingNodeId] : undefined;

  const imageUrl = useMemo(() => {
    if (!asset) return null;
    return URL.createObjectURL(asset.blob);
  }, [asset]);

  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  // Build breadcrumb path from root to viewing node
  const path = useMemo(() => {
    if (!node) return [];
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const result: typeof nodes = [];
    let cur: typeof node | undefined = node;
    while (cur) {
      result.push(cur);
      cur = cur.parentNodeId ? byId.get(cur.parentNodeId) : undefined;
    }
    return result.reverse();
  }, [node, nodes]);

  const children = useMemo(() => {
    if (!viewingNodeId) return [];
    return nodes.filter((n) => n.parentNodeId === viewingNodeId);
  }, [nodes, viewingNodeId]);

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
        <div className="flex gap-2">
          <button
            className="rounded bg-neutral-700 px-3 py-1 text-sm"
            onClick={() => void goToTitle()}
            disabled={running}
          >
            Title
          </button>
          <button
            className="rounded bg-red-800 px-3 py-1 text-sm disabled:opacity-40"
            onClick={() => {
              if (
                confirm("この分岐を削除しますか？（子分岐がない場合のみ親まで遡って削除されます）")
              )
                void deleteBranch(node.id);
            }}
            disabled={running || !activeGame}
          >
            Delete branch
          </button>
        </div>
      </header>

      {/* Breadcrumb / history navigation */}
      <nav className="flex flex-wrap gap-1 text-xs">
        {path.map((p, idx) => (
          <button
            key={p.id}
            className={`rounded px-2 py-1 ${p.id === viewingNodeId ? "bg-indigo-600 text-white" : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700"}`}
            onClick={() => setViewingNode(p.id)}
          >
            {idx === 0 ? "Root" : `T${p.turnNumber}`}
            {p.choiceText ? `:${p.choiceText.slice(0, 12)}` : ""}
          </button>
        ))}
      </nav>

      {children.length > 0 && (
        <section className="rounded border border-neutral-700 p-2">
          <p className="mb-1 text-xs text-neutral-400">
            この分岐から派生した選択肢 ({children.length})
          </p>
          <div className="flex flex-wrap gap-1">
            {children.map((c) => (
              <button
                key={c.id}
                className="rounded bg-neutral-800 px-2 py-1 text-xs hover:bg-neutral-700"
                onClick={() => setViewingNode(c.id)}
              >
                {c.choiceText?.slice(0, 20) ?? "(root)"} → T{c.turnNumber}
              </button>
            ))}
          </div>
        </section>
      )}

      {node.choiceText && <p className="text-sm text-indigo-300">＞ {node.choiceText}</p>}

      {imageUrl ? (
        <img src={imageUrl} alt="Scene illustration" className="w-full rounded object-cover" />
      ) : (
        <div className="flex h-48 items-center justify-center rounded bg-neutral-800 text-sm text-neutral-500">
          No image (generator disabled or pending)
        </div>
      )}

      <article className="whitespace-pre-wrap leading-relaxed">{node.scene.sceneText}</article>

      {node.scene.isStoryOver && node.scene.storyClosingText && (
        <article className="whitespace-pre-wrap leading-relaxed text-amber-200">
          {node.scene.storyClosingText}
        </article>
      )}

      {generation.phase === "failed" && (
        <p className="text-sm text-red-400">生成に失敗: {generation.error.message}</p>
      )}

      {/* Refine */}
      <section className="rounded border border-neutral-700 p-3">
        <h3 className="mb-2 text-sm font-semibold text-neutral-300">シーンを修正（リファイン）</h3>
        <p className="mb-2 text-xs text-neutral-500">
          このシーンを指示に従って再生成し、同じ親の下に sibling として追加します。
        </p>
        <textarea
          className="w-full rounded bg-neutral-800 p-2 text-sm"
          rows={2}
          placeholder="例: もっと緊迫感を出して、夜の設定にして"
          value={refinePrompt}
          onChange={(e) => setRefinePrompt(e.target.value)}
          disabled={running}
        />
        <button
          className="mt-2 rounded bg-indigo-600 px-4 py-1 text-sm disabled:opacity-40"
          disabled={running || !refinePrompt.trim()}
          onClick={() => {
            void refine(node.id, refinePrompt.trim());
            setRefinePrompt("");
          }}
        >
          Refine this scene
        </button>
      </section>

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

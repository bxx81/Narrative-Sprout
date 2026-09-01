import { useState } from "react";
import { useGameStore } from "../store/gameStore";

export function ThemeSetupScreen() {
  const [theme, setTheme] = useState("");
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const generation = useGameStore((s) => s.generation);
  const startNewGame = useGameStore((s) => s.startNewGame);
  const goToTitle = useGameStore((s) => s.goToTitle);
  const running = generation.phase === "running";

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    setAttachmentFiles((prev) => [...prev, ...Array.from(files)]);
  };

  const removeFile = (index: number) => {
    setAttachmentFiles((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 bg-neutral-900 p-8 text-neutral-100">
      <h1 className="text-2xl font-bold">テーマ設定</h1>
      <textarea
        className="min-h-32 rounded bg-neutral-800 p-4"
        placeholder="物語の世界観・テーマを入力…"
        value={theme}
        onChange={(e) => setTheme(e.target.value)}
        disabled={running}
      />
      <section className="rounded border border-neutral-700 p-4">
        <h2 className="mb-2 text-sm font-semibold text-neutral-300">
          添付ファイル（.txt / .md / .b64、YAML front matter対応）
        </h2>
        <p className="mb-2 text-xs text-neutral-500">
          先頭が <code>---</code> で始まるファイルはシナリオファイルとして扱われ、front matter の{" "}
          <code>theme</code> がテーマを上書きし、body が添付テキストになります。
          <br />
          <code>{"{a|b}"}</code> ランダム選択、<code>{"<flag:NAME>…</flag:NAME>"}</code>{" "}
          条件ブロックに対応。
        </p>
        <input
          type="file"
          multiple
          accept=".txt,.md,.b64"
          onChange={(e) => handleFiles(e.target.files)}
          disabled={running}
          className="mb-2 block w-full text-sm text-neutral-300 file:mr-4 file:rounded file:border-0 file:bg-neutral-700 file:px-3 file:py-1 file:text-sm file:text-neutral-100"
        />
        {attachmentFiles.length > 0 && (
          <ul className="space-y-1 text-sm">
            {attachmentFiles.map((f, i) => (
              <li
                key={`${f.name}-${i}`}
                className="flex items-center justify-between rounded bg-neutral-800 px-2 py-1"
              >
                <span className="truncate">
                  {f.name} ({(f.size / 1024).toFixed(1)} KB)
                </span>
                <button
                  className="ml-2 text-xs text-red-400"
                  onClick={() => removeFile(i)}
                  disabled={running}
                >
                  削除
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
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
          onClick={() => void startNewGame(theme.trim(), attachmentFiles)}
        >
          {running ? "Generating…" : "Start"}
        </button>
      </div>
    </main>
  );
}

# SESSION_HANDOFF — セッション引き継ぎノート

> 新しいセッションで作業を再開する人／エージェントへ。
> **設計の全知識は `REDESIGN.md`、開発ルールは `AGENTS.md` にある。まずその2つを読むこと。**
> このファイルは「今どこまで進んでいるか」の現在地だけを記録する。

## プロジェクトの位置づけ

- Narrative Sprout（AIビジュアルノベル）の **クリーンリビルド版**（v2）。
- 旧リポジトリは `narrative-sprout-legacy`（private 化・archive 済み）。ローカルでは `C:\AI\Narrative-Sprout-Legacy` に残る。
- 公開リポジトリ: https://github.com/bxx81/Narrative-Sprout
- 本番: https://narrative-sprout.pages.dev/ （Cloudflare Pages + GitHub 連携で自動デプロイ）
- 旧版レガシー確認用: narrative-sprout-legacy プロジェクトは削除済み…ではなくリネーム方針だったが、実際には削除→再作成で解決した（ユーザー作業）。

## 環境・運用（確定済み）

- Bun バージョンは **1.4.0** で `package.json#packageManager` / `.bun-version` / Pages の環境変数 `BUN_VERSION` の3箇所で固定。
- `.gitattributes` で LF 統一。改行コード差分は出ないはず。
- branch 戦略: `main` は常にデプロイ可能。作業は `feature/*` ブランチ → PR → squash merge。PR を作ると Cloudflare のプレビュー URL が自動発行される。
- CI: lint + tsc + bun test + prettier + gitleaks（バイナリ直接実行）。全ジョブグリーンが merge 条件。
- コミット・push・PR 作成・マージ等の git 操作は毎回ユーザーの明示的な承認を得ること。

## 進捗（REDESIGN.md §9 のフェーズ計画に対応）

| Phase | 状態                    | 内容                                                                                                                                                      |
| ----- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | ✅ 完了                 | 骨組み・CI・gitleaks・AGENTS.md・LICENSE（MIT）。PR #1 一部含む                                                                                           |
| 1     | ✅ 完了（PR #1 merged） | `src/types/*`（Zod→型導出、新命名）と `src/db/`（Dexie 5 ストア、schemaVersion=1 + 空移行チェーン + 将来バージョン非破壊拒否）                            |
| 2     | ✅ 完了（PR #2 merged） | ゲームループ最小構成：テーマ入力 → 生成 → 選択肢 → 永続化 → 再開。システムプロンプトは旧版から全文移植済み                                                |
| 3     | 🔜 **次はここ**         | 画像生成（HF Spaces / A1111 / ComfyUI、WebP 変換・保存、assets ストア）＋ メモリ強化（split / compaction）＋ 添付（YAML front matter、§4.4）＋ リファイン |
| 4     | 未着手                  | 複数セーブ管理、ZIP エクスポート（新形式 manifest.json + nodes + assets）、データ全消去                                                                   |
| 5     | 未着手                  | 暗号化バックアップ（AES-GCM、§3.3）+ Google Drive                                                                                                         |
| 6     | 未着手                  | i18n（5言語 + AI 動的翻訳）、オートプレイ、ストリーミング、PWA 完成度上げ                                                                                 |
| 7     | 未着手                  | Tauri 版（`src-tauri` 専用ブランチ、stronghold 導入、dist は全ブランチ ignore 済み）                                                                      |

## Phase 2 の実機確認方法（自分で試すには）

1. 本番 URL を開く → OpenRouter API キーを入力して Save（`credentials` ストアにのみ保存される）。
2. New Game → テーマを入れて Start → 導入シーンが生成される。
3. 3 択を選ぶと次ターン生成。タイトルに戻って Continue から再開できる。

既知の制約（あえて未実装）: 画像表示なし、添付なし、巻き戻し UI なし、言語は settings のデフォルト固定（Japanese）。

## 実装の設計上の要点（再訪時の注意）

- `SceneContent` / `MemoryState` / `MemoryDelta` の関係：`memory` は累積、`memoryDelta` は当該ターンのみ。`scene` は表示専用（メモリを含まない、旧版と違う点）。
- `promptSent` は LLM に投げたユーザーメッセージの生文字列。履歴再構築（最大5ターン、新しい順→古い順に reverse）に必須。**削除禁止**（REDESIGN §5.2 に理由記載）。
- 画像はまだ未生成。Phase 3 で `assets` ストア（nodeId 1:1 キー）に入れる際、node 削除と asset 削除は同一トランザクションで行うこと（`AGENTS.md` のルール7）。
- Zustand: `set` はコンポーネントから直接呼ばず、`gameStore.ts`内の action 関数のみ。
- すでに作った主要ファイル（再読込時の地図）：
  - `src/db/database.ts` / `migrations.ts` / `gameRepository.ts` / `settingsRepository.ts` / `credentialsRepository.ts`
  - `src/features/narrative/{systemPrompt,sceneSchema,promptBuilder,generateScene,memoryMerge}.ts`
  - `src/features/gameplay/turnService.ts`、`src/features/storytree/treeTraversal.ts`
  - `src/store/gameStore.ts` / `asyncOperation.ts`
  - `src/screens/{TitleScreen,ThemeSetupScreen,GameScreen}.tsx`

## セッション再開手順（このファイルを閉じる前に）

1. `git checkout main && git pull`
2. `REDESIGN.md` と `AGENTS.md` を再読
3. Phase 3 の作業ブランチを切る（例: `feature/phase3-image-and-attachments`）
4. 着手

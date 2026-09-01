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
| 3     | 🚧 実装中（PR #5）      | 画像生成（HF Spaces / A1111 / ComfyUI、WebP 変換・保存、assets ストア）＋ メモリ強化（split / compaction）＋ 添付（YAML front matter、§4.4）＋ リファイン |
| 3.1   | 🔴 レビュー対応中       | PR #5 レビュー Must fix #1 (deleteBranch孤児化) / #2 (テスト重複) / Should #3 (attachmentTexts .default) / #4 (GC Blobロード) を対応中                    |
| 4     | 未着手                  | 複数セーブ管理、ZIP エクスポート（新形式 manifest.json + nodes + assets）、データ全消去                                                                   |
| 5     | 未着手                  | 暗号化バックアップ（AES-GCM、§3.3）+ Google Drive                                                                                                         |
| 6     | 未着手                  | i18n（5言語 + AI 動的翻訳）、オートプレイ、ストリーミング、PWA 完成度上げ                                                                                 |
| 7     | 未着手                  | Tauri 版（`src-tauri` 専用ブランチ、stronghold 導入、dist は全ブランチ ignore 済み）                                                                      |

## Phase 2 の実機確認方法（自分で試すには）

1. 本番 URL を開く → OpenRouter API キーを入力して Save（`credentials` ストアにのみ保存される）。
2. New Game → テーマを入れて Start → 導入シーンが生成される。
3. 3 択を選ぶと次ターン生成。タイトルに戻って Continue から再開できる。

既知の制約（Phase 3で解消済み/残存）: 画像生成は 4プロバイダ対応（HF/A1111/ComfyUI/NIM、無効時はフォールバックSVG）、添付は YAML front matter + {a|b} + 条件分岐対応、巻き戻しは breadcrumb + 子分岐一覧 + Delete branch（孤児化バグを #1 で修正）、リファインは sibling分岐で動作。言語は settings のデフォルト固定（Japanese）のまま。

## 実装の設計上の要点（再訪時の注意）

- `SceneContent` / `MemoryState` / `MemoryDelta` の関係：`memory` は累積、`memoryDelta` は当該ターンのみ。`scene` は表示専用（メモリを含まない、旧版と違う点）。
- `promptSent` は LLM に投げたユーザーメッセージの生文字列。履歴再構築（最大5ターン、新しい順→古い順に reverse）に必須。**削除禁止**（REDESIGN §5.2 に理由記載）。Phase 3で `startGame` の `promptSent` は添付を含めないよう修正（添付は毎ターン prefix として再注入）。
- 画像は `assets` ストア（nodeId 1:1 キー）で WebP 変換して保存。ノード削除と asset 削除は同一トランザクションで行うこと（`AGENTS.md` のルール7）。GC は `primaryKeys()` のみで実行（Blobをロードしない）。
- 分岐削除は `collectNodesToDelete` (`src/features/storytree/branchDeletion.ts`) でサブツリー + 上方向の孤児化チェックを純粋関数化。`gameRepository.deleteBranch` はそれを利用し、テストは実コードを直接テストする。
- `GameRecord.attachmentTexts` は per-game の世界設定（`GameRecord` に保持、settings ではない）。Zod では要素単位で検証し、`.default()` は使わない（`AGENTS.md` ルール4）。
- Zustand: `set` はコンポーネントから直接呼ばず、`gameStore.ts`内の action 関数のみ。`buildImageGenConfig` などは `api.ts` 経由で import。
- すでに作った主要ファイル（再読込時の地図）：
  - `src/db/{database,gameRepository,assetRepository,settingsRepository,credentialsRepository}.ts` / `migrations.ts`
  - `src/features/narrative/{systemPrompt,sceneSchema,promptBuilder,generateScene,memoryMerge,resolveMemoryStrategy,api}.ts`
  - `src/features/attachments/{parseScenarioFile,conditionalText,randomChoice,attachmentProcessor,api}.ts`
  - `src/features/image/{types,generateImage,assetHelpers,buildImageGenConfig,imageGeneratorFactory,api}/generators/*`
  - `src/features/memory/{storyLogCompaction,api}.ts` / `src/features/storytree/{treeTraversal,branchDeletion,api}.ts`
  - `src/features/gameplay/turnService.ts`
  - `src/store/gameStore.ts` / `asyncOperation.ts`
  - `src/screens/{TitleScreen,ThemeSetupScreen,GameScreen}.tsx` / `src/lib/imageConversion.ts`

## セッション再開手順（このファイルを閉じる前に）

1. `git checkout main && git pull`
2. `REDESIGN.md` と `AGENTS.md` を再読
3. Phase 3 の作業ブランチを切る（例: `feature/phase3-image-and-attachments`）
4. 着手

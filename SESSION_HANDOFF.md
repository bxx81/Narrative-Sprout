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
| 3     | ✅ 完了（PR #5 merged） | 画像生成（HF Spaces / A1111 / ComfyUI / NIM、WebP 変換・保存、assets ストア）＋ メモリ強化（split / compaction）＋ 添付（YAML front matter、§4.4）＋ リファイン |
| 3.1   | ✅ 完了                 | PR #5 レビュー指摘（deleteBranch 孤児化 / テスト重複 / attachmentTexts .default / GC Blob ロード）はマージ時に対応済み                                            |
| 4     | ✅ 完了（PR #6 merged、#7 で履歴ワイヤ形式修正） | セーブ管理（一覧は既存・削除追加）、ZIP エクスポート（新形式 `ns-save`: manifest.json + nodes/*.json + assets/<nodeId>.<ext>）、データ全消去                     |
| 5     | ✅ 完了（PR #8 merged）  | 暗号化バックアップ（AES-GCM、§3.3、`ns-backup`/`.nsbak`）+ Google Drive（`drive.file` スコープ + `NarrativeSproutBackup` フォルダ）+ ns-save インポート。完了条件「平文が外部に出ないことをテストで証明」は `plaintextLeak.test.ts` で達成 |
| 5.5   | 🚧 実装完了・未コミット  | UI 移植：Legacy から全画面を移植（react-router 導入、Tailwind テーマ/ボタン体系、Load/History/Chronicle/Settings/Starting/DeletionComplete、ゲーム画面 2 ペイン + nav + overlay、画像再生成 action）。i18n は未導入で文言は英語ハードコード |
| 6     | 未着手                  | i18n（5言語 + AI 動的翻訳）、オートプレイ、ストリーミング、PWA 完成度上げ                                                                 |
| 7     | 未着手                  | Tauri 版（`src-tauri` 専用ブランチ、stronghold 導入、dist は全ブランチ ignore 済み）                                                                      |

## Phase 2 の実機確認方法（自分で試すには）

1. 本番 URL を開く → OpenRouter API キーを入力して Save（`credentials` ストアにのみ保存される）。
2. New Game → テーマを入れて Start → 導入シーンが生成される。
3. 3 択を選ぶと次ターン生成。タイトルに戻って Continue から再開できる。

既知の制約（Phase 5.5 UI 移植後）: 画像生成は 4プロバイダ対応（HF/A1111/ComfyUI/NIM、無効時はフォールバックSVG）。UI は Legacy 見た目を移植済み（タイトル/テーマ設定/生成待ち/ゲーム/ロード/ヒストリー/クロニクル/設定/削除完了）。言語は settings のデフォルト固定（Japanese）のまま（i18n は Phase 6）。Drive を使うには `VITE_GOOGLE_CLIENT_ID` の設定と Google Cloud 側の OAuth 設定が必要（README > Google Drive setup）。未移植の Legacy 機能: 本文手動編集・オートプレイ・ストリーミング・テーマ自動生成（Generate Idea）・OpenRouter PKCE 取得（Phase 6 以降で対応）。

## Phase 5.5（UI 移植）の要点

- **ルーティング**: `react-router`（BrowserRouter + Routes）を導入。`src/app/routes.ts` に ROUTES 定数。Zustand の `screen` state は廃止（遷移はコンポーネントが `useNavigate` で行い、store はデータのみ）。`/play` `/history` `/chronicle` は `RequireActiveGame` ガードで activeGame が無ければ `/` へリダイレクト。
- **スタイル基盤**: Legacy の `index.css`（`@theme` トークン + `form-style`/`choice-style`/`h2-style` 等の共通クラス、`.dark` 変数上書き、OS ダークモード連動）と `Button` intent×size 体系（CSS Module、`@reference "../../index.css"` 相対パスで注意）を移植。フォント/Material アイコン/タイトル背景画像は `public/s/` と `public/images/` に実物コピー（`.prettierignore` に `public/` 追加済み）。
- **共通部品**: `src/components/ui/{Button,Icon,BackButton,LoadingSpinner,Expander,SettingsSection,ToggleSwitch,MainText,Divider,HelpTooltip}`、`src/components/{StoryCard,AttachmentPreview,BackupSection}`、確認ダイアログは `ConfirmationProvider` + `useConfirm()`（Promise ベース、native `<dialog>`）。
- **新スクリーン**: `src/screens/{LoadScreen,HistoryScreen,ChronicleScreen,SettingsScreen,StartingScreen,CompletedDataDeletionScreen}.tsx`。ゲーム画面は Legacy の 2 ペイン（PC）/縦積み（モバイル）+ `GameNavButtons`（←/→/画像再生成/メニュー）+ `LoadingOverlay`/`ZoomOverlay`/`RefineDialog`（リファインはメニューのダイアログに配置）。
- **store 変更** (`gameStore.ts`): `screen`/`beginThemeSetup` 削除。追加: `updateSettings(partial)`（グローバル settings への唯一の書き込み経路）、`saveCredential(key, value)`、`regenerateImage(nodeId)`（同キー上書き、AsyncOperation で管理、a1111/comfyui は進捗 % 表示）、`chronicleTargetNodeId` + `setChronicleTargetNode`、`deleteBranch` が `{ gameDeleted }` を返すよう変更。画像生成トークン（HF/NIM）は bootstrap でメモリにロード。
- **シーンナビの修正（実機確認で発見）**: (1) 語数表示 — `countWords` が改行あり日本語で「段落数」を返すバグ（`generateScene.ts`、CJK 比率判定に修正。表示は GameScreen で sceneText から再計算し既存セーブも正しく見える）。(2) Forward ボタン常時無効 — `useGameNavigation` がパスを表示ノードから構築しており `indexOf(viewing)` が常に末尾になるバグ（Legacy 同様、末端=プレイヘッドから構築するよう修正）。併せて Legacy の `currentNodeId`（プレイヘッド、Forward の目的地）を store に `currentNodeId` として復活（セッションのみ・非永続化）。History/Chronicle の Resume Here は `resumeStoryAtNode(nodeId, branchEndNodeId)` で表示位置とプレイヘッドをセットする（Legacy `onRewind(gameLog, endId, node.id)` 相当）。回帰テスト: `src/store/gameStore.test.ts`（store フロー）+ `src/hooks/useGameNavigation.test.tsx`（happy-dom 実レンダリング、Resume Here/プレイヘッド不一致/Chronicle 中間の3シナリオ）。
- **配置の決定事項**: Backup & Restore セクション（Phase 5 実装）はタイトル画面から **設定 > Data Management** へ移動（Legacy 準拠。戻す場合は TitleScreen に `<BackupSection />` を戻すだけ）。セーブのエクスポートは LoadScreen のカードから HistoryScreen の「Download Save Data」ボタンへ。wipe は Settings > Delete All Data（confirm 後、`sessionStorage` フラグ + リロードで DeletionComplete 画面を表示）。
- **意図的に未実装**（Phase 6 以降）: react-hot-toast 未導入（インライン表示で代用）、AI 翻訳/言語セレクタ、ストリーミング、オートプレイ、本文編集（store に該当 action なし）、開発者オプション。

## 実装の設計上の要点（再訪時の注意）

- `SceneContent` / `MemoryState` / `MemoryDelta` の関係：`memory` は累積、`memoryDelta` は当該ターンのみ。`scene` は表示専用（メモリを含まない、旧版と違う点）。
- `promptSent` は LLM に投げたユーザーメッセージの生文字列。履歴再構築（最大5ターン、新しい順→古い順に reverse）に必須。**削除禁止**（REDESIGN §5.2 に理由記載）。Phase 3で `startGame` の `promptSent` は添付を含めないよう修正（添付は毎ターン prefix として再注入）。
- **履歴再生は必ずワイヤ形式に**：`buildTurnPrompt` の assistant 履歴と refine の `originalSceneJson` は `sceneToWireResponse` (`sceneSchema.ts`) で保存形式→ワイヤ形式（`choices`配列→`choice1..3` 等）に変換してから JSON 化する。保存形式のまま流すと、json_schema を厳密強制しないプロバイダでモデルが保存形式を模倣し、次ターンのバリデーションが失敗する（legacy `stored2work` 相当。Phase 4 後の実機テストで発覚・修正）。split 戦略のシーン呼び出しでは `omitMemoryFields: true` も渡す。
- 画像は `assets` ストア（nodeId 1:1 キー）で WebP 変換して保存。ノード削除と asset 削除は同一トランザクションで行うこと（`AGENTS.md` のルール7）。GC は `primaryKeys()` のみで実行（Blobをロードしない）。
- 分岐削除は `collectNodesToDelete` (`src/features/storytree/branchDeletion.ts`) でサブツリー + 上方向の孤児化チェックを純粋関数化。`gameRepository.deleteBranch` はそれを利用し、テストは実コードを直接テストする。
- `GameRecord.attachmentTexts` は per-game の世界設定（`GameRecord` に保持、settings ではない）。Zod では要素単位で検証し、`.default()` は使わない（`AGENTS.md` ルール4）。
- Zustand: `set` はコンポーネントから直接呼ばず、`gameStore.ts`内の action 関数のみ。`buildImageGenConfig` などは `api.ts` 経由で import。
- Phase 4 の要点: エクスポートは `features/export/`（`buildExportBundle` 純粋関数 + fflate ZIP、assets は level 0 で格納、拡張子は `imageFileExtensions` から導出）。manifest は `NSaveManifest`（format `ns-save` / version 1）。export 経路は GameRecord/StoryNodeRecord/AssetRecord のみを受け、credentials に構造的に到達しない（AGENTS ルール3）。ワイプは `db/wipeRepository.wipeAllUserData()` が `db.delete()` で DB ごと削除（settings/credentials 含む工場出荷状態）→ localStorage/sessionStorage クリア → reload。
- Phase 5 の要点:
  - 暗号化は `lib/crypto.ts`（WebCrypto のみ、PBKDF2-SHA256 600k → AES-GCM 256、`encryptWithPassphrase`/`decryptWithPassphrase` のワンショット API）。エンベロープは `features/backup/types.ts` の `nsBackupEnvelopeSchema`（format `ns-backup` / version 1、§3.3 の JSON 形そのもの）。version が未来のものは復元拒否（非破壊ポリシー）。
  - payload は暗号化される前の ZIP（`games/*.json` + `nodes/*.json` + `assets/<nodeId>.<ext>` + `assets.json`（mimeType/updatedAt の索引）+ `settings.json`）。credentials は構造的に到達不能（`createBackup.ts` が credentialsRepository を import しない）。
  - 復元は `restoreRepository.upsertRestoredData()` で id 単位 upsert（既存データは削除しないマージ）。要素単位 safeParse で不正ノード/asset はスキップ + 警告。孤立する node/asset（親 game がない等）もスキップ。
  - Google 認証は `googleAuth.ts`（GIS token client を動的ロード、gapi-script 不使用、API キー不要）。**アクセストークンはメモリのみで永続化しない**（リロードで再接続）。Drive REST は `driveClient.ts`（fetch + Bearer、`fetchImpl` を注入してテスト）。401 は `DriveUnauthorizedError` になり、store アクションがトークンをクリアする。
  - UI は `components/BackupSection.tsx`（タイトル画面に組み込み）。store アクションは gameStore に追加（`downloadEncryptedBackup` / `restoreBackupFromFile` / `importSaveFromFile` / `connectGoogleDrive` ほか）。`import.meta.env.VITE_GOOGLE_CLIENT_ID` は新規 VITE_ 変数なので AGENTS の規約どおり PR レビュー対象。
  - テストの要は `plaintextLeak.test.ts`（Phase 5 完了条件）： ローカルダウンロードと Drive アップロード両方の境界で、エンベロープ本文 + base64 デコード後のバイト列に平文（タイトル・本文・promptSent・メモ・設定値）とクレデンシャルが含まれないことを検証する。テスト用レコードファクトリは `features/backup/testsupport/records.ts` に共通化（Phase 3.1 のテスト重複指摘の教訓）。
- `bunfig.toml` の `[test] preload` で `src/db/installFakeIndexedDb.ts` を読み込んでいる（Dexie はモジュール評価時に indexedDB を捕捉するため、テストは fake-indexeddb で実DB相当のテストが可能）。`db.delete()` 後は `db.transaction()` が自動再オープンしない点に注意（テスト内では明示 `db.open()`）。
- すでに作った主要ファイル（再読込時の地図）：
  - `src/db/{database,gameRepository,assetRepository,settingsRepository,credentialsRepository}.ts` / `migrations.ts`
  - `src/features/narrative/{systemPrompt,sceneSchema,promptBuilder,generateScene,memoryMerge,resolveMemoryStrategy,api}.ts`
  - `src/features/attachments/{parseScenarioFile,conditionalText,randomChoice,attachmentProcessor,api}.ts`
  - `src/features/image/{types,generateImage,assetHelpers,buildImageGenConfig,imageGeneratorFactory,api}/generators/*`
  - `src/features/memory/{storyLogCompaction,api}.ts` / `src/features/storytree/{treeTraversal,branchDeletion,api}.ts`
  - `src/features/gameplay/turnService.ts`
  - `src/features/export/{types,exportBundle,zipArchive,exportGame,download,api}.ts`
  - `src/features/backup/{types,backupPayload,envelope,createBackup,restoreBackup,importSave,googleAuth,driveClient,driveBackup,api}.ts` / `testsupport/records.ts` / `restoreErrors.test.ts` ほかテスト
  - `src/components/BackupSection.tsx`
  - `src/db/wipeRepository.ts` / `src/db/restoreRepository.ts` / `src/db/installFakeIndexedDb.ts` / `bunfig.toml`
  - `src/lib/crypto.ts` / `src/lib/imageFileExtensions.ts`（`getImageMimeTypeFromExtension` / `isKnownImageMimeType` を追加）
  - `src/store/gameStore.ts` / `asyncOperation.ts`
  - `src/screens/{TitleScreen,ThemeSetupScreen,GameScreen}.tsx` / `src/lib/imageConversion.ts`
  - UI 移植 (Phase 5.5): `src/app/{App.tsx,routes.ts,ConfirmationProvider.tsx}` / `src/screens/{LoadScreen,HistoryScreen,ChronicleScreen,SettingsScreen,StartingScreen,CompletedDataDeletionScreen}.tsx` / `src/components/ui/*` / `src/components/{StoryCard,AttachmentPreview,BackupSection}.tsx` / `src/components/game/*` / `src/components/settings/*` / `src/hooks/{useDebouncedExternalState,useBreakpoint,useLazyNodeImage,useNode,useFullscreen,useGameNavigation,useConfirm}.ts` / `public/{s,images,icons}`

## セッション再開手順（このファイルを閉じる前に）

1. `git checkout main && git pull`
2. `REDESIGN.md` と `AGENTS.md` を再読
3. 次のフェーズの作業ブランチを切る（例: `feature/phase6-i18n-autoplay-streaming`）
4. 着手

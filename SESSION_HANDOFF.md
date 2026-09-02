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
| 5.5   | ✅ 完了（PR #9 merged）  | UI 移植：Legacy から全画面を移植（react-router 導入、Tailwind テーマ/ボタン体系、Load/History/Chronicle/Settings/Starting/DeletionComplete、ゲーム画面 2 ペイン + nav + overlay、画像再生成 action） |
| 6     | ✅ 完了（PR #10 merged） | i18n（5言語バンドル + AI 動的翻訳 + 言語セレクタ）、オートプレイ（reasoning チェーン永続化）、SSE ストリーミング（live 本文表示 + per-model opt-out）、PWA 修正（SW registration + manifest アイコン）。実機確認済み（言語切替・翻訳・ストリーミング・オートプレイ動作）。UI 差分（Legacy との見た目の違い）は後に回す判断 |
| 6.5   | ✅ 完了（PR #11 merged） | モデル文字列オプション完全対応（`--BaseURL` で NIM 等のカスタムエンドポイント接続を実機確認済み）+ OpenRouter PKCE キー自動取得（credentials ストアへの保存を実機確認済み） |
| 6.6   | ✅ 完了（PR #12 merged） | react-hot-toast 導入（バックアップ/Drive/PKCE/インポート/エクスポート/AI翻訳の通知）、グローバルエラーダイアログ（ErrorDialog + errorClassification）、生成失敗のリトライ（payload 保持 + retryGeneration/dismissError）、429 自動リトライ設定。実機確認済み（各種トースト・リトライ成功）。hooks 順序違反クラッシュと翻訳トースト再発火は実装中に発見・修正済み |
| 7     | 未着手（PWA 版完成後に着手の方針） | Tauri 版（`src-tauri` 専用ブランチ、stronghold 導入、dist は全ブランチ ignore 済み）                                                                      |

## Phase 2 の実機確認方法（自分で試すには）

1. 本番 URL を開く → OpenRouter API キーを入力して Save（`credentials` ストアにのみ保存される）。
2. New Game → テーマを入れて Start → 導入シーンが生成される。
3. 3 択を選ぶと次ターン生成。タイトルに戻って Continue から再開できる。

既知の制約（Phase 6 実装後）: 画像生成は 4プロバイダ対応（HF/A1111/ComfyUI/NIM、無効時はフォールバックSVG）。UI は Legacy 見た目を移植済み。UI 言語は Settings > Language で選択可能（5言語 + AI翻訳）。物語本文の言語は `settings.language`（プロンプトに注入）。未移植の Legacy 機能: 本文手動編集・テーマ自動生成（Generate Idea）。

## Phase 6.5（モデル詳細設定 + PKCE、PR #11）の要点

- **モデルオプション完全対応** (`src/lib/modelOptions.ts` 書き直し): Legacy modelutils.ts の全オプションを移植 — `--BaseURL`（http/https 検証）、`--reasoning`（true/false/effort レベル）、`--reasoning_effort`、`--temperature`、`--top_p`、`--top_k`、`--frequency_penalty`、`--presence_penalty`、`--repetition_penalty`、`--min_p`、`--top_a`、`--max_tokens`、`--timeout`、`--kwargs_reasoning`、`--only`、`--strict`、`--stream`。`isValid` フラグで無効オプション検出。`buildSamplingParams` が legacy `getParams` 相当のリクエストボディ生成（max_tokens → max_completion_tokens、reasoning → {effort}、kwargs_reasoning → chat_template_kwargs、only → provider.only）。
- **配線** (`generateScene.ts` の `callChatCompletion`): 全ナラティブ呼び出し（start/choice/refine/split/compaction）で `parseTextModelOptions` を解釈し、baseUrl・タイムアウト（`AbortSignal.any([signal, timeout])`）・サンプリングを適用。`--strict=false` 時は `json_object` レスポンス形式にフォールバックし、スキーマを system プロンプトに埋め込み。`autoplayService.ts` / `translateService.ts` も同様に配線。response_format ビルダー（`buildNarratorResponseFormat` 等4種）は未使用になったため削除し、schema は `callChatCompletion` 内で `responseSchema` + `responseSchemaName` として渡す設計に変更。
- **OpenRouter アプリヘッダー** (`lib/openAiClient.ts`): `OPENROUTER_APP_HEADERS`（HTTP-Referer / X-OpenRouter-Title / X-OpenRouter-Categories）をデフォルト baseUrl のときのみ送信（custom --BaseURL では送らない。legacy 挙動）。
- **OpenRouter PKCE** (`src/features/openrouter/pkceAuth.ts`): `startPkceAuth`（UUID state + verifier×2 → S256 challenge → `https://openrouter.ai/auth?...` へリダイレクト）、`exchangeCodeForApiKey`（15s ハードタイムアウト、verifier を即時削除して重複交換防止、`fetchImpl` 注入でテスト可）、`consumePkceCallback`（state 一致チェック = CSRF 防御、不一致時は null + console.error）、`stripPkceCallbackFromUrl`（replaceState でリロード再生防止）。localStorage キーは `nsOAuthState` / `nsOAuthCodeVerifier`。Settings に "Automatic API Key Setup" セクション新設、マウント時に 1 回だけ（useRef ガード）コールバック処理 → `saveApiKey` → 成功/失敗ステータス表示。
- **Settings UI 強化**: モデル入力の検証を `parseTextModelOptions().isValid` ベースに変更（無効オプションは赤字 + `invalidModelOption`）、オプション構文ヘルプ（`modelOptionsHelp`）追記、API キー接頭辞警告（`apiKeyPrefixMismatchWarning`、OpenRouter baseUrl のとき `sk-or-` 以外なら表示。legacy `apiKeyValidation` の soft 版）。
- **テスト**: `modelOptions.test.ts` 10 cases（パース/バリデーション/sampling params マップ/ストリーミング判定）、`pkceAuth.test.ts` 7 cases（URL 構築・交換成功/verifier 欠損/HTTP エラー・state 一致/CSRF 拒否）。全 184 テストグリーン。
- **意図的に未実装**（後続フェーズ）: テーマ自動生成（Generate Idea）、本文手動編集、開発者オプション。

## Phase 6.6（トースト / エラーダイアログ / リトライ、PR #12）の要点

- **トースト**: `react-hot-toast` 2.6.0 を導入（Legacy と同バージョン）。`App.tsx` で `<Toaster position="top-center">`（Legacy 同様の白カード 12px スタイル、auto-close）。インライン表示を置き換え: BackupSection の `runOperation`（成功/失敗→toast）、PKCE 成功/失敗、AI 翻訳失敗（`uiTranslation.phase === "failed"` を effect で監視→`aiTranslationError`）、LoadScreen のセーブインポート結果（`toastLoadSavedataSuccess` 等）、HistoryScreen のエクスポート結果（`toastDownloadSavedataSuccess`）。
- **エラーダイアログ** (`src/components/ErrorDialog.tsx`): Legacy ErrorDisplay（modal variant）の移植。AppLayout にグローバルマウントされ、`generation` / `imageRegeneration` の `failed` phase で表示。分類は `src/lib/errorClassification.ts`（`classifyError`）: ApiError 429→`errorApiOverloaded`（retryable）、401/402/403→非 retryable、AbortError→`errorAborted`（onlyInformation、Dismiss のみ）、TimeoutError→`errorApiGeneric`、それ以外→メッセージ保持+retryable。タイトルは retryable→`errorStumbleTitle` / 非retryable→`errorOccurredTitle`。7行超メッセージは `errorShowMore/Less` でクランプ。429 + `settings.autoRetrySeconds > 0` でカウントダウン表示→自動リトライ（`errorAutoRetry`、秒数は Settings > Story Log Compaction セクション内の新セレクト `autoRetryIntervalLabel`、0=Never）。Dismiss は start 失敗時のみ `/setup` へ遷移（Legacy の Starting status 扱い相当）。
- **リトライ**: `gameStore.ts` の `GenerationPayload` を discriminated union に拡張（start: theme+attachmentFiles / choice: choiceText+autoplayReasoning+autoplayCost / refine: nodeId+refinePrompt）し、failed phase に保持（Legacy `lastActionForRetry` 相当）。`retryGeneration()` が payload 種別で `startNewGame` / `choose` / `refine` / `regenerateImage` を再実行。`dismissError()` で failed→idle。StartingScreen の独自失敗表示は削除（グローバルダイアログに一本化）。GameScreen のインライン失敗テキストも削除。
- **テスト**: `lib/errorClassification.test.ts` 6 cases、`gameStore.test.ts` にリトライ 2 cases（不正 textModel でネットワークなしに同期的失敗→payload 保持確認→retry 再実行→dismiss で idle）。全 192 テストグリーン。

## Phase 6（i18n / オートプレイ / ストリーミング / PWA）の要点

- **i18n 基盤** (`src/features/i18n/`): i18next + react-i18next（依存は既存）。5言語（en/ja/zh/zh-tw/ko）は `locales/*.json` をビルド時にバンドル（Legacy の http-backend は不使用 → PWA precache に入りオフラインでも動く）。`config.ts` で init、`index.ts` に `getLanguageCode` / `getInitialUiLanguage`（zh-tw を zh より先に判定する Legacy バグ修正済み）/ `applyLanguageDocumentEffects`（html lang + RTL dir + 言語別フォント CSS 読み込み）。全画面・主要コンポーネントの文言を `t()` 化。言語は native 表示名（"English" / "日本語"…）で settings に保存し、コードが必要な場所のみ `getLanguageCode` で変換。
- **AI 動的翻訳** (`translateService.ts`): 英語 UI 文言（`englishUiTexts`）を 30キーずつ順次チャンクで翻訳（500ms ポリテネス遅延、進捗 0..1 通知）。言語タグ検出は built-in チェック → 30言語テーブル → LLM 呼び出し（正規検証、失敗時は言語名をそのままキー使用）。結果は settings の `aiTranslations`（言語名→バンドル）/ `aiLanguageMappings`（言語名→IETFタグ）に永続化。削除も可（表示中の AI 言語を削除したら English に戻る）。Settings に Language セクション新設（ビルトインは AI オーバーライドで非表示、AI 言語は optgroup に "(AI)" 付き表示）。
- **オートプレイ** (`src/features/autoplay/`): Legacy computerPlayerService を翻訳。`buildAutoplayLog`（純粋関数）が表示ノードから親を辿りテーマ＋全シーン＋選択＋reasoning チェーンを 1 テキストにコンパイル → `decideAutoplayTurn` がプレイヤー AI に次の行動を問う（json_schema strict、非ストリーミング）。store は `autoplay` フラグ + `runAutoplayTurn` + `toggleAutoplay`。ガード設計は Legacy 準拠: (1) GameScreen の effect が `autoplay && idle` で駆動、(2) `choose` に渡す `autoplayReasoning`（= capability token）が chaining 中の再入を許可し、手動クリックは拒否、(3) autoplay OFF 切替中の in-flight 決定は破棄、(4) 終端検出（isStoryOver）で回顧コメントをダイアログ表示して停止、(5) 失敗時は autoplay 解除。reasoning は `nodeMetadata.autoplayReasoning` に永続化（optional、旧セーブもパース可）され、次回のログ再構築で木から再導出される。決定呼び出しのコストは当該ターンの総コストに加算。resume/deleteBranch/openGame/goToTitle で autoplay を解除（Legacy REWIND 相当）。
- **ストリーミング**: `lib/openAiClient.ts` に `createStreamingChatCompletion` を追加（`stream: true` + `stream_options.include_usage`、手書き SSE パーサ（CRLF 正規化・`data:` 抽出・[DONE]・mid-stream error・reasoning 分離）、本文受信開始後のみ 60s idle タイムアウト、最後に通常形 response を組んで下流のパースを共通化）。`generateScene.ts` の `callChatCompletion` が `onDelta` 指定時にストリーミングし、`ApiError(400/404/415/422)`（= stream 拒否）で 1 回だけ bulk にフォールバック。`turnService` は `onSceneTextDelta` を全 3 フローに配線、AbortSignal は `streamStore.getSignal()` から供給（初めて生成キャンセルが可能になった）。表示は `src/store/streamStore.ts`（useSyncExternalStore 専用ストア、蓄積全文から `scanSceneText` で sceneText を抽出、100ms トレーリングバッチ）。GameScreen はストリーミング中 LoadingOverlay を抑制して本文ライブ表示（`MainText` に `streamingCursor` 追加）、選択肢は pulse スケルトン、Stop で `cancelGeneration`。per-model opt-out は `lib/modelOptions.ts`（`--stream=false` を textModel 文字列から解析、`isStreamingEnabledForSettings` = グローバル設定 AND per-model）。
- **settings 拡張** (`types/settings.ts`): `uiLanguage`（default はブラウザ検出）、`enableStreaming`（default true）、`aiTranslations` / `aiLanguageMappings`（要素単位 safeParse + スキップ + 警告、AGENTS ルール4準拠、旧レコードは欠損 OK）。`App.tsx` の effect が settings 変化を検知して `addResourceBundle`（overlap+deep）→ `changeLanguage` → ドキュメント効果を適用。
- **PWA**: `main.tsx` で `registerSW({ immediate: true })`（virtual:pwa-register、vite-env.d.ts に client types 追加）。manifest の icons 参照を実際に存在する `android-chrome-192/512.png` に修正（旧参照 `pwa-192.png` は実ファイルなしで壊れていた）。precache にロケールが含まれる（json は globPatterns 済み）。
- **テスト**: `lib/modelOptions.test.ts`（パース + ストリーミング判定）、`store/streamStore.test.ts`（scanSceneText のエスケープ/後方キー採用）、`features/autoplay/autoplayService.test.ts`（ログ構築・reasoning チェーン・終端検出）。全 173 テスト + tsc + lint + prettier グリーン。
- **意図的に未実装**（後続フェーズ）: テーマ自動生成（Generate Idea）、OpenRouter PKCE、本文手動編集、開発者オプション、react-hot-toast。

## Phase 5.5（UI 移植）の要点

- **ルーティング**: `react-router`（BrowserRouter + Routes）を導入。`src/app/routes.ts` に ROUTES 定数。Zustand の `screen` state は廃止（遷移はコンポーネントが `useNavigate` で行い、store はデータのみ）。`/play` `/history` `/chronicle` は `RequireActiveGame` ガードで activeGame が無ければ `/` へリダイレクト。
- **スタイル基盤**: Legacy の `index.css`（`@theme` トークン + `form-style`/`choice-style`/`h2-style` 等の共通クラス、`.dark` 変数上書き、OS ダークモード連動）と `Button` intent×size 体系（CSS Module、`@reference "../../index.css"` 相対パスで注意）を移植。フォント/Material アイコン/タイトル背景画像は `public/s/` と `public/images/` に実物コピー（`.prettierignore` に `public/` 追加済み）。
- **共通部品**: `src/components/ui/{Button,Icon,BackButton,LoadingSpinner,Expander,SettingsSection,ToggleSwitch,MainText,Divider,HelpTooltip}`、`src/components/{StoryCard,AttachmentPreview,BackupSection}`、確認ダイアログは `ConfirmationProvider` + `useConfirm()`（Promise ベース、native `<dialog>`）。
- **新スクリーン**: `src/screens/{LoadScreen,HistoryScreen,ChronicleScreen,SettingsScreen,StartingScreen,CompletedDataDeletionScreen}.tsx`。ゲーム画面は Legacy の 2 ペイン（PC）/縦積み（モバイル）+ `GameNavButtons`（←/→/画像再生成/メニュー）+ `LoadingOverlay`/`ZoomOverlay`/`RefineDialog`（リファインはメニューのダイアログに配置）。
- **store 変更** (`gameStore.ts`): `screen`/`beginThemeSetup` 削除。追加: `updateSettings(partial)`（グローバル settings への唯一の書き込み経路）、`saveCredential(key, value)`、`regenerateImage(nodeId)`（同キー上書き、AsyncOperation で管理、a1111/comfyui は進捗 % 表示）、`chronicleTargetNodeId` + `setChronicleTargetNode`、`deleteBranch` が `{ gameDeleted }` を返すよう変更。画像生成トークン（HF/NIM）は bootstrap でメモリにロード。
- **シーンナビの修正（実機確認で発見）**: (1) 語数表示 — `countWords` が改行あり日本語で「段落数」を返すバグ（`generateScene.ts`、CJK 比率判定に修正。表示は GameScreen で sceneText から再計算し既存セーブも正しく見える）。(2) Forward ボタン常時無効 — `useGameNavigation` がパスを表示ノードから構築しており `indexOf(viewing)` が常に末尾になるバグ（Legacy 同様、末端=プレイヘッドから構築するよう修正）。併せて Legacy の `currentNodeId`（プレイヘッド、Forward の目的地）を store に `currentNodeId` として復活（セッションのみ・非永続化）。History/Chronicle の Resume Here は `resumeStoryAtNode(nodeId, branchEndNodeId)` で表示位置とプレイヘッドをセットする（Legacy `onRewind(gameLog, endId, node.id)` 相当）。回帰テスト: `src/store/gameStore.test.ts`（store フロー）+ `src/hooks/useGameNavigation.test.tsx`（happy-dom 実レンダリング、Resume Here/プレイヘッド不一致/Chronicle 中間の3シナリオ）。
- **配置の決定事項**: Backup & Restore セクション（Phase 5 実装）はタイトル画面から **設定 > Data Management** へ移動（Legacy 準拠。戻す場合は TitleScreen に `<BackupSection />` を戻すだけ）。セーブのエクスポートは LoadScreen のカードから HistoryScreen の「Download Save Data」ボタンへ。wipe は Settings > Delete All Data（confirm 後、`sessionStorage` フラグ + リロードで DeletionComplete 画面を表示）。
- **意図的に未実装**（Phase 6 以降）: react-hot-toast 未導入（インライン表示で代用）、AI 翻訳/言語セレクタ、ストリーミング、オートプレイ、本文編集（store に該当 action なし）、開発者オプション。※AI 翻訳/言語セレクタ・ストリーミング・オートプレイは Phase 6（PR #10）で対応済み。

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
- **CodeQL 運用メモ**: リポジトリは CodeQL **default setup**（`.github/workflows` に codeql.yml なし）。`// codeql[...]` 抑制コメントは default setup では自動反映されない（advanced setup + `AlertSuppression.ql` + `dismiss-alerts` アクションが必要）。誤検知は API で却下する（例: PR #9 の `js/xss-through-dom` — React が属性をエスケープするため alt への file.name 流入は無害。根拠コメントを AttachmentPreview.tsx に記載済み）。
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
  - Phase 6: `src/features/i18n/{index,config,englishUiTexts,translateService,api}.ts` + `locales/{en,ja,zh,zh-tw,ko}.json` / `src/features/autoplay/{autoplayService,api}.ts` + テスト / `src/store/streamStore.ts` + テスト / `src/lib/{modelOptions,openAiClient}.ts` / `src/main.tsx`（registerSW）

## セッション再開手順（このファイルを閉じる前に）

1. `git checkout main && git pull`
2. `REDESIGN.md` と `AGENTS.md` を再読
3. 次のフェーズの作業ブランチを切る（例: `feature/phase7-tauri`）
4. 着手

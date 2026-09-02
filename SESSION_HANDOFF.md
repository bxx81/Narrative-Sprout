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
| 6.7   | ✅ 完了（PR #13 merged） | 本文手動編集（UPDATE_SCENE 相当の in-place 書き換え + メニュー Edit ボタン）+ Generate Idea（テーマ自動生成、keywordSets 5個/呼び出し、cycleTheme でストック消費→枯渇時 AI 生成）+ ストリーミング OFF でも API が stream:true になるバグ修正（表示のみ切替だった）。実機確認済み（テーマ生成・失敗トースト・ストリーミング ON/OFF・編集の次生成反映） |
| 6.8   | ✅ 完了（PR #14 merged） | redoScene（Regenerate Scene）: 非ルート=同一選択肢の sibling 再ロール（Keep/Discard 3択 confirm、Discard で履歴永久切断）、ルート=新セーブスロット生成（現セーブ保持）。実機確認済み（Keep/Discard の送信ペイロード、ルート再生成の新規スロット） |
| 6.9   | ✅ 完了（PR #15 merged） | 開発者向けオプション: Settings に Developer Options セクション（WebP 圧縮率セレクタ / 生成中の経過時間表示トグル / 429 自動リトライを Story Log Compaction から移動 / デバッグログトグル）。isDebug は URL query ではなく localStorage ベース（`nsDebug`）。実機確認済み（WebP サイズ変化 200KB→1.5MB、経過秒表示、query/トグルでの表示切替、dev モードでのオフ化） |
| 6.9.1 | ✅ 完了（PR #16 merged） | LoadingOverlay の段階表示修正: 生成中ずっと「選択肢を生成中」になり a1111 プログレスにも遷移しないバグ（Legacy の spinnerState 段階追跡を port していなかった）→ `generationStage`（choice/scene/image）+ turnService の段階コールバックで復元。ストリーミング中も本文受信完了（sceneTextComplete）でスピナー復帰。実機確認済み（表示遷移・プログレス・復帰タイミング） |
| 6.9.2 | ✅ 完了（PR #17 merged） | テーマ設定の添付フロー修正: 添付ボタンが mount 毎に 1 回しか機能しないバグ（live FileList を setState updater クロージャに渡し、`value=""` で空になっていた）→ ハンドラ内で即時スナップショット。front matter `theme:` を添付時にテーマ欄へ事前反映。実機確認済み（連続添付・テーマ反映・front matter 除去ペイロード） |
| 6.9.3 | 🚧 実装完了・未コミット | sceneTextLength をセーブスロット毎に保持（Legacy 準拠・REDESIND §5.4 の例外規定追加）: `GameRecord.sceneTextLength`（optional、旧セーブはグローバル設定フォールバック）に作成時スナップショット、choose/refine/redo/rootRedo はスナップショット値で生成 |
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

## Phase 6.7（本文手動編集 + Generate Idea）の要点

- **本文手動編集**（Legacy UPDATE_SCENE の移植）: `gameRepository.updateNodeSceneText(nodeId, sceneText, sceneWordCount)` が単一ノードを in-place 書き換え（新しいノード/分岐は作らない）。`gameStore.updateSceneText` がノード配列も同時に更新し、`countWords` で語数を再計算。**次ターンのプロンプト履歴は保存済み scene から `sceneToWireResponse` で再構築されるため、編集は以後の生成に自動反映される**（Tooltip の意図どおり）。UI は GameNavButtons メニューに Edit ボタン（`edit` アイコン）→ GameScreen が `isEditingScene` ローカル state で textarea（uncontrolled defaultValue）+ Apply/Cancel（`check`/`close` アイコン）に切替。RefineDialog と同じ `onOpenEdit` prop パターン。storyClosingText や choices は編集対象外（Legacy 同様）。バリデーションなし（Legacy 同様、空文字も許容）。
- **Generate Idea**（Legacy themeService の移植）: `src/features/theme/` 新設。`themeGeneratorData.ts` は Legacy から実データをコピー（WORLDVIEWS 37 / GENRES 12 / TONES 19、日本語エントリ）。`generateThemes` がキーワードセット 5 組（ランダム抽出）で 1 呼び出し、`themes: [{title, description}]` を json_schema（strict=false なら json_object + プロンプト埋め込み）で取得し `"Title: description"` 形式の文字列に変換（title/description 欠損はスキップ）。モデル・オプション・タイムアウトは textModel 文字列から共通解析。
- **store**（`gameStore.ts`）: `generatedThemes: string[]` + `themeGeneration: AsyncOperation` + `cycleTheme()`。ストックがあれば AI 呼び出しなしで 1 つ pop して返し、空なら生成して先頭を返す（残り 4 をストック、Legacy SET_GENERATED_THEMES 相当）。失敗時は failed phase を記録して rethrow（翻訳と同じパターン — 呼び出し側 ThemeSetupScreen が catch して `generateThemeFailed` トースト）。ボタンは Legacy 同様 `psychiatry` アイコン + 残数 `(N)` 表示、`isWorking` でビジー表示。
- **テスト**: `gameStore.themeAndEdit.test.ts` 3 cases（ストック pop / 生成失敗 rethrow / in-place 編集 + 語数更新 + DB 反映）。全 195 テストグリーン。
- **ストリーミング配信モードのバグ修正（実機確認で発見）**: `enableStreaming` スイッチが表示にしか効かず、API 呼び出しは常に `stream: true` だった。原因: `callChatCompletion` は `onDelta` の有無で配信方式を選ぶが、store が `onSceneTextDelta` を無条件に渡していた（`streamStore.begin(false)` は表示モード「generating」にするだけ）。修正: store の 3 フロー（start/choose/refine）で `streamingEnabled = isStreamingEnabledForSettings(settings)` を計算し、false なら `onSceneTextDelta` を渡さない（Legacy beginStream 準拠）。per-model `--stream=false` は従来どおり `modelOptions.stream` チェックで効く。回帰テスト: `gameStore.streaming.test.ts`（fetch スタブでリクエストボディをキャプチャし、OFF で `stream` フィールドなし / ON で `stream: true` を検証）。全 197 テストグリーン。

## Phase 6.9（開発者向けオプション）の要点

- **isDebug（Legacy `utils/debugLog.ts` の移植 + 方式変更）** (`src/lib/debugLog.ts`): Legacy は `?debug=true` URL query → グローバル `isDebug` だったが、v2 は **localStorage ベース**（キー `nsDebug`、`DEBUG_STORAGE_KEY`）。モジュール評価時に 1 回だけ決定: (1) `?debug=true` / `?debug=false` query（同時に localStorage へ永続化して Settings トグルと状態一致）、(2) localStorage フラグ（**`"1"` = 明示 ON、`"0"` = 明示 OFF — `"0"` は `import.meta.env.DEV` より優先されるので dev サーバでもオフにできる**、未設定なら次へ）、(3) `import.meta.env.DEV`（bun dev では常時有効）。`debug` オブジェクトは Legacy 同様 console メソッドの isDebug 条件付き bind（noop 対、log/debug/error/warn/info/group*/time*）。`setDebugMode(enabled)` が localStorage を書く（Settings のトグルから呼ぶ。反映はリロード後 — ラベル `debugLogsEnableLabel` に記載済み）。**テスト環境に localStorage がない**ため debugLog.test.ts は Map ベースのスタブで検証。
- **Settings > Developer Options セクション**（最下部、`service_toolbox` アイコン、黄色）: isDebug のとき WebP 圧縮率セレクタ（`normal` 0.9 / `high` 1.0 — 既存の `webpCompression` 設定と `webpQualityForCompression` に UI を接続しただけ）/ 経過時間表示トグル / 429 自動リトライセレクタ（**Story Log Compaction セクションから移動**）/ デバッグログトグル（有効時は打ち消し線表示）。非 isDebug のときはデバッグログトグルのみ表示（Legacy 同様の露出制御）。i18n 新キー: `webpCompressionNormalOption` / `webpCompressionHighOption` / `showElapsedTimeLabel` / `debugReloadConfirmMessage` / `debugReloadConfirmLabel`（5言語、全 327 キー）。**デバッグログトグルは confirmed 後 `window.location.reload()` する**（isDebug はモジュール定数なのでトグルを押しても見た目は変わらず、実機確認で発見・修正。「後で」でも localStorage は書き換わり次回ロード時に反映）。
- **生成中の経過時間表示**（Legacy `showElapsedTime` + `generationStartedAt`）: settings に `showElapsedTime`（default false）を追加。`AsyncOperation.running.startedAt`（ISO、既存）を GameScreen が epoch ms に変換して `LoadingOverlay` に渡す（generation / imageRegeneration / autoplayTurn のいずれか実行中のもの）— **store に新 state は不要だった**。`ElapsedCounter` を `components/game/LoadingOverlay.tsx` から export し、StartingScreen（初回生成中）でも再利用。`elapsedTime` キー（"{{seconds}}s elapsed" / "{{seconds}}秒経過"）は既存キーを流用。
- **debug ログの配置**: `generateScene.ts` の `callChatCompletion`（全 LLM 呼び出しの入口）に `debug.groupCollapsed("[llm] call …")`（モデル・各メッセージの role/長さ/先頭300字・strict/timeout/baseUrl）、応答ログ（model/cost/finishReason/contentLength）、ストリーミング拒否フォールバック時 `debug.warn`。`turnService.ts` の startGame/choosePath/refineScene 先頭に 1 行（choosePath は historyNodes 数と discardHistoryContext を出力 — **履歴切断のデバッグにそのまま使える**）。既存の `console.error`/`console.warn`（エラー系）は常に出るべきなので触っていない。
- **テスト**: `lib/debugLog.test.ts`（setDebugMode の永続化 1 case）、`types/settings.test.ts` に showElapsedTime/autoRetrySeconds の default 検証を追記。全 204 テストグリーン。
- **意図的に未実装**: Legacy の開発者オプションのうち Visual test リンク（v2 に test ページなし）、Import sample savedata、添付ファイル送信形式（file/string）、テキスト生成前の画像モデルアンロード。E/R キーショートカット同様、必要になった時点で追加。

## Phase 6.9.1（LoadingOverlay 段階表示修正）の要点

- **原因**: v2 は GameScreen の `spinnerState` を `generation.payload.kind` から**静的導出**していた（kind === "choice" → 終始「選択肢を生成中」）。Legacy は生成パイプラインの各段階で `onSpinnerStateChange("Text"/"Image")` コールバックが store を更新しており、テキスト生成中は Scene、画像生成中は Image（+ a1111/comfyui プログレス）に遷移する。v2 では port を省略していたため画像段階に遷移せず、`nowProgress = spinnerState === "Image" && …` のプログレス表示も永遠に出なかった。加えて通常ターンの画像生成では `onProgress` が store まで配線されていなかった（画像再生成ボタン `regenerateImage` のみ）。
- **実装**: store に `generationStage: "choice" | "scene" | "image" | null`（session のみ）を追加。`turnService` に `TurnServiceOptions`（`onTextGenerationStart` / `onImageGenerationStart` / `onImageGenerationProgress`）を導入し、テキスト生成直前・画像生成直前・progress で呼ぶ（startGame / choosePath / refineScene の 3 経路、`generateSceneImage` に onProgress を渡す）。store の 5 フロー（start/choose/refine/redo/rootRedo）が running 開始時に stage を choice/scene で初期化 + `imageGenerationProgress: null` リセット、完了/失敗で progress を null に。GameScreen の spinnerState は stage 優先（image > scene > kind フォールバック）、`suppressed` に `generationStage !== "image"` を追加（**ストリーミング本文表示から画像生成への復帰** — streamStore.status は finally まで streaming のままなので、これがないと画像オーバーレイが隠れ続ける）。「Choice」表示は選択肢クリック直後の一瞬のみ（Legacy 同様）。
- **テスト**: `gameStore.stage.test.ts` — choose の fetch スタブ内で `generationStage` を観測し、開始直後 "choice" → テキスト呼び出し時 "scene" を検証。全 205 テストグリーン。
- **スピナー復帰タイミング（Legacy での追加対応の移植）**: `suppressed` に `!stream.sceneTextComplete` を追加。ストリーミング中は本文受信完了（sceneText の閉じクォート検出）までオーバーレイを隠し、完了後は残り JSON（choices/notes/imagePrompt 等）の生成中にスピナーを再表示する（stage は "scene" のまま → 「シーンを生成中」表示）。

## Phase 6.9.2（テーマ設定の添付ボタン 2 回目無反応修正）の要点

- **症状**: ThemeSetupScreen の「ファイルを添付」ボタンが mount ごとに 1 回しか機能しない。ドラッグ&ドロップは常に正常。Edge で確認。タイトル画面に戻って再遷移すると復活（= mount 毎に 1 回）。
- **原因（実機ログで確定）**: `change` は**毎回発火しており files も入っている**のに追加されない → **live FileList を setState updater のクロージャに渡していた**のが根本原因。`handleFileChange` は (1) `setAttachmentFiles((prev) => [...prev, ...Array.from(files)])` で updater を登録 → (2) `e.target.value = ""` が **live FileList をその場で空にする** → (3) updater は render 時に評価されるため、実行時には `Array.from(files)` が**空配列**になり何も追加されない。1 回目だけ成功するのは React の **eager state 評価**（該当 fiber に保留更新がない最初の dispatch では updater を同期的に評価し、`hasEagerState` として確定値を採用する）が `value=""` より前に走るため。ドラッグ&ドロップが常に成功するのも整合（`dataTransfer.files` は `value=""` で触られない）。Legacy 同一実装でも本来壊れるコードだが、React の評価タイミング次第で発現する可能性があった（タイミング依存バグ）。
- **修正**: `handleFiles` を `File[]` 受けに変更し、**イベントハンドラ内で即時に `Array.from` でスナップショット**（file input は `e.target.value = ""` の前、drop は `dataTransfer.files`）してから setState に渡す。updater は生配列を参照するので評価タイミングに依存しない（spec 的に正しい形）。input の `key` リマウント（tracker リセット）も併せて維持。調査用 `[attach]` debug ログは原因確定後に除去済み。実機確認済み（2 回目・3 回目以降の連続添付 OK）。
- **教訓**: FileList / DataTransfer など live 系オブジェクトを setState updater のクロージャに渡さない。ハンドラ内で即時スナップショット（`Array.from`）。
- **front matter theme のテーマ欄反映（実機指摘対応）**: v2 では YAML front matter の `theme:` は startNewGame 内の `processAttachmentFiles` で解決され（生成のテーマに採用、テーマ欄の入力より優先・「最初の 1 つが有効」）、**テーマ欄には表示されなかった**。Legacy は「ファイル名に theme を含む .md/.txt の最初の `---` まで」を挿入する簡易ヒューリスティックだったため、UX 差として指摘された。v2 は `ThemeSetupScreen.handleFiles` でテキスト添付（text/plain / text/markdown / .md / .txt）を `File.text()` で読み `parseScenarioFile` して**最初の front matter theme を textarea に事前反映**（ファイル自体は従来どおり添付 = Start 時に本体が世界テキストになる）。画像等はスキップ、読み取り失敗は plain attachment 扱い。

## Phase 6.9.3（sceneTextLength の per-save スナップショット）の要点

- **背景（実機確認で判明）**: v2 は sceneTextLength をグローバル settings のみに持ち、セーブを読み込んでの続き生成も「読み込み時点の現在設定」で行っていた（REDESIGN §5.4「生成設定は完全にグローバル一本」）。Legacy はセーブデータ内 settings スナップショット（`activeLogDetail.settings.sceneTextLength`）を参照しており、800-1600 語（novel2）で作ったセーブが設定変更後も長さを保っていた。ユーザー承認のもと **Legacy 準拠（per-save）へ設計変更**。
- **実装**: `GameRecord` に `sceneTextLength: string | undefined`（optional — 旧セーブ互換、backupPayload / ns-save も同じ schema を再利用するので自動対応）を追加。`turnService.startGame` が game レコード作成時に `params.sceneTextLength` を焼く。store の生成 4 フロー（choose / refine / redo non-root / rootRedo）は `activeGame.sceneTextLength ?? settings.sceneTextLength` を渡す（旧セーブはフォールバック）。rootRedo は元セーブのスナップショットを引き継ぐ。**startNewGame は現在の settings 値を焼く**（以後そのセーブは設定変更の影響を受けない）。他の生成設定（textModel・画像等）はグローバル一本のまま。
- **REDESIGN.md 更新**: §5.4 に例外規定を追記、§5.2 の GameRecord コメント更新。types/{game,settings}.ts の doc コメントも同期。
- **テスト**: `gameStore.sceneLength.test.ts` 3 cases（スナップショット値で生成（global が medium でも novel2 で出す）/ 旧セーブのフォールバック / startNewGame が snapshot を焼く）。fetch スタブで request の全 messages を結合して "Target scene length" 指示語（長さ指示は system ではなく user メッセージ側に入る点に注意）を検証。全 208 テストグリーン。

## Phase 6.8（redoScene）の要点

- **Legacy セマンティクス**: redo は「同一選択肢の sibling 再ロール」で refine（指示付き）と対になる機能。`discardHistoryContext` の切断は `promptService.buildContextForApi` で実現されており、**フラグ付きノード自体は履歴に含み、それより古い世代を永久に除外**（未来のノードから遡ってもフラグに到達した時点で停止）。メモリ接頭辞（notes/storyLog）は切断の対象外で親から継承。
- **v2 実装**: `features/storytree/treeTraversal.ts` に `applyHistoryContextCut(ancestors)` 純粋関数（フラグに到達するまで（含む）保持）を追加し、store の **choose / refine / redoScene すべて**の ancestors 計算に適用（フラグはノードの metadata に永続化済みなので将来のターンにも効く）。`turnService.choosePath` に `discardHistoryContext?: boolean` パラメータを追加し、生成ノードの metadata に反映。
- **store `redoScene(nodeId, discardHistoryContext)`**: payload 種別 `{ kind: "redo"; nodeId; discardHistoryContext }` / `{ kind: "rootRedo"; gameId; rootId }` を追加（retryGeneration も対応 — rootRedo 失敗時は旧ゲームがアクティブのままなので rootId 再実行で OK）。非ルート: 親ノード配下の sibling として `choosePath`（choiceText は対象ノードから引き継ぎ）。discard 時は ancestors を空配列に（= 履歴なし、メモリのみ）。ルート: `startGame` を同一 theme + attachmentTexts で呼び**新セーブスロットを生成**しアクティブを切替（現セーブは残る、Legacy performRootRegenerate 相当）。ストリーミング/キャンセル/リトライは choose と同じ配線。autoplay 中は手動操作として拒否。
- **ConfirmationProvider**: `neutralLabel` オプションを追加（3 択ダイアログ）。`confirm()` の戻り値を `boolean | "neutral" | null` に拡張（既存呼び出しの `result !== true` はそのまま互換）。
- **UI**: GameNavButtons メニューに Redo ボタン（`redo` アイコン）。ルート viewing 时は `redoRootConfirmMessage` 単 confirm、非ルートは Keep（`redoSceneConfirmKeep` → discard=false）/ Discard（`redoSceneConfirmDiscard` → discard=true）/ Cancel の 3 択。choiceText が空の非ルートノードは何もしない（Legacy 同様）。
- **テスト**: `treeTraversal.test.ts` に cut 3 cases、`gameStore.redo.test.ts` 3 cases（sibling 再ロール / discard フラグ永続化 / ルート redo で games 2 件 + 旧セーブ保持）。全 203 テストグリーン。
- **意図的に未実装**: 開発者オプション（デバッグ用）。E/R キー等の redo/edit ショートカットは未移植（メニュー経由のみ）。
- **スコープ外とした Legacy 機能**: 開発者オプション（デバッグ用）、redoScene（Regenerate Scene / 文脈破棄 — discardHistoryContext フロー。将来要れば移植）。E キー編集ショートカットも未移植（メニュー経由のみ）。

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

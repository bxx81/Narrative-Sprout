# Narrative Sprout 再設計書（v2 クリーンリビルド）

> 現行リポジトリは試行錯誤の蓄積と API キー混入履歴により公開不可能。
> 本書は **データ互換を一切持たない新規リポジトリ** として作り直すための設計書。
> **機能と外見は現行版を継承** し、内部構造・命名・永続化・セキュリティを全面再設計する。

---

## 1. 目的と基本方針

| 項目               | 方針                                                                               |
| ------------------ | ---------------------------------------------------------------------------------- |
| リポジトリ         | 新規作成。**初回コミットから公開可能**な状態を維持する                             |
| **プロジェクト名** | **`Narrative Sprout` のまま**（利用者実績ゼロのため引き継ぎリスクなし。詳細 §1.1） |
| データ互換         | **一切持たない**。旧 OPFS / ZIP / Drive データの読み込み機能は実装しない           |
| バージョン         | **`version: "2.0.0"` から開始**（§1.1）。`schemaVersion`（整数）は `1` から        |

### 1.1 名称とアイデンティティの扱い

利用者が実質ゼロであり名前の継続リスクがないため、**名称は変更せず、バージョンで断絶を表現する**方針：

| 対象                  | 扱い                                                                                                                                                                 |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **アプリ表示名**      | `Narrative Sprout` のまま（作品のコンセプト名として引き継ぐ）                                                                                                        |
| **GitHub リポジトリ** | 現行を `narrative-sprout-legacy` にリネーム・private 化・アーカイブ。新リポジトリが `narrative-sprout` を名乗る（標準的な OSS の legacy → current 置き換えパターン） |
| **デプロイ URL**      | `narrative-sprout.pages.dev` を新 Pages プロジェクトに引き継ぐ（旧プロジェクトは domain 解放のため削除/リネーム）                                                    |
| **app version**       | `2.0.0` から開始（「v1 系は同名の旧実装」であることを semver で示す）                                                                                                |
| **DB schemaVersion**  | `1` から開始（新実装の内部版数。旧アプリの `acceptVersion="2.6.10"` とは別系統）                                                                                     |

- 「ナンバリング（Sprout 2）」や「hyhen 除去」ではなく **semver のメジャーバージョンで互換性破棄を表現**する方法を採用。Python 2→3 等と同じ、名前は同じで仕様が変わる正統な OSS の進化形
- 旧リポジトリは参照用に残す（設計の歴史的コンテキスト、およびこのドキュメントの過去参照用）
  | 機能・UI | 現行版の全機能と外見を踏襲（後述 §8 の機能継承リスト） |
  | 命名 | AI（LLM エージェント）が誤解なく扱える命名規約を強制（§6） |
  | 永続化 | OPFS + gzip JSON 単一ファイル → **IndexedDB（Dexie.js）によるノード単位レコード化** |
  | セキュリティ | API キーをコード・設定ファイル・ビルド成果物・バックアップに平文で残さない設計 |

---

## 2. 現行版の問題点と解決策

| #   | 現行の問題                                                                                        | 再設計での解決策                                                                    |
| --- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| P1  | リポジトリ履歴に API キー混入、公開不可                                                           | 新規リポジトリ + シークレットスキャン CI（§3）                                      |
| P2  | `acceptVersion` 単純比較、version 欠損で即プレイ不可                                              | スキーマバージョン + **マイグレーションチェーン**を初版から導入（§5.6）             |
| P3  | log.json.gz 単一ファイルに全ノード格納、破損時全滅                                                | IndexedDB でノード単位のレコード分割（§5.1）                                        |
| P4  | 書き込み競合の手製 Mutex / 途中失敗での孤児画像                                                   | IndexedDB トランザクション + **孤児アセットの GC**（§5.3）                          |
| P5  | Drive バックアップに settings.json を**平文**アップロード                                         | **パスフレーズ暗号化（WebCrypto AES-GCM）を必須化**（§3.3）                         |
| P6  | Zod `.catch({})` がレコード全体を無音置換                                                         | **要素単位 safeParse + 警告付きスキップ**を lint ルール化（§5.7）                   |
| P7  | `scene→sceneText` 等の歴史的リネームが移行コードに埋まる                                          | 互換レイヤー自体を撤廃。初版から正しい名前で定義                                    |
| P8  | `_PENDING/_SUCCESS` + `lastActionForRetry` の手動管理が煩雑                                       | リトライ機構を汎用化した `AsyncOperation` パターンに統一（§4.3）                    |
| P9  | Mutex を手書き（10s タイムアウト）                                                                | IndexedDB のトランザクションに委譲。手製 mutex 廃止                                 |
| P10 | `VITE_GOOGLE_API_KEY` が公開 JS に埋め込まれる                                                    | 公開環境変数の埋め込みは最小限に。リファラー制限の手順をドキュメント必須化          |
| P11 | HF / NIM トークンが per-game 設定に混入し、エクスポート時の「消毒」コードが必要（消毒漏れ = A-5） | トークンはグローバルの `credentials` ストアのみ。消毒ロジックそのものを廃止（§5.4） |

---

## 3. セキュリティ設計（公開リポジトリ前提）

### 3.1 リポジトリ衛生

- **シークレットはリポジトリに一度も入れない**ことを CI で強制：
  - `gitleaks`（または GitHub Secret Scanning + Push Protection）をプリコミット & CI に導入
  - `.env*` は `.gitignore` 必須。テンプレートは `.env.example`（値は空）
- `VITE_` プレフィックス変数の新規追加は **PR レビュー必須**（公開 JS に埋め込まれることを CONTRIBUTING に明記）
- GitHub リポジトリ設定：Secret Scanning / Push Protection / Dependabot を ON

### 3.2 API キーの取り扱い（ランタイム）

- API キーはユーザーがアプリ UI から入力し、**IndexedDB の `credentials` ストアにのみ保存**（§5.1）
- 設定エクスポート / Drive バックアップには **デフォルトでキーを含めない**。含める場合は必ず暗号化（§3.3）
- Google API キー（ビルド埋め込みが必要な場合）は **HTTP リファラー制限必須**。設定手順を README に同梱
- 補足（脅威モデルの誠実な開示）：IndexedDB の中身も同一ユーザーが DevTools で覗けば読める。ブラウザ版は「他サイトからは Same-Origin Policy で保護されるが、本人のブラウザからは見える」水準であり、ドキュメントでもこの表現を使う。Tauri 版の stronghold との違いは「平文ファイルがディスクに常駐するか否か」

### 3.3 バックアップ暗号化（A-5 の恒久対応）

- Drive / ファイルエクスポートのバックアップ形式内部：
  ```
  backup.nsbak = {
    format: "ns-backup",
    version: 1,
    kdf: { algo: "PBKDF2", hash: "SHA-256", iterations: 600000, salt: <base64> },
    cipher: { algo: "AES-GCM", iv: <base64>, data: <base64> }
  }
  ```
- WebCrypto のみで実装（外部依存なし）。パスフレーズ入力を復元時に必須化
- **暗号化なしバックアップは新設計では提供しない**（平文アップロード経路を存在させない）

### 3.4 Tauri 版（確定）

背景：現行版では WebView2（Windows）のユーザーデータフォルダに OPFS の中身が平文で展開されており、「キーを安全に保存している」という設計意図と実態が乖離していた。この乖離を解消する。

#### クレデンシャル：`tauri-plugin-stronghold` を採用（確定）

- API キー / トークン類（§5.4 の `credentials` 相当）は stronghold の Vault に保存
- stronghold は少量・高機密データ向けの設計（XChaCha20-Poly1305 暗号化スナップショット）であり、認証情報の保管という本用途に合致
- 「設定ファイルを開くだけでキーが読める」状態からの脱却を保証する。**平文ファイル保存は禁止**（lint/レビュー規約）

#### セーブデータ（物語本文・画像等の bulk データ）：暗号化しない（確定）

- stronghold はスナップショット方式の少量データ向けであり、画像を含む bulk データには不適。無理に使うと保存ごとに全量再暗号化が走り実用的でない
- 採用方針：**OS のユーザー分離（Windows アカウント ACL）に委ね、脅威モデルをドキュメントに明記する**
  - 同一 Windows アカウント上の他プロセスからは理論上読める（これは VS Code・ブラウザ等の一般的デスクトップアプリと同じ水準）
  - 別ユーザー・別マシンからは OS が保護する
  - 「アプリ側で暗号化している」かのような誤解を招く表現を README / ドキュメントに書かないことを規約とする（誠実さの担保）
- 念のための棄却記録：「アプリが暗号化するが鍵も同じマシンに置く」方式は難読化止まりで実利が薄いため採用しない。真の at-rest 暗号化（起動時パスフレーズ方式）は将来検討課題とするが、忘却 = 全データ喪失の UX コストをユーザーに課すため初版には入れない

#### 運用

- `src-tauri/` は引き続き専用ブランチ運用。ブランチ名・管理方針を README に明文化
- `dist/` は全ブランチで `.gitignore` 除外（§7）。ブランチ間マージの煩雑さを構造的に解消

---

## 4. アーキテクチャ再設計

### 4.1 技術スタック（基本踏襲）

| 層         | 現行                            | 新設計                                    | 変更理由                      |
| ---------- | ------------------------------- | ----------------------------------------- | ----------------------------- |
| Runtime    | Bun                             | Bun（変更なし）                           | 現状で問題なし                |
| UI         | React 19 + React Router v7      | 同左                                      | 外見・画面構成の継承          |
| Styling    | Tailwind CSS v4                 | 同左                                      | 同上                          |
| Build      | Vite 7 + PWA                    | 同左                                      | 同上                          |
| Validation | Zod v4                          | 同左                                      | `.catch` の使い方のみ規約変更 |
| **永続化** | OPFS + gzip JSON                | **IndexedDB（Dexie.js）**                 | §5                            |
| 状態管理   | useReducer（50 case） + Context | **Zustand**（slice 構成 + selector 購読） | §4.3                          |
| Desktop    | Tauri v2                        | 同左                                      | 変更なし                      |

### 4.2 レイヤー構成（現行を踏襲しつつ整理）

```
src/
  app/            # エントリ、ルータ、プロバイダ
  screens/        # 画面コンポーネント（現行の画面名を継承）
  components/     # 共通 UI 部品
  features/
    narrative/    # 物語生成（LLM 呼び出し、プロンプト構築、メモリ）
    image/        # 画像生成（HF / A1111 / ComfyUI）
    story-tree/   # 分岐ツリー操作、巻き戻し、リファイン
    attachments/  # 添付ファイル処理
    export/       # ZIP エクスポート / 物語HTML出力
    backup/       # 暗号化バックアップ / Drive 連携
    i18n/         # 多言語（静的5言語 + AI動的翻訳）
  store/          # 状態管理（§4.3）
  db/             # IndexedDB スキーマ・リポジトリ層（§5）
  lib/            # 純粋関数ユーティリティ（crypto, id, gzip…）
  types/          # 型定義 + Zod スキーマ
public/           # 静的ファイル（Vite 標準位置。現行の src/public から移動）
functions/        # Cloudflare Pages Functions（§7。必要になった時点で配置）
```

「サービス」という曖昧な層は廃止し、**機能単位の feature モジュール**に集約する。各 feature は `api.ts`（公開関数）のみを外部公開し、内部実装は非公開にする。

### 4.3 状態管理と非同期操作

現行の `_PENDING/_SUCCESS` + `lastActionForRetry` 手動管理を、型安全な汎用パターンに置き換える：

```typescript
// store/asyncOperation.ts
type AsyncOperation<TPayload, TResult> =
  | { phase: "idle" }
  | { phase: "running"; payload: TPayload; startedAt: string }
  | { phase: "failed"; payload: TPayload; error: AppError } // payload 保持 = リトライ可能
  | { phase: "done"; result: TResult };
```

- 全ての非同期操作（生成・画像・保存・翻訳）はこの型で表現。「`lastActionForRetry` を union と reducer 両方に追加」という現行の脆弱な手順を不要にする

### 4.3.1 状態管理ライブラリ：Zustand 採用の確定

useReducer + Context（現行）からの移行理由：

1. **再レンダリングの最適化**：現行は巨大な単一 `GameState` を selector なし Context で配布しており、`isImageRegenerating` 1つの変化でゲーム画面全体が再描画される。Zustand の selector 購読（`useStore(s => s.viewingNodeId)`）で関係フィールドの変化時のみ再レンダリングにできる
2. **サービス層からの直接アクセス**：現行は gameService 等が state を引数で受け回ししている。Zustand なら `useGameStore.getState()` で React 外から読み書きでき、hooks→dispatch→service の往復が消える
3. **`AsyncOperation` との親和性**：reducer の case 追加儀式ではなく action 関数内の `set()` で済む

**reducer の長所の保全策**（`set()` でどこからでも書けてしまう弊害への対策）：

- store は `store/` に slice 単位（`gameSlice`, `settingsSlice`, `imageSlice` …）で定義
- **コンポーネント・feature からの `set` 直接呼び出しを禁止**。状態変更は必ず slice 内に定義された action 関数経由（ESLint の import 制限で検出）。これで「許される更新の一覧性」を reducer 相当に保つ
- action 関数名は `domain.verb` 形式（§6。例: `game.startNew`, `storyTree.rewind`, `image.regenerate`）
- middleware は `devtools`（開発時トレース）と `subscribeWithSelector` のみ。`persist` middleware は**使わない**（永続化は §5 の IndexedDB で一元管理し、Zustand はあくまでメモリ上のライブ状態。二重の永続化経路を作らない）

### 4.4 シナリオファイル形式（添付ファイルの仕様変更）

現行版の「ファイル名に `theme` を含む ＋ 最初の `---` でテーマ文／添付テキストを区切る」というヒューリスティック仕様を廃止し、**YAML front matter による自己記述形式**に刷新する。

#### 新フォーマット（`.md` / `.txt`）

```markdown
---
title: 黄昏の王国
theme: |
  王国は黄昏に沈みゆく。
  プレイヤーは記憶を失った騎士として目覚める。
---

# 世界観（添付テキストとして AI に渡される）

- 王国の首都は……
  <flag:entered_castle>城の地下には……</flag:entered_castle>
```

| 部分                      | 役割                                                                                                       |
| ------------------------- | ---------------------------------------------------------------------------------------------------------- |
| front matter の `theme:`  | テーマ文（テーマ設定フォームの内容に相当）。複数行は YAML ブロックスカラー（`\|`）で記述                   |
| body（front matter 以降） | 添付テキスト。`{a\|b}` ランダム選択・`<flag:...>` / `<flag-not:...>` / `<if:...>` 条件開示は従来どおり有効 |

#### 判定ルールの単純化

| ファイル                               | 扱い                                                                    |
| -------------------------------------- | ----------------------------------------------------------------------- |
| front matter を持ち `theme` キーがある | **シナリオファイル**：`theme` をテーマ文、body を添付テキストとして登録 |
| front matter なし（または parse 失敗） | 従来通りの**通常添付テキスト**（全文を添付）                            |
| 画像 / `.b64`                          | 従来どおり（本変更の対象外）                                            |

- **ファイル名による判定（`theme` 含有）は廃止**。「ファイル名」+「最初の `---`」の二重ヒューリスティックを、front matter の有無という単一の明示ルールに置き換える
- YAML parse 失敗時は front matter なしとしてフォールバック（クラッシュさせない）。エラー握りつぶしは警告ログ付きで（§5.7 の精神と同じ）
- markdown の水平線・装飾としての `---` が本文に出ても front matter パーサの範囲外なので誤爆しない（現行仕様の最大の欠陥の解消）
- 将来 front matter に `flags:`（初期フラグ）や `language:` 等のメタ情報キーを追加できる拡張余地を確保（未知キーは無視）

#### 実装

- YAML パーサは `yaml` パッケージ等の薄い依存で済ませる（独自パーサを書かない）
- 処理は `features/attachments/` に `parseScenarioFile()` として実装し、`{ theme: string, body: string } | { theme: null, body: string }` の2ケースを返す純粋関数にする（テスト容易性）

---

## 5. データ設計（IndexedDB）

### 5.1 ストア構成（Dexie.js）

```typescript
// db/schema.ts
const db = new Dexie("narrative-sprout") as Dexie & {
  games: Table<GameRecord, string>; // セーブのヘッダ（旧 GameLogSummary）
  nodes: Table<StoryNodeRecord, string>; // ノード単位（旧 nodes Record を分割）
  assets: Table<AssetRecord, string>; // 画像 Blob（nodeId キーで 1:1）
  settings: Table<SettingsRecord, string>; // シングルトン: key='app'
  credentials: Table<CredentialRecord, string>; // API キー類（エクスポート対象外）
};

db.version(1).stores({
  games: "id, lastPlayedAt", // セーブ一覧のソート用
  nodes: "id, gameId, parentId, [gameId+turnNumber]", // ツリー走査用
  assets: "nodeId", // 主キー = ノードID（1ノード1画像）
  settings: "key",
  credentials: "key",
});
```

**ポイント**

- ノードを個別レコードにすることで、破損の局所化・部分読み書き・ツリー走査の高速化を実現（P3 解消）
- インデックスは最小限（`[gameId+turnNumber]` で時系列取得、`parentId` で子ノード列挙）
- 書き込み競合は Dexie のトランザクション（`db.transaction('rw', ...)`) で直列化。手製 Mutex は廃止

### 5.2 レコード定義（新命名、AI フレンドリー）

旧名称との対応は §6.3 を参照。互換変換コードは**持たない**。

```typescript
// types/story.ts
interface GameRecord {
  id: string; // UUID v7
  schemaVersion: number; // §5.6。文字列semverでなく整数
  title: string; // 旧 theme。表示名
  createdAt: string; // ISO 8601
  lastPlayedAt: string;
  latestNodeId: string | null; // サマリ表示用の参照のみ保持（重複データなし）
  // 生成設定は一切保持しない（§5.4。全てグローバル settings を常時参照）
  attachmentTexts?: string[]; // 添付テキスト（YAML解決後、{a|b}適用済み）。per-gameの世界設定として保持（§4.4）。要素単位で検証し不正要素はスキップ。
}

interface StoryNodeRecord {
  id: string; // UUID v7（旧 LogEntryId）
  gameId: string; // 親ゲーム（旧設計にない外部キー）
  parentNodeId: string | null;
  turnNumber: number; // 1 始まり
  choiceText: string | null; // このノードに至った選択肢
  scene: SceneContent; // 旧 sceneData（メモリを含まない表示用コンテンツ）
  promptSent: string; // 旧 userContent（送ったプロンプト）
  // 画像は assets ストアが nodeId キーで保持（§5.3）。ノード側に参照フィールドは持たない
  memory: MemoryState; // notes + storyLog の蓄積（この時点までの長期記憶）
  memoryDelta: MemoryDelta; // このターンのメモリ差分（notes 更新 + sceneSummary。再送信用）
  metadata: NodeMetadata; // generationCost, modelName, flags, リファイン情報
  createdAt: string;
}
```

設計上の注意：

- `latestNode`(サマリへのネスト)を廃止し、`latestNodeId` 参照のみ。現行の「サマリと詳細の二重管理」を解消
- `userContent` → `promptSent`、「何を送ったか」が一目で分かる命名。なお一見「送信後は死にデータ」に見えるが、実際には**次ターンのプロンプト組み立て時に過去5ターンの擬似会話履歴をこの値から再構築する**（現行 `promptService.ts` の `buildHistoryForPrompt` 相当）ため永続化が必須。ルート開始時の指示文や、リファイン時の修正指示（対象シーン JSON 埋め込み）は `choiceText` から再計算できないため、フィールド削除は不可——再配慮の際に誤って消されないよう本設計書に根拠を記録する
- 旧版は `sceneData.internalMonologue` にメモリを内包していたが、新設計では `memory`（累積）と `memoryDelta`（当該ターン差分）をノード直下に分離。`scene` は純粋な表示コンテンツのみになる（実装: `src/types/game.ts`）
- リファインは `refinedFromNodeId` / `refinePrompt` を `metadata` に含める（現行と同等の sibling 分岐表現で継承）

### 5.3 画像の保存方式（nodeId 1:1 キー + GC）

**検討の経緯**: コンテンツアドレス（SHA-256）による重複排除も検討したが、現行版では画像とノードは厳密に 1:1（`<nodeId>.webp`）で、再生成は同名上書きのため孤児も重複も理論上発生しない。1:1 対応が保たれる設計では、ハッシュ計算コストと参照管理の複雑さに見合わないため、単純なノード ID キー方式を採用する。

```typescript
// types/asset.ts
/** 画像形式。将来の拡張ポイント（avif / jpeg xl 等をここに足す） */
type ImageMimeType = "image/webp"; // 将来例: 'image/webp' | 'image/avif' | 'image/jxl'

/** mimeType ↔ 拡張子の唯一の対応表（新形式追加時はここだけ直す） */
const imageFileExtensions: Record<ImageMimeType, string> = {
  "image/webp": "webp",
};

interface AssetRecord {
  nodeId: string; // 主キー。StoryNodeRecord.id と 1:1 対応
  blob: Blob; // blob.type も mimeType と一致させる
  mimeType: ImageMimeType;
  byteSize: number;
  updatedAt: string; // 再生成（上書き）のたび更新
}
```

将来の形式追加（AVIF / JPEG XL 等）への備え：

- 判別根拠は `mimeType` フィールド（Blob.type からも冗長に取れる）。読み出し側は mimeType を見てデコード・表示するため、**同一 DB 内での形式混在も成立**する（形式移行の際に全件再変換が不要）
- 変換設定（グローバル `settings`）に `imageOutputFormat` を持たせ、保存時はその形式でエンコード。既存アセットは書き換えない
- **拡張子のハードコード禁止**：ファイル名・ZIP 梱包・Blob URL 生成はすべて `imageFileExtensions[mimeType]` から導出する（ESLint の no-restricted-syntax またはコードレビュー規約で `'.webp'` 直書きを禁止）

運用ルール：

- **再生成は同キー上書き**（現行の `<nodeId>.webp` 上書きと同じ振る舞い）。古い画像は残らない
- **ブランチ巻き戻しでのノード削除と画像削除を同一トランザクション**に入れ、現行版で発生した「消し忘れ」バグを構造的に不可能にする：

```typescript
await db.transaction("rw", [db.nodes, db.assets, db.games], async () => {
  await db.nodes.bulkDelete(nodeIds);
  await db.assets.bulkDelete(nodeIds); // ノードと必ずセットで消える
  // ...
});
```

- **保険の GC（孤児掃除）**: 「`nodes` に存在しない nodeId を持つ asset」をアプリ起動時・セーブ削除時に検出して削除。非トランザクションだった旧 OPFS 方式で発生しえた「画像保存後にノード永続化が失敗」系の孤児に対する安全網。通常は検出ゼロで動作するはずの監視機構として実装する
- ZIP エクスポートは `assets` の内容を `<nodeId>.<拡張子>` 名でそのまま梱包。拡張子は `imageFileExtensions` から導出（§5.3 冒頭の規約）。重複は構造上発生しえないため重複排除ロジック不要

### 5.4 設定とクレデンシャルの分離

- `settings`：画面設定・モデル設定・画像生成の非機密設定（エンドポイント URL / Space ID / モデル名 / 画質など）。**エクスポート/バックアップ対象**
- `credentials`：シークレット類の**単一の置き場**（グローバルのみ、per-game なし）：
  - OpenRouter API キー
  - Hugging Face トークン
  - NVIDIA NIM トークン
  - Google OAuth トークン類
- **バックアップのデフォルト対象外**。含める場合は §3.3 の暗号化レイヤーでしか出さない

#### per-game トークンの廃止（現行仕様からの変更）

現行版は「テーマ設定（ゲーム開始）時にグローバルトークンをセーブスロットへコピー → 以後セーブスロット側を参照・変更」という構造で、トークンが `GameLogDetail` に混入し、エクスポート時の「消毒」コード（ZIP では手動 null 化、Drive では消毒漏れ = A-5）の温床になっていた。

新設計ではこのコピー機構を**廃止**する：

| 項目                   | 現行版                                   | 新設計                                                                                              |
| ---------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------- |
| トークンの保持場所     | グローバル設定＋各セーブスロットにコピー | **グローバル `credentials` のみ**                                                                   |
| ゲーム中のトークン変更 | 設定画面がセーブスロット側を書き換える   | 設定画面がグローバル `credentials` を直接書き換え（**プレイ中の設定画面から変更可能な導線は維持**） |
| per-game 上書き        | あり                                     | **廃止**（セーブ間でトークンを使い分ける機能）                                                      |

これによりエクスポート経路にシークレットが構造上到達しなくなり、`zipExportImportService` の消毒ロジックは**不要**になる。

#### 生成設定は完全にグローバル一本（セーブスロットには何も持たない）

現行版でセーブスロットが生成設定（画像モデル / ComfyUI ワークフロー / LoRA 等）を保持していた動機は「スロットごとの LoRA 使い分け」のような個人用途・非配布前提のニーズだった。しかしこれらはどうせチェックポイント（ローカル環境のモデル資産）に依存するため、スロット内に持つ意味は薄い。そこでシンプルさを優先し：

- **生成設定はグローバル `settings` のみ。セーブスロット（`GameRecord`）は設定・シークレットともに一切保持しない**（スナップショットも保持しない）
- 実行時は常にグローバル `settings` + `credentials` を参照する
- **設定のマスターは設定画面**。テーマ設定画面では「開始前の確認・ちょっとした変更」の副導線として表示・編集可能にする（編集内容はグローバルに書き戻される）
- 副次効果として、エクスポート ZIP に含まれる `manifest.json` にも設定情報が載らないため、**ComfyUI ワークフロー等の環境依存情報がセーブデータに混入する経路そのものが消失**する（現行版が「破棄推奨」としながら保持していた問題の根治）

### 5.5 エクスポート / インポート

- フォーマットを新設計：`ns-save`（ZIP: `manifest.json` + `nodes/*.json` + `assets/<nodeId>.<拡張子>`（拡張子は assets レコードの mimeType から導出））
- 旧形式（log.json.gz / 旧 ZIP）のインポートは **実装しない**。移行したい旧ユーザー向けには、旧版アプリでエクスポートした物語 HTML を「記録の保存」として残す運用をドキュメントで案内するに留める

### 5.6 スキーマバージョンとマイグレーション

- 初版から `schemaVersion: number` を全ルートレコードに持たせる
- マイグレーションチェーンを初版から用意（中身が空でも仕組みだけ先に作る）：

```typescript
// db/migrations.ts — 将来の全スキーマ変更はここに追加する規約
const migrations: Record<number, (tx: Transaction) => Promise<void>> = {
  // 2: async (tx) => { ... 1 → 2 ... },
};
```

- バージョンが不足しているデータは現行と同じく **削除せず**「このバージョンではプレイ不可」と表示（非破壊ポリシーは継承）
- Dexie の `db.version(n).upgrade()` と整合させ、DB マイグレーションは Dexie、アプリデータ移行は本チェーン、という2層を規約化

### 5.7 バリデーション規約（Zod）

現行の知見を lint/規約レベルに格上げ：

1. **レコード・配列型への `.catch()` 全面禁止**（ESLint no-restricted-syntax で検出）
2. 配列/レコードは必ず **要素単位 safeParse + 失敗要素のスキップ + 警告ログ**
3. 未知キーは Zod 既定（strip）のまま。**移行処理は常に safeParse より先に実行**
4. スキーマは `types/` の型と同一ファイルに定義し、`z.infer` から型導出して二重定義を撲滅

---

## 6. 命名規約（AI フレンドリー化）

### 6.1 原則

1. **検索可能性**：グローバル検索で一意にヒットする名前を付ける（`data`, `info`, `item` 等の汎用名を禁止）
2. **ドメイン語の統一**：同じ概念に複数の呼び名を許さない（下記の用語集を唯一の正とする）
3. **省略しない**：`cfg` → `settings`、`log` → `gameRecord` 等、完全な単語で書く
4. **真偽値は `is/has/can/should` 接頭辞**、非同期関数は動詞始まり（`fetchScene`, `saveNode`）
5. **ID フィールドは対象を完全修飾**：`parentId` → `parentNodeId`（何の ID か常に明示）

### 6.2 ドメイン用語集（Glossary）

| 用語       | 定義                              | 旧来の混乱した呼称            |
| ---------- | --------------------------------- | ----------------------------- |
| Game       | 1 つのプレイスルー全体            | GameLog, Log, Save            |
| StoryNode  | 物語の 1 ターンのノード           | LogEntry, Node, Entry         |
| Scene      | ノード内の表示コンテンツ          | SceneData, ReceivedScene      |
| Memory     | AI の長期記憶（notes + storyLog） | InternalMonologue, 暗黙の状態 |
| Asset      | 画像などのバイナリ                | Image, File が混在            |
| Credential | API キー類                        | settings の一部だった         |

### 6.3 主要リネーム対応表（例）

| 旧                          | 新                                | 理由                         |
| --------------------------- | --------------------------------- | ---------------------------- |
| `GameLog`                   | `GameRecord`                      | 「ログ」は実態がセーブデータ |
| `LogEntry`                  | `StoryNodeRecord`                 | 木構造の頂点であることが明確 |
| `sceneData`                 | `scene`                           | 冗長な Data 接尾辞の排除     |
| `userContent`               | `promptSent`                      | 実態は送信プロンプト         |
| `activeLog`                 | `activeGame`                      | 一貫性                       |
| `storageService`            | `db/` リポジトリ層 + `features/*` | 「サービス」の曖昧さ解消     |
| `CHOICE_PENDING / _SUCCESS` | `AsyncOperation<…>` 汎用型        | §4.3                         |
| `compatibleGameLogDetail`   | **廃止**                          | 互換レイヤー不保持           |
| `acceptVersion`             | `schemaVersion` 数値比較          | semver 文字列比較の罠を排除  |

---

## 7. PWA / ビルド

- 現行の教訓を継承：
  - JS/CSS/HTML/json は precache、重い webp 背景とフォントは runtimeCaching
  - globPatterns に webp を入れない（初回インストール激重の再来を防ぐ）
- Cloudflare Pages デプロイ継続。**GitHub 連携で push 検知 → 自動ビルド・デプロイ**（Workers 知識・CLI 不要、`main` push で本番 / PR でプレビュー発行）。新リポジトリに Pages プロジェクトを再作成して接続する
- 環境変数（`VITE_GOOGLE_API_KEY` 等）は **Pages ダッシュボードで管理**し、リポジトリには置かない（§3.1 と整合）
- Pages のビルドイメージの Bun は古いため、`BUN_VERSION` 環境変数をダッシュボードで設定し **`package.json` の `packageManager` と一致させる**（例: `1.4.0`）。ローカル/CI/Pages の3者で Bun を揃える運用ルールとする
- **`dist/` はリポジトリにコミットしない**（全ブランチの `.gitignore` で除外）。Pages がソースからビルドするためコミット不要。現行版の「dev ブランチに dist を追跡 → tauri-build へのマージで毎回手作業除外」という運用事故を構造的に解消する（特に §3.4 の Tauri ビルドブランチ化運用との相性が悪かった）
- **Pages Functions を利用する場合、ソースはリポジトリルートの `functions/` ディレクトリに置くこと**（Pages 側はルート直下の `functions/` のみを Functions として認識する。移動や命名で機能しなくなるため、将来サーバレス処理を足す場合もこの場所を固定とする）
- **静的ファイルは Vite 標準の `public/`（ルート直下）** に置く。現行版は `src/public` に置いて `vite.config.ts` で参照を調整していたが、標準から外れる必然性がなく ignore 設定等の事故要因になるため、新リポジトリでは `public/` に正規化
- `knowledge/`（OKF）の整備は新リポジトリでも継続。**初版から AGENTS.md を整備**し、AI エージェントによる開発を前提にする

---

## 8. 機能継承チェックリスト（現行版から全て移植）

- [ ] テーマ入力 → 導入生成 → 3 択分岐のゲームループ
- [ ] 分岐ツリーによる巻き戻し・別ルート探索
- [ ] シーン修正（リファイン、sibling 分岐）
- [ ] 添付システム（画像 / txt / md / b64、フラグによる段階開示、シナリオファイルは YAML front matter 形式＝§4.4）
- [ ] 長期記憶（notes / storyLog / storyLog コンパクション）
- [ ] 画像生成（HF Spaces / A1111 / ComfyUI、WebP、生成キャンセル）
- [ ] オートプレイ（reasoning チェーンのガード設計含む）
- [ ] ストリーミング生成（per-model 設定含む）
- [ ] セーブ管理（複数セーブ・削除・最終プレイ順）
- [ ] ZIP エクスポート / 物語 HTML エクスポート（〜新形式）
- [ ] Google Drive バックアップ（〜**暗号化必須**に変更）
- [ ] i18n（5 言語 + AI 動的翻訳）
- [ ] Tauri デスクトップ版（D&D、ウィンドウ監視、PKCE OAuth、フォント自己ホスト）
- [ ] PWA（オフライン動作、インストール可能）
- [ ] データ全削除（ワイプ機能）

---

## 9. 移行フェーズ計画

| Phase | 内容                                                                 | 完了条件                             |
| ----- | -------------------------------------------------------------------- | ------------------------------------ |
| 0     | 新リポジトリ作成、CI（lint / test / gitleaks）、AGENTS.md、LICENSE   | CI グリーンの空テンプレート          |
| 1     | `db/` + `types/`（スキーマ・マイグレーション枠組み・Zod 規約）       | スキーマのユニットテスト             |
| 2     | `features/narrative` + `features/story-tree`（ゲームループ最小構成） | テーマ入力〜1 ターン完走             |
| 3     | 画像生成・メモリ・添付・リファイン                                   | 現行の中核ゲーム体験と同等           |
| 4     | セーブ管理 / ZIP エクスポート（新形式）/ ワイプ                      | 永続化一周のE2E                      |
| 5     | 暗号化バックアップ + Drive                                           | 平文が外部に出ないことをテストで証明 |
| 6     | i18n / オートプレイ / ストリーミング / PWA                           | 機能チェックリスト完走               |
| 7     | Tauri 版（別ブランチ運用）、ドキュメント、公開                       | Phase 0〜6 リグレッション            |

各 Phase で **旧コードのコピーを禁止** せず「許容するが命名とデータ構造は必ず新設計に翻訳する」ルールとし、互換レイヤーの持ち込みだけはレビューで除外する。

---

## 10. 現行版から引き継ぐ技術的知見（再発防止）

1. **Zod `.catch()` の罠** → §5.7 の lint ルール化で再発防止
2. **移行は parse より先** → 新設計では互換レイヤーごと不要だが、将来のマイグレーションでも同順序を厳守
3. **VITE\_ 変数は公開 JS に入る** → §3.1 のレビュールール化
4. **PWA precache の取捨選択** → §7
5. **書き込み直列化** → 手製 Mutex から IndexedDB トランザクションへ（§5.1）
6. **テスト文化**：bun test + happy-dom、サービス層厚め・旧形式フィクスチャによる移行テスト → 新設計ではマイグレーション骨組みのテストとして継承
7. **src-tauri のブランチ運用** → 継続しつつドキュメント必須化（§3.4）

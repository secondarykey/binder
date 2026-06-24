# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

Binderは技術文書作成向けの実験的なデスクトップMarkdownエディタ。**Wails v3**（Go + React）でデスクトップアプリケーションを構築している。コンテンツはローカルgitリポジトリにファイルとして保存され、メタデータはCSVベースのSQLテーブル（csvq）で管理される。

## ビルド・開発コマンド

### 前提条件
- Go 1.25+
- Node.js + npm
- Wails v3 CLI (`go install github.com/wailsapp/wails/v3/cmd/wails3@latest`)
- Task (`go install github.com/go-task/task/v3/cmd/task@latest`)

### 開発
```bash
# 開発モードで起動（_cmd/binder/ から実行）
cd _cmd/binder && task dev
# または直接
cd _cmd/binder && wails3 dev -config ./build/config.yml
```

### ビルド
```bash
# プロダクションビルド（_cmd/binder/ から実行）
cd _cmd/binder && task build
```

### フロントエンドバインディング生成
```bash
# Wails v3 バインディング再生成（_cmd/binder/ から実行）
cd _cmd/binder && wails3 task common:generate:bindings
```

### DAO コード生成
```bash
# db/model/*.go の構造体からDAOを再生成（リポジトリルートから実行）
go run ./_cmd/gen/main.go
```

### バージョン変更

指定されたバージョンにする

```
go run ./_cmd/version.go 0.0.0
```

- ./_cmd/binder/version
- ./_cmd/lite/version
- ./_cmd/binder/build/config.yml
- ./_cmd/binder/frontend/package.json
- ./_cmd/lite/build/config.yml
- ./_cmd/lite/frontend/package.json

６つのファイルのバージョンが引数のバージョンに変更されます。
`_cmd/binder/version` がバージョンの実体で、`main.go` は `//go:embed version` で読み込みます。

**注意**: `_cmd/binder/build/windows/info.json`（`file_version` / `ProductVersion`）と
`_cmd/binder/build/darwin/Info.plist`（`CFBundleShortVersionString` / `CFBundleVersion`）にも
バージョン文字列があるが、`_cmd/version.go` の更新対象**外**である。これらは CI（`.github/workflows/versionup.yml`）の
`wails3 update build-assets` ステップで `config.yml` のバージョンから再生成・同期される。
ローカルで `go run _cmd/version.go` だけを実行した場合は info 系が取り残されるため、
ローカルでプラットフォームバージョンまで揃えたいときは `wails3 update build-assets` を併せて実行すること。

### テスト
```bash
# 全Goテスト実行
go test ./...

# パッケージ単位でテスト実行
go test ./fs/...
go test ./db/...

# 単一テスト実行
go test ./fs/ -run TestAssetRead

# フロントエンドテスト実行
cd _cmd/binder/frontend && npx vitest run
```

**テスト実行は必須**: Go・フロントエンドいずれの変更でも、コミット前に関連テストを実行してパスを確認すること。全テストがパスする状態を維持する。テストが壊れたまま放置しない。

## アーキテクチャ

### レイヤー構成

```
Reactフロントエンド (JSX, MUI, Vite)
    ↓ Wails v3 バインディング (frontend/bindings/binder/api/app.js)
api/ — Go APIレイヤー（App構造体をWails v3 Serviceとしてバインドし、JSにメソッドを公開）
    ↓
ルートパッケージ (binder.go, note.go, diagram.go 等) — コアビジネスロジック（Binder構造体）
    ↓
db/  — CSVベースのSQLデータベース（csvq-driver）、DAO
fs/  — Gitバックのファイルシステム（go-git）、ファイルI/O、コミット管理
```

### 主要な型

- **`Binder`** (binder.go) — 中心的なオーケストレータ。FileSystem、DB、HTTPサーバーへの参照を保持。ライフサイクル: `Load()` → 使用 → `Close()`
- **`api.App`** (api/api.go) — Wails v3 の Service として登録される構造体。`Startup()` は Wails の Service ライフサイクルとは独立しており、`main()` から直接呼び出される。フロントエンドからのメソッド呼び出しを受け、`Binder`に委譲
- **`Window`** (_cmd/binder/window.go) — Wails v3 の第2 Service。ウィンドウ操作（サイズ変更・移動・最小化・最大化）を担当
- **`fs.BinderMeta`** (fs/meta.go) — `binder.json` の読み書きを担当。アプリバージョン・name・detail を保持。`Schema` フィールドは後方互換用（非推奨）
- **`fs.FileSystem`** (fs/fs.go) — go-gitリポジトリのラッパー。全コンテンツ変更はここを経由し、gitコミットされる
- **`db.Instance`** (db/db.go) — csvqを使用したCSVファイルへのSQLインターフェース。テーブル: notes, diagrams, assets, templates, structures
- **`internal.Version`** (internal/version.go) — セマンティックバージョンのパース・比較。`NewVersion(buf)`, `Lt()`, `Gt()`, `Eq()` 等
- **`settings`の i18n 機能** (settings/languages.go) — Go側UI文字列の翻訳。`InitI18n(code)` / `T(key)` / `SetI18nLanguage(code)` / `OnLanguageChange(fn)`（詳細は「Go側 i18n」セクション参照）
- **`shared.Shared`** (api/shared/shared.go) — Binder/Lite 共通の第3 Service。テーマ・言語・フォント一覧の取得

### Wails v3 固有の注意点

- `api.App` は Wails v3 Service として `application.NewService(app)` で登録されるが、`ServiceStartup` インターフェースは実装していない。初期化は `main()` から `app.Startup()` を直接呼ぶ
- アプリ取得: サービス内から `application.Get()` で `*application.App` を取得
- ウィンドウ作成: `app.Window.NewWithOptions(opts)`
- ダイアログ: `app.Dialog.OpenFile().CanChooseDirectories(true).PromptForSingleSelection()`
- ブラウザ: `app.Browser.OpenURL(url)`
- フロントエンドバインディング: `frontend/bindings/binder/api/app.js`（Goパッケージパスに対応、手動編集不可）
- ビルド設定: `_cmd/binder/Taskfile.yml` + `_cmd/binder/build/config.yml`（Wails v2の `wails.json` はメタデータのみ残存）
- バージョン: `_cmd/binder/main.go` が `//go:embed version` で `_cmd/binder/version` ファイルからバージョン文字列を取得

### データフロー

全ての変更操作（ノート・ダイアグラム・アセットの作成/編集/削除）は以下のパターンに従う:
1. フロントエンドがWailsバインディング経由で`api.App`のメソッドを呼び出す
2. `api.App`が`Binder`のビジネスロジックに委譲する
3. `Binder`が`fs`でファイルシステムに書き込み、`db`でメタデータを更新する
4. `fs`が変更をgitコミットする
5. JSONレスポンスをフロントエンドに返す

例外: ルートファイル（後述）は保存時にコミットせず、未記録一覧から記録する。

### フロントエンド構成 (_cmd/binder/frontend/src/)

利用スコープに基づいてディレクトリを分割している。

- **main.jsx** — エントリポイント。URLパラメータで App / CommitApp / HistoryApp を切り替え
- **Event.jsx** — コンポーネント間通信用のカスタムイベントバス
- **Message.jsx** — Snackbar通知

**app/** — アプリエントリ & アプリ固有コンポーネント:
- App.jsx — メインウィンドウ: 左側Menu + 右側Content
- HistoryApp.jsx — ファイル履歴用の別ウィンドウ
- Content.jsx — ルートベースのコンテンツ切り替え（react-router）
- Menu.jsx — 左サイドバー（アイコンバー + サブメニュー）
- FileMenu / TemplateTree / HistoryMenu / HistoryPatch — 各ウィンドウ/メニュー固有のコンポーネント

**pages/** — ルーティングされるページ:
- History.jsx / BinderRegister.jsx / BinderRemote.jsx — バインダー管理画面
- editor/ — 分割ペインのMarkdownエディタ（左:編集、右:プレビュー）、marked.jsとMermaid.js使用

**dialogs/** — ダイアログ & dialog内でのみ使用するコンポーネント:
- components/ — ConfirmDialog, MetaDialog, ModalWrapper, ActionButton, DialogError（ダイアログ共通コンポーネント）
- *MetaDialog.jsx — Note/Diagram/Asset/Layer/Templateのメタ編集ダイアログ
- *Modal.jsx — Binder/Commit/Publish/Setting/Branch/Merge/Push のフルスクリーンモーダル
- Binder.jsx / Setting.jsx / GenerateForm.jsx 等 — モーダル内でのみ使用するコンポーネント
- PluginSetting.jsx / RootFileSetting.jsx — バインダー設定のタブ（プラグイン / ルートファイル）
- AppPluginSetting.jsx — アプリ設定のプラグインタブ
- ModifiedMenu.jsx / UnpublishedMenu.jsx — 未記録一覧・未公開一覧

**components/** — 複数スコープで共有されるコンポーネント:
- Tree.jsx — 汎用ツリーコンポーネント（`@mui/x-tree-view`）
- BinderTree.jsx — ノート・ダイアグラム・アセットの階層ツリー（Menu + Editor で使用）
- Commit.jsx / Patch.jsx — コミット関連（CommitApp + CommitModal で使用）
- Note.jsx / Diagram.jsx / AssetViewer.jsx — エンティティ操作コンポーネント

**bindings/** — Wails v3が自動生成するJSバインディング（手動編集不可）

### ドメインエンティティと構造 (db/model/)

スキーマ 0.2.0 から `structures` テーブルで階層構造を一元管理している。

- **Structure** — 全エンティティの共通階層情報: `id, parent_id, seq, type, name, detail, alias, publish_date, republish_date`。`publish_date/republish_date` は 0.4.7 でここに集約
- **Note** — Markdownコンテンツ: `id, layout_template, content_template`
- **Diagram** — Mermaidダイアグラム: `id`
- **Asset** — 添付バイナリ/テキストファイル: `id, binary`
- **Template** — 公開用HTMLレイアウト/コンテンツテンプレート: `id, type, name, detail, seq`

Note/Diagram/Asset は `ApplyStructure(s *json.Structure)` で Structure の情報（parent_id, name, detail, alias）を取り込む。

### データベース (db/)

csvq（CSVファイルに対するSQL）を使用。binderリポジトリ内の`db/`ディレクトリにCSVテーブルファイルを格納。

**スキーマバージョン管理**:
- `binder.json`（バインダールートに配置）: `{"version": "x.y.z", "name": "...", "detail": "..."}` でアプリバージョン・バインダー情報を管理（0.4.5以降 `config.csv` は廃止）
- 旧形式（`db/schema.version`）は自動マイグレーション後に削除される

**マイグレーション**:

マイグレーションは **アプリレベル** と **バインダーレベル** の2種類がある。

**アプリレベルマイグレーション** (`setup/setup.go` の `migrateApp()`):
- `~/.binder/` 配下のアプリ全体の設定・リソースを更新する処理
- `setting.json` の `appVersion` フィールドで前回起動時のバージョンを記録し、バージョン変更を検出する
- バージョンが変わった場合または開発モードの場合に `UpdateDefaults()` を実行し、`_default/` のテーマ・言語ファイルを最新に上書きする
- `EnsureExists()` の末尾で呼ばれる。バインダーとは無関係にアプリ起動ごとに実行される

**バインダーレベルマイグレーション** (`setup/convert/`):
- 個々のバインダー（gitリポジトリ）内のDBスキーマ・ファイル構造を更新する処理
- `binder.json` のバージョンとアプリバージョンを比較し、古い場合に `setup.Convert()` → `convert.Run()` で移行を実行する
- バインダーを開く時にのみ実行される（`api.App.CheckCompat()` → フロントエンド確認 → `api.App.Convert()`）
- 各バージョンの移行詳細は `setup/convert/CLAUDE.md` を参照

**DAO コード生成**:
- `_cmd/gen/main.go` が `db/model/*.go` の構造体タグ（`db:"col_name"`, `db:"id:key"`, `db:"col:insert"`）を読んで `db/*_dao.go` を生成
- モデルを変更したら `go run ./_cmd/gen/main.go` で再生成すること

### 設定

ユーザー設定はホームディレクトリの`binder/setting.json`に保存（ウィンドウ位置、git設定、外観）。`settings/`パッケージで管理。

### テーマ（外部CSSファイル）

テーマは `setup/_assets/themes/` にデフォルトCSSファイルとして管理し、Go embedでバイナリに埋め込む。アプリ起動時に `~/.binder/themes/_default/` へ配置される。ユーザーは `~/.binder/themes/` に独自CSSを追加でき、同名ファイルはユーザー側が優先される。

**デフォルトテーマの編集**:
- `setup/_assets/themes/dark.css` — ダークテーマ
- `setup/_assets/themes/light.css` — ライトテーマ（darkの全変数を含むこと）

**CSSファイル形式**:
```css
/* @theme-name: Dark */
:root {
  --bg-app: #050505;
  --text-primary: #f1f1f1;
  ...
}
```
- ファイル名（拡張子除く）= テーマID（`setting.json` の `theme` に保存される値）
- 1行目の `/* @theme-name: ... */` コメントが設定画面での表示名。無ければファイル名を使用
- CSS変数の追加・変更はこのファイルを編集する。CSSやJSXにハードコードしないこと

**配置の仕組み**:
- `setup/externals.go` の `installThemes()` が `_assets/themes/` から `~/.binder/themes/_default/` にコピー
- 初回起動時: ファイルが存在しなければコピー（`force=false`）
- アプリバージョンアップ時・開発モード時: 常に上書き（`setup.UpdateDefaults()` → `force=true`）
- バージョン比較は `setting.json` の `appVersion` フィールドで管理（`setup/setup.go` の `migrateApp()`）

**フロントエンドでの利用**:
- `var(--変数名)` をsx prop / inline style / CSS いずれでも使用可能
- テーマ切り替えは `applyTheme(themeId)`（`_cmd/binder/frontend/src/theme.js`）でGoからCSS文字列を取得し `<style>` タグに注入
- **対象外**: エディタtextareaのフォント色・背景色（FontDialog設定で上書き）、プレビューiframe内のHTML、Mermaidテーマ

**Go API** (`api/setting.go`):
- `GetThemeList()` — 利用可能なテーマ一覧
- `GetThemeCSS(id)` — 指定テーマのCSS文字列を返す

### 言語（外部JSONファイル）

言語ファイルは `setup/_assets/languages/` にデフォルトJSONファイルとして管理し、Go embedでバイナリに埋め込む。テーマと同じ `_default/` ディレクトリ分離パターンで `~/.binder/languages/` に配置される。

**デフォルト言語ファイルの編集**:
- `setup/_assets/languages/en.json` — 英語
- `setup/_assets/languages/ja.json` — 日本語

**JSONファイル形式**（ネストしたオブジェクト。フロントエンドは `t("menu.binder")` のようにドット記法で参照する）:
```json
{
  "code": "English",
  "menu": {
    "binder": "Binder Tree",
    ...
  }
}
```
- ファイル名（拡張子除く）= 言語コード（`setting.json` の `language` に保存される値）
- `"code"` キーが設定画面での表示名
- 翻訳キーのIDは表示を行うコンポーネントの名称・区分で発行する

**フロントエンドでの利用**:

コンポーネントでは `useTranslation` フックで翻訳テキストを取得する:
```js
import "../language";
import { useTranslation } from 'react-i18next'

const {t} = useTranslation();
t("menu.setting")
```

言語の動的読み込みは `loadLanguage(code)`（`_cmd/binder/frontend/src/language.jsx`）でGoから翻訳JSONを取得し `i18n.addResourceBundle()` で登録する。

**Go API** (`api/shared/shared.go` — Binder/Lite 共通の Shared Service):
- `GetLanguageList()` — 利用可能な言語一覧
- `GetLanguageData(code)` — 指定言語のJSON文字列を返す

**配置の仕組みはテーマと同じ**: `setup/externals.go` の `installLanguages()` が管理。優先順位もテーマと同様（ユーザーディレクトリ > `_default/`）。

### Go側 i18n（`settings` パッケージ内）

Go側で生成するUI文字列（ウィンドウタイトル・ダイアログ・ファイルフィルタ・ユーザー向けエラー）も同じ言語JSONファイルから翻訳する。`settings/languages.go` に実装。

- **`settings.InitI18n(code)`** — 言語JSONを読み込み、ネスト構造を `"go.window.main"` 形式にフラット化して保持。設定ロード後・**ウィンドウ作成前**に `main()` から呼ぶ（Binder/Lite 両方）
- **`settings.T(key)`** — 翻訳文字列を返す。未発見時はキー自体を返す
- **`settings.SetI18nLanguage(code)`** — 実行時の言語切り替え。`api.App.SetLanguage()` / `lite.App.SetLanguage()` から呼ばれる
- **`settings.OnLanguageChange(fn)`** — 言語変更コールバック登録。main.go でウィンドウタイトルの `SetTitle()` 更新に使用（`_cmd/binder/window.go` の `UpdateWindowTitles()` が開いているサブウィンドウを更新）

**翻訳キーの規約**: Go側専用キーは言語JSONの `"go"` セクションに置く（`go.window.*`, `go.dialog.*`, `go.filter.*`, `go.error.*`）。フロントエンドのキーと衝突しない。

**注意**: `fmt.Errorf` / `xerrors.Errorf` に `settings.T()` を渡す場合は非定数フォーマット文字列の vet エラーを避けるため `fmt.Errorf("%s", settings.T(...))` とする。

### ユーザ向けエラー（Go → Wails → フロント）

API メソッドが返すエラーを、フロントで「1行メッセージ＋詳細＋折りたたみデバッグ情報」として表示する仕組み。

**伝達メカニズム（Wails v3）**: バインドメソッドが error を返すと Wails は
`CallError{ Message: err.Error(), Cause: MarshalError(err), Kind: "RuntimeError" }` を JSON 化して HTTP エラーボディで返す。フロントの `@wailsio/runtime` は `throw new Error(<その JSON>)` するため、**JS の `Error.message` がこの envelope JSON 文字列**になる。`application.Options.MarshalError func(error) []byte` フックで envelope の `cause` に任意の構造化 JSON を載せられる（非nil を返すとそれが `cause` に入り、nil ならデフォルトの `json.Marshal(&err)`≒`{}` にフォールバック）。

**Go 側** (`api/message.go`):
- **`MessageError{ Body, Detail, Cause }`** — ユーザ向け構造化エラー。`Error()` は人間可読1行（ログ用）、`Unwrap()` で `errors.Is/As` チェーン維持、`MarshalJSON()` は `{body, detail, cause}` を返す（`cause` は `fmt.Sprintf("%+v", Cause)` で **xerrors のスタックトレース**＝関数名・file:line を含める）
- コンストラクタ: `Wrap(cause, body)`, `Wrapf(...)`, `WithDetail(cause, body, detail)`
- **`MarshalError(err)`** — `_cmd/binder/main.go` の `application.Options.MarshalError` に登録。`errors.As` で `*MessageError` を探して JSON 化、無ければ nil
- **`userError(err)`** (`api/error.go`) — 内部エラーをユーザ向け `MessageError` に変換する API 境界のヘルパー。既知の sentinel（`binder.ErrNoteHasChildren`, `db.DuplicateAlias` 等）を `settings.T("go.error.*")` の翻訳メッセージへマッピングし、未知は `go.error.unexpected`（「異常が発生しました」）で包む。元 err は常に `Cause` に保持
- API メソッドは `fmt.Errorf("X() error\n%+v", err)` の代わりに `return userError(err)` を返す。原因が明確な箇所は `userError` の switch にケースを追加して段階的に改善する
- **MessageError は API 境界（`userError`）でのみ生成する**。fs/db/binder などの下位層は通常の `xerrors` を返し、変換は api 層が担う（だから型も `api` パッケージに置く）

**フロント側**:
- **`src/error.js` の `parseError(err)`** — `err.message` を `JSON.parse` して envelope を取り出し、`cause` に `body` があれば `{ body, detail, debug }` に正規化（`cause.cause`＝Goスタックは `debug` へ）。`cause` が無い未変換エラーは `message` の先頭行を `body`、残りを `debug` にフォールバック。JSON でない文字列（フロント由来・`t()`）はそのまま `body`
- `src/Message.jsx`（スナックバー）/ `src/dialogs/components/DialogError.jsx` が `parseError` を使い、**body をスナックバー**、ダブルクリックで **detail**、折りたたみ「デバッグ情報」で **debug**（Goスタック＋JSスタック）を表示
- i18n: ユーザ向けメッセージは `go.error.*`（Go側）、折りたたみ見出し等は `common.*`

**注意**:
- `MessageError` 型・`MarshalError` 等はバインド対象メソッドではないため、追加・変更してもフロントエンドバインディング再生成は不要
- Binder Lite は `binder/api`（fs/db を巻き込む）を import できないため `MarshalError` を登録していない。Lite は `MessageError` を生成しないので実害なし。共有が必要になったら lite が import できるパッケージへ切り出す

### プラグイン（marked.js 拡張）

ユーザーが配置した JS ファイルを `marked.use()` に渡してマークダウンレンダリングを拡張する仕組み。

**ディレクトリ構造**:
```
plugins/              ← バインダー内（git管理・共有される）
  marked/
    github-alerts.js  ← ユーザーが配置するプラグイン
  mermaid/            ← 将来用（未実装）

~/.binder/plugins/    ← アプリレベル（全バインダー共通）
  _default/
    marked/
      example.js      ← テンプレート（参考用）
  marked/             ← ユーザーが登録したアプリプラグイン
    github-alerts.js
```

**プラグイン JS ファイル形式**（IIFE で `marked.use()` 互換オブジェクトを返す）:
```js
/* @plugin-name: GitHub Alerts */
(function() {
  return {
    extensions: [{ name, level, start, tokenizer, renderer }],
    renderer: { blockquote(token) { ... } },
    hooks: { preprocess(md) { ... } },
    walkTokens(token) { ... }
  };
})();
```

**読み込み順**: ファイル名アルファベット順。`01-alerts.js`, `02-footnotes.js` のようにプレフィックスで制御可能。

**Go 実装**:
- `fs/plugin.go` — `ReadPlugins(engine)`, `ListPlugins(engine)`, `WritePlugin`, `DeletePlugin`, `RenamePlugin`
- `fs/path.go` — `PluginDir = "plugins"`, `PluginEngineDir(engine)`
- `binder.go` — `GetPlugins`, `ListPlugins`, `SavePlugin`, `RemovePlugin`, `RenamePlugin`, `InstallAppPlugin`
- `api/plugin.go` — バインダープラグイン CRUD の Wails バインディング
- `api/app_plugin.go` — アプリプラグイン CRUD + `InstallAppPlugin`
- `settings/plugins.go` — `~/.binder/plugins/` のパスヘルパー・CRUD（OS レベル、git 管理外）
- `setup/externals.go` — `installPlugins()` でテンプレートを `_default/` に配置

**フロントエンド実装**:
- `_cmd/shared/frontend/editor/engines/Marked.jsx` — `applyPlugins(plugins)`: `(0, eval)(content)` で評価し `marked.use()` に渡す
- `_cmd/binder/frontend/src/main.jsx` — `Marked.init` オーバーライド内で `GetPlugins("marked")` を呼びプラグインを適用
- `dialogs/PluginSetting.jsx` — バインダー設定のプラグインタブ（CRUD + アプリプラグインからのインストール）
- `dialogs/AppPluginSetting.jsx` — アプリ設定のプラグインタブ（CRUD）

**即時反映**: プラグインの追加・更新・削除後に `Marked.reset()` を呼ぶことで、次回プレビュー描画時に marked を再初期化してプラグインを再適用する。

**サンプルプラグイン**: `setup/_assets/plugins/marked/github-alerts.js` — GitHub Note 記法（`> [!NOTE]` 等）のサンプル実装（配布対象外・動作確認用）。

### ルートファイル（README.md 等）

バインダールート直下にユーザーが任意の名前のファイル（README.md, LICENSE 等）を配置・編集できる仕組み。DBには登録せず、ファイルシステムのみで管理する。

**他エンティティとの違い**:
- ファイル名はユーザーが決定（ID規約・structures テーブルの対象外）
- 保存・削除・リネームは**即コミットしない**。変更は未記録一覧に「File」セクションとして表示され、既存の記録フローでコミットする（プラグインは即コミットなので注意）

**予約名**: `binder.json`, `.gitignore`, `user_data.enc`, 各管理ディレクトリ名（`notes`, `diagrams`, `assets`, `layers`, `templates`, `plugins`, `db`, `docs`）は使用不可。Windows対応のため大文字小文字を区別せず比較する（`fs.ValidateRootFileName`）。先頭ドットのファイル名も不可。

**Go 実装**:
- `fs/rootfile.go` — `ListRootFiles`, `ReadRootFile`, `WriteRootFile`, `DeleteRootFile`, `RenameRootFile`, `ValidateRootFileName`
- `fs/git.go` — `getModelType()` がルート直下のユーザーファイルを `"file"` タイプとして分類（予約ファイルは管理外のまま）。`ModifiedFiles.Files()` フィルタ
- `tree.go` — `GetModifiedTree()` の `DIR_File` カテゴリ。表示名はファイル名そのもの（DBルックアップなし）
- `git.go` — `ToFile()` / `getFilename()` の `"file"` ケース（id = ファイル名）。これにより未記録一覧からのコミット・差分表示（`GetNowPatch`）・履歴・復元が既存の仕組みで動く
- `binder.go` / `api/rootfile.go` — CRUD の委譲と Wails バインディング

**フロントエンド実装**:
- `dialogs/RootFileSetting.jsx` — バインダー設定の「ファイル」タブ。一覧 + 追加・リネーム・削除。編集ダイアログは `.md` / `.markdown` でプレビュー切替（`Marked.parse()` 使用）
- `dialogs/ModifiedMenu.jsx` — `DIR_File` を「File」セクションとして表示。`type === 'file'` はエディタ画面を持たないためダブルクリックで開かない

### オートコンプリート

エディタの入力補助機能。Goテンプレート編集とMermaidダイアグラム編集で異なる候補を提供する。

**設定（5つの個別トグル）**:
- `AutoCompleteConfig` (`settings/settings.go`) — `template`, `idAssist`, `autoClose`, `funcHint`, `mermaid` の5フラグ
- 旧形式（`autoComplete: true/false`）との後方互換: Go側は `Editor.UnmarshalJSON` でbool→オブジェクトに変換、フロントエンド側は `typeof e.autoComplete === 'object'` で判定
- 設定UI: `dialogs/EditorSetting.jsx` の5つの小型Switch

**共有フック・データファイル** (`_cmd/shared/frontend/editor/`):
- `useAutocomplete.js` — 汎用オートコンプリートフック。2種類のトリガーをサポート:
  - **文字列トリガー**: `{ trigger: '{{', candidates }` — 特定文字列の入力で発火（Goテンプレート用）
  - **行頭トリガー**: `{ trigger: '', lineStart: true, candidates }` — 行頭からの入力全体でフィルタ（Mermaid用）
- `mermaid-candidates.js` — Mermaidオートコンプリートのデータ定義。`buildMermaidCandidates(types, t)`, `buildMermaidSyntaxMap(t)`, `buildMermaidDirections(t)` をエクスポート
- 候補関数が `{ items, filterKey }` を返すと、`filterKey` でサブトークン置換を行う（例: `flowchart L` → `LR` のみ置換）

**Goテンプレート補完** (`Component.jsx`):
- `{{` トリガー: キーワード・制御構文・アクション・比較・カスタム関数の候補
- `.` トリガー: ドット記法のプロパティ候補
- `"` トリガー: ID補助。`goTemplateCandidates` の `args[argIndex].idType` で厳密に位置判定し、該当引数のみでID一覧を表示。`needsEnd` 付きブロックキーワード（`range` 等）の内側関数も検出
- `autoClose`: `if`/`range`/`with`/`block` 選択時に `{{end}}` を自動挿入
- `funcHint`: カーソル位置の関数に応じて引数ヒントを表示

**Mermaid補完** (`Component.jsx` の `getMermaidCandidates`):
- 1行目: ダイアグラムタイプ候補。ハイブリッド方式（`mermaidKnownKeywords` + `mermaid.getRegisteredDiagramsMetadata()` で動的取得し、`detectType()` で検証）
- 1行目の2語目以降: `flowchart`/`graph` 等の方向指定キーワード候補（TD, LR 等）
- 2行目以降: ダイアグラムタイプ別の構文キーワード候補（`participant`, `subgraph`, `section` 等）
- i18nキー: `autocomplete.mermaid.*`（ダイアグラムタイプ）, `autocomplete.mermaid.dir.*`（方向）, `autocomplete.mermaid.syn.*`（構文）

## Binder Lite

Binder Lite は軽量版の Markdown/Mermaid エディタ。git管理・DB・ツリー階層・公開機能を持たず、OSの任意ファイルを直接開いて編集する。

### ビルド・開発コマンド

```bash
# 開発モードで起動（_cmd/lite/ から実行）
cd _cmd/lite && task dev

# プロダクションビルド
cd _cmd/lite && task build
```

### 起動引数

```bash
# 複数ファイルを指定して起動（存在しないパスは無視）
binder-lite file1.md file2.mmd file3.md
```

### アーキテクチャ

```
React フロントエンド (MUI, Vite)
    ↓ Wails v3 バインディング (frontend/bindings/binder/api/lite/app.js)
api/lite/api.go — 薄い Service（ファイルI/O + テーマ/言語）
    ↓
os.ReadFile / os.WriteFile（標準ライブラリ）
setup/, settings/（Binder と共有）
```

### Go バックエンド

- **`lite.App`** (api/lite/api.go) — Wails v3 Service。`ReadFile`, `SaveFile`（アトミック書き込み）、テーマ・言語は `settings` パッケージに委譲。起動引数ファイルの管理（`SetInitialFiles` / `InitialFiles`）
- **`Window`** (_cmd/lite/window.go) — 第2 Service。ファイルダイアログ（Open/Save）、新規ファイル作成、ウィンドウ操作
- Binder の `fs/`, `db/`, `api/` には一切依存しない

### フロントエンド構成 (_cmd/lite/frontend/src/)

- **main.jsx** — エントリポイント。テーマ・言語の初期化、shared エンジンの vendor URL 設定
- **App.jsx** — メインコンポーネント。タブ管理、スプリッター、プレビュー折りたたみ、テーマモード、確認ダイアログ
- **TitleBar.jsx** — フレームレスウィンドウ用カスタムタイトルバー。ファイル操作ボタン（New/Open/Save）+ テーマ切り替え + ウィンドウ操作（最小化/最大化/閉じる）
- **TabBar.jsx** — ファイルタブバー。オーバーフロー時の左右スクロールボタン付き
- **EditorPane.jsx** — エディタラッパー。共有 EditorArea + SearchBar + Markdown入力支援 + 行番号トグル（左上）+ 折り返しトグル（右下）
- **PreviewPane.jsx** — プレビュー。共有 HTMLFrame + Marked/Mermaid エンジン。Markdown/Mermaid 切り替えボタン（右上）。`MutationObserver` でテーマ変更を検知し再描画
- **ConfirmDialog.jsx** — カスタム確認ダイアログ（Promise ベース）
- **theme.js** — テーマ管理。system/light/dark の3モード対応。system モードは `prefers-color-scheme` を監視
- **language.jsx** — i18next 初期化
- **useHasScrollbar.js** — スクロールバー検出フック（`useScrollbarOffset`, `useHScrollbarOffset`, `useIframeScrollbarOffset`）。ボタン位置調整用

### 主な機能

- タブ式マルチファイル編集（`.md`, `.mmd`, `.mermaid` 等）
- 左右分割レイアウト（エディタ + プレビュー）、スプリッターでサイズ調整
- プレビューの折りたたみ・展開（アニメーション付き）
- Markdown/Mermaid プレビュー切り替え（タブごとに保持）
- Markdown 入力支援（リスト・チェックリスト・引用・番号リストの自動継続）
- Ctrl+S 明示的保存（アトミック書き込み）、未保存マーク表示
- テーマ切り替え（system/light/dark）
- ファイルドロップ対応（`EnableFileDrop` + `data-file-drop-target`）
- フレームレスウィンドウ（`--wails-draggable` でドラッグ領域制御）

### タブデータ構造

```js
{
  id,            // タブID
  path,          // ファイルパス
  filename,      // 表示名
  content,       // 現在のエディタ内容
  savedContent,  // 最後に保存した内容
  mermaidMode,   // Mermaid プレビューモード
}
```

## 共有コンポーネント (_cmd/shared/frontend/)

Binder と Binder Lite のフロントエンドで共有するエディタコンポーネント群。

### 構成

```
_cmd/shared/frontend/editor/
  EditorArea.jsx       行番号ガター + textarea エディタ
  SearchBar.jsx        テキスト検索フローティングパネル
  HTMLFrame.jsx        ダブルバッファ iframe プレビュー
  FontDialog.jsx       フォント設定ダイアログ
  markdown-keys.js     Markdown 入力支援（リスト継続・引用継続等）
  engines/
    Scripter.jsx       ESM/UMD 動的読み込みユーティリティ
    Marked.jsx         marked.js ラッパー
    Mermaid.jsx        mermaid.js ラッパー
```

### 参照方式

- **Binder**: 既存の `components/editor/` に re-export ラッパーを配置（`export { default } from "@shared/editor/..."` の1行）。既存コードの import パスを維持
- **Lite**: `@shared/editor/...` を直接 import（旧 `components/editor/` は削除済み）

### Vite 設定

両プロジェクトの `vite.config.js` で以下を設定:
- `resolve.alias`: `@shared` → `_cmd/shared/frontend/` ディレクトリ
- `resolveSharedDeps` プラグイン: shared/ 内の bare import（react, @mui 等）を各プロジェクトの `node_modules` で解決
- `server.fs.allow`: dev server が shared ディレクトリにアクセスすることを許可

### Marked/Mermaid エンジンの初期化

vendor JS の URL はプロジェクトごとに異なるため、`setVendorUrl()` で外部から注入する:
```js
// 各プロジェクトの main.jsx で設定
import Marked from '@shared/editor/engines/Marked'
import markedVendorUrl from './assets/vendor/marked.min.js?url'
Marked.setVendorUrl(markedVendorUrl)
```
Binder は追加で CDN 対応の `init()` を main.jsx で上書きする。

## UI用語

UIではGit用語を隠蔽し、ユーザーフレンドリーな表現を使用する:
- **コミット → 記録**（英語: Record）。コード内部の変数名・イベント名・ファイル名は `commit` のまま維持し、言語ファイル（`setup/_assets/languages/`）の表示ラベルのみ「記録」を使用する
- **未コミット → 未記録**（英語: Unrecorded）

## ワークツリー開発の必須手順

ワークツリーを作成したら、**他の作業より先に**以下を順番に実行すること。

### 1. node_modules の Junction 作成（必須・最優先）

ワークツリーには node_modules が存在しない。メインリポジトリの node_modules への Junction を作成する。

```powershell
# binder
New-Item -ItemType Junction -Path "_cmd\binder\frontend\node_modules" -Target "D:\Go\Projects\binder\_cmd\binder\frontend\node_modules"
# lite
New-Item -ItemType Junction -Path "_cmd\lite\frontend\node_modules" -Target "D:\Go\Projects\binder\_cmd\lite\frontend\node_modules"
```

**禁止: ワークツリー内での `npm install`**。Junction が実体ディレクトリに上書きされ、メインリポジトリ側の node_modules を破壊する。

Junction の安全な解除は `cmd /c rmdir <link>`。`Remove-Item -Recurse` はリンク先の実体を削除する危険があるため使わない。

### 2. フロントエンドバインディング生成（必須）

```bash
cd _cmd/binder && wails3 task common:generate:bindings
```

Go API やフロントエンドを触る作業では、バインディングがないとビルドもテストも通らない。API 変更を行った場合はその都度再生成する。

**禁止: バインディングのコミット**。`_cmd/binder/frontend/bindings/` は `.gitignore` 対象の生成物であり、`git add` や `git add -f` でステージングしてはならない。バインディングはローカルでのビルド・テスト用に生成するもので、各環境で都度生成される前提。

### フロントエンドのビルド確認・テスト

```bash
# ビルド確認（Junction 済み前提）
cd _cmd/binder/frontend && ./node_modules/.bin/vite.cmd build

# フロントエンドテスト実行
cd _cmd/binder/frontend && npx vitest run

# 実機での見た目確認
cd _cmd/binder && task dev
```

**注意**: `wails3 dev`（`task dev`）の Taskfile は `install:frontend:deps` ステップで `npm install` を実行するため、Junction が削除される。dev 実行後に再度 Junction が必要な場合は作り直すこと。ただし `wails3 dev` は bindings を自動生成するため、dev 時の bindings 不足は問題にならない。

### フロントエンドテスト構成

- テストフレームワーク: Vitest（`_cmd/binder/frontend/vitest.config.js`）
- テストファイル: `_cmd/binder/frontend/src/__tests__/*.test.jsx`
- セットアップ: `_cmd/binder/frontend/src/__tests__/setup.js`（`@wailsio/runtime` のグローバルモック、ResizeObserver ポリフィル、i18n 初期化）
- 全コンポーネントにビルドパスレベルのテストあり（69ファイル・112テスト）

## コーディング規約

- エラーラッピングは`golang.org/x/xerrors`を使用（`xerrors.Errorf("context: %w", err)`）
- ロギングは`log/slog`と`log/`パッケージのヘルパーを使用（`log.PrintTrace()`, `log.PrintStackTrace()`）
- IDはUUID v7（`github.com/google/uuid`）
- Wailsアプリのエントリーポイントは`_cmd/binder/`（アンダースコアプレフィックスに注意）
- コードベース全体に日本語コメントあり
- コミットメッセージはConventional Commits形式（`fix:`, `feat:`, `docs:`）。末尾に「Glory to mankind.」を付ける
- `api/json/`パッケージはAPI向けのモデル型を含み、`db/model/`とは別
- DAOファイルは`_dao.go`サフィックスを使用（自動生成、手動編集不可）
- `fs`パッケージはOSファイルシステムとインメモリファイルシステム（billy）の両方をサポート（テスト用）
- セマンティックバージョン操作は`internal.Version`を使用（直接文字列比較は不可）


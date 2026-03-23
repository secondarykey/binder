# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

Binderは技術文書作成向けの実験的なデスクトップMarkdownエディタ。**Wails v3**（Go + React）でフレームレスのデスクトップアプリケーションを構築している。コンテンツはローカルgitリポジトリにファイルとして保存され、メタデータはCSVベースのSQLテーブル（csvq）で管理される。

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

- ./_cmd/binder/build/config.yml
- ./_cmd/binder/build/windows/info.json
- ./_cmd/binder/frontend/package.json

３つのファイルのバージョンが引数のバージョンに変更されます。

### テスト
```bash
# 全Goテスト実行
go test ./...

# パッケージ単位でテスト実行
go test ./fs/...
go test ./db/...

# 単一テスト実行
go test ./fs/ -run TestAssetRead
```

**注意**: `binder` パッケージのテストには既知の失敗がある（`CommitAll` での空コミットエラー）。

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

### Wails v3 固有の注意点

- `api.App` は Wails v3 Service として `application.NewService(app)` で登録されるが、`ServiceStartup` インターフェースは実装していない。初期化は `main()` から `app.Startup()` を直接呼ぶ
- アプリ取得: サービス内から `application.Get()` で `*application.App` を取得
- ウィンドウ作成: `app.Window.NewWithOptions(opts)`
- ダイアログ: `app.Dialog.OpenFile().CanChooseDirectories(true).PromptForSingleSelection()`
- ブラウザ: `app.Browser.OpenURL(url)`
- フロントエンドバインディング: `frontend/bindings/binder/api/app.js`（Goパッケージパスに対応、手動編集不可）
- ビルド設定: `_cmd/binder/Taskfile.yml` + `_cmd/binder/build/config.yml`（Wails v2の `wails.json` はメタデータのみ残存）
- バージョン: `_cmd/binder/main.go` が `build/config.yml` に埋め込まれた `version: "x.y.z"` を `parseVersion()` で取得

### データフロー

全ての変更操作（ノート・ダイアグラム・アセットの作成/編集/削除）は以下のパターンに従う:
1. フロントエンドがWailsバインディング経由で`api.App`のメソッドを呼び出す
2. `api.App`が`Binder`のビジネスロジックに委譲する
3. `Binder`が`fs`でファイルシステムに書き込み、`db`でメタデータを更新する
4. `fs`が変更をgitコミットする
5. JSONレスポンスをフロントエンドに返す

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
- components/ — ConfirmDialog, MetaDialog, ModalWrapper（ダイアログ共通コンポーネント）
- *MetaDialog.jsx — Note/Diagram/Asset/Templateのメタ編集ダイアログ
- *Modal.jsx — Binder/Commit/Publish/Setting のフルスクリーンモーダル
- Binder.jsx / Setting.jsx / GenerateForm.jsx 等 — モーダル内でのみ使用するコンポーネント

**components/** — 複数スコープで共有されるコンポーネント:
- Tree.jsx — 汎用ツリーコンポーネント（`@mui/x-tree-view`）
- BinderTree.jsx — ノート・ダイアグラム・アセットの階層ツリー（Menu + Editor で使用）
- ModifiedMenu.jsx / Commit.jsx / Patch.jsx — コミット関連（CommitApp + CommitModal で使用）
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

**JSONファイル形式**:
```json
{
  "code": "English",
  "menu.binder": "Binder",
  ...
}
```
- ファイル名（拡張子除く）= 言語コード（`setting.json` の `language` に保存される値）
- `"code"` キーが設定画面での表示名
- 翻訳キーのIDは表示を行うコンポーネントの名称・区分で発行する

**フロントエンドでの利用**:

コンポーネントでは `useTranslation` フックで翻訳テキストを取得する:
```js
import "../i18n/config";
import { useTranslation } from 'react-i18next'

const {t} = useTranslation();
t("menu.setting")
```

言語の動的読み込みは `loadLanguage(code)`（`_cmd/binder/frontend/src/i18n/config.jsx`）でGoから翻訳JSONを取得し `i18n.addResourceBundle()` で登録する。

**Go API** (`api/setting.go`):
- `GetLanguageList()` — 利用可能な言語一覧
- `GetLanguageData(code)` — 指定言語のJSON文字列を返す

**配置の仕組みはテーマと同じ**: `setup/externals.go` の `installLanguages()` が管理。優先順位もテーマと同様（ユーザーディレクトリ > `_default/`）。


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

